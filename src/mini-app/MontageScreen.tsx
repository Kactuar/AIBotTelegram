"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { defaultMontageSettings, type MontageColor, type MontageSettings, type ProjectRecord } from "@/src/domain/montage";
import type { ProjectResponse } from "@/src/domain/api";
import { Icon } from "./AppShell";
import OptionHelp, { getToggles } from "./OptionHelp";
import VideoRequirements from "./VideoRequirements";
import { copy, type MiniAppLanguage } from "./i18n";
import { telegramWebApp } from "./telegram";
import styles from "@/app/mini-app/page.module.css";

const colors: MontageColor[] = ["amber", "azure", "lime", "crimson"];

type Props = {
  authorized: boolean;
  authPending: boolean;
  authError: string;
  balance: number;
  initialSettings: MontageSettings;
  language: MiniAppLanguage;
  trialAvailable: boolean;
  header: ReactNode;
  nav: ReactNode;
  onBalanceChange(change: (balance: number) => number): void;
  onSelectBalance(): void;
  onTrialAvailableChange(value: boolean): void;
};

export default function MontageScreen({ authorized, authPending, authError, balance, initialSettings, language, trialAvailable, header, nav, onBalanceChange, onSelectBalance, onTrialAvailableChange }: Props) {
  const [settings, setSettings] = useState(initialSettings || defaultMontageSettings);
  const [preview, setPreview] = useState<string>();
  const [selectedFile, setSelectedFile] = useState<File>();
  const [project, setProject] = useState<ProjectRecord>();
  const [uploading, setUploading] = useState(0);
  const [message, setMessage] = useState("");
  const [introOpen, setIntroOpen] = useState(false);
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [helpOption, setHelpOption] = useState<ReturnType<typeof getToggles>[number]>();
  const fileInput = useRef<HTMLInputElement>(null);
  const t = copy[language];
  const options = getToggles(language);
  const overlayOpen = introOpen || requirementsOpen || Boolean(helpOption);
  const closeOverlay = useCallback(() => { setIntroOpen(false); setRequirementsOpen(false); setHelpOption(undefined); }, []);

  useEffect(() => { setSettings(initialSettings); }, [initialSettings]);
  useEffect(() => {
    if (!localStorage.getItem("aibot_intro_seen")) { setIntroOpen(true); localStorage.setItem("aibot_intro_seen", "1"); }
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") closeOverlay(); };
    window.addEventListener("keydown", onEscape);
    const button = telegramWebApp()?.BackButton;
    button?.onClick(closeOverlay);
    return () => { window.removeEventListener("keydown", onEscape); button?.offClick(closeOverlay); };
  }, [closeOverlay]);
  useEffect(() => { const button = telegramWebApp()?.BackButton; if (overlayOpen) button?.show(); else button?.hide(); }, [overlayOpen]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const projectId = project?.id;
  const projectStatus = project?.status;
  useEffect(() => {
    if (!projectId || !projectStatus || !["queued", "processing"].includes(projectStatus)) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json() as ProjectResponse;
      if (!data.project) return;
      setProject(data.project);
      if (data.project.status === "completed") setMessage(t.montage.projectReady);
      if (data.project.status === "failed") setMessage(t.montage.projectFailed);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [projectId, projectStatus, t.montage.projectFailed, t.montage.projectReady]);

  function save(next: MontageSettings) {
    setSettings(next);
    if (authorized) void fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
  }
  function selectFile(file?: File) {
    if (!file) return;
    if (!/^video\/(mp4|quicktime|x-matroska|webm)$/.test(file.type) || file.size > 100 * 1024 * 1024) { setMessage(t.montage.fileInvalid); return; }
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    video.onloadedmetadata = () => {
      if (video.duration < 2 || video.duration > 30 || video.videoHeight <= video.videoWidth) { URL.revokeObjectURL(url); setMessage(t.montage.videoInvalid); return; }
      if (preview) URL.revokeObjectURL(preview);
      setPreview(url); setSelectedFile(file); setMessage(t.montage.ready);
    };
    video.onerror = () => { URL.revokeObjectURL(url); setMessage(t.montage.videoUnreadable); };
  }
  async function uploadAndGenerate() {
    if (!authorized) return;
    if (!selectedFile) { setMessage(t.montage.chooseVideo); return; }
    const created = await fetch("/api/projects", { method: "POST" });
    const createdData = await created.json() as ProjectResponse;
    if (!created.ok || !createdData.project) { setMessage(createdData.error || t.montage.createFailed); return; }
    setProject(createdData.project); setUploading(1);
    const uploaded = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", `/api/projects/${createdData.project!.id}/input`);
      xhr.setRequestHeader("Content-Type", selectedFile.type);
      xhr.upload.onprogress = (event) => { if (event.lengthComputable) setUploading(Math.round(event.loaded / event.total * 100)); };
      xhr.onload = () => { const data = JSON.parse(xhr.responseText || "{}") as { error?: string }; if (!(xhr.status >= 200 && xhr.status < 300)) setMessage(data.error || t.montage.uploadFailed); resolve(xhr.status >= 200 && xhr.status < 300); };
      xhr.onerror = () => { setMessage(t.montage.uploadFailed); resolve(false); };
      xhr.send(selectedFile);
    });
    if (!uploaded) { setUploading(0); return; }
    const queued = await fetch(`/api/projects/${createdData.project.id}/generate`, { method: "POST" });
    const queuedData = await queued.json() as { error?: string; cost?: number; trial?: boolean };
    setUploading(0);
    if (!queued.ok) { setMessage(queuedData.error || t.montage.queueFailed); return; }
    setProject((current) => current ? { ...current, status: "queued" } : current);
    if (queuedData.cost) onBalanceChange((value) => value - queuedData.cost!);
    if (queuedData.trial) onTrialAvailableChange(false);
    setMessage(queuedData.trial ? t.montage.trialQueued : t.montage.queued);
  }

  const needsTopUp = authorized && balance < 23 && !trialAvailable;
  const busy = uploading > 0 || ["queued", "processing"].includes(project?.status || "");
  return <>
    {header}
    <section className={styles.preview} data-color={settings.color}>{preview ? <video src={preview} controls playsInline /> : <div className={styles.demo}><span>{language === "ru" ? "Это пример" : "Subtitle"}</span><b>{language === "ru" ? "субтитров" : "preview"}</b><em>{language === "ru" ? "в стиле Glass" : "in Glass style"}</em></div>}<button className={styles.play} onClick={() => setIntroOpen(true)} aria-label={t.common.close}><Icon name="play" /></button></section>
    <div className={styles.styles}><button className={styles.activeStyle}>Glass</button><button disabled>Poster <small>{t.montage.stylesSoon}</small></button><button disabled>Editorial <small>{t.montage.stylesSoon}</small></button></div>
    <div className={styles.colors}>{colors.map((color, index) => <button key={color} className={settings.color === color ? styles.colorActive : ""} onClick={() => save({ ...settings, color })}><i data-color={color} />{t.montage.colors[index]}</button>)}</div>
    <div className={styles.sectionTitle}><strong>{t.montage.video}</strong><button type="button" className={styles.requirementsLink} onClick={() => setRequirementsOpen(true)}><Icon name="help" /> {t.montage.requirements}</button></div>
    <label className={styles.upload} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectFile(event.dataTransfer.files[0]); }}><input ref={fileInput} type="file" accept="video/mp4,video/quicktime,video/x-matroska,video/webm" onChange={(event) => selectFile(event.target.files?.[0])} /><Icon name="upload" /><div><b>{selectedFile ? selectedFile.name : t.montage.upload}</b><span>{uploading ? `${language === "ru" ? "Загрузка" : "Uploading"} ${uploading}%` : t.montage.uploadHint}</span></div></label>
    <Toggle {...options[0]} help={() => setHelpOption(options[0])} value={settings.trimVideo} change={(value) => save({ ...settings, trimVideo: value })} featured />
    <div className={styles.sectionTitle}><strong>{t.montage.parameters}</strong></div>
    {options.slice(1).map((option) => <Toggle key={option.key} label={option.label} help={() => setHelpOption(option)} value={settings[option.key]} change={(value) => save({ ...settings, [option.key]: value })} />)}
    <button className={styles.generate} onClick={needsTopUp ? onSelectBalance : uploadAndGenerate} disabled={!authorized || authPending || busy}>{authPending ? t.montage.connecting : busy ? t.montage.processing : trialAvailable ? t.montage.trial : needsTopUp ? t.montage.topUp : t.montage.generate}<small>{authPending ? t.profile.profile : trialAvailable ? t.montage.trialHint : needsTopUp ? t.montage.topUpHint(23 - balance) : `23 ${t.montage.tokens}`}</small></button>
    <p className={styles.balanceSummary}><span>{t.montage.balance}</span> {authorized ? balance : "—"} {t.montage.tokens}</p>
    {(authError || message) && <p className={styles.status} role="status">{authError || message}</p>}
    {nav}
    {requirementsOpen && <VideoRequirements language={language} onClose={closeOverlay} />}
    {helpOption && <OptionHelp language={language} option={helpOption} onClose={closeOverlay} />}
    {introOpen && <div className={styles.modalBack} onMouseDown={closeOverlay}><section className={styles.modal} onMouseDown={(event) => event.stopPropagation()}><div className={styles.modalVideo}>{preview ? <video src={preview} controls playsInline autoPlay /> : <div className={styles.demo}><span>{t.montage.introTitle}</span><b>Reels</b><em>{t.montage.introSubtitle}</em></div>}</div><button onClick={closeOverlay}>{t.montage.introClose}</button></section></div>}
  </>;
}

function Toggle({ label, help, value, change, featured = false }: { label: string; help(): void; value: boolean; change(value: boolean): void; featured?: boolean }) {
  return <div className={styles.toggleRow}><span>{featured && <b className={styles.new}>NEW</b>}{label}<button type="button" className={styles.hint} aria-label={`Подробнее: ${label}`} aria-haspopup="dialog" onClick={help}><Icon name="help" /></button></span><button aria-label={label} aria-pressed={value} className={`${styles.switch} ${value ? styles.switchOn : ""}`} onClick={() => change(!value)}><i /></button></div>;
}
