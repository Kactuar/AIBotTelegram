"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { defaultMontageSettings, montageColors, type MontageSettings, type ProjectRecord } from "@/src/domain/montage";
import type { ProjectResponse } from "@/src/domain/api";
import { MAX_VIDEO_UPLOAD_BYTES, videoUploadDetails, type VideoContentType } from "@/src/domain/video-upload";
import { Icon } from "./AppShell";
import OptionHelp, { getToggles } from "./OptionHelp";
import VideoRequirements from "./VideoRequirements";
import { copy, type MiniAppLanguage } from "./i18n";
import { telegramWebApp } from "./telegram";
import styles from "@/app/mini-app/page.module.css";

type SelectedVideo = { file: File; contentType: VideoContentType; traceId: string };
type VideoUploadEvent = "picker_opened" | "file_selected" | "file_rejected" | "metadata_loaded" | "preview_ready" | "metadata_error" | "upload_started";

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
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo>();
  const [project, setProject] = useState<ProjectRecord>();
  const [uploading, setUploading] = useState(0);
  const [message, setMessage] = useState("");
  const [introOpen, setIntroOpen] = useState(false);
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [helpOption, setHelpOption] = useState<ReturnType<typeof getToggles>[number]>();
  const fileInput = useRef<HTMLInputElement>(null);
  const colorScroller = useRef<HTMLDivElement>(null);
  const selection = useRef(0);
  const traceId = useRef("");
  const [canScrollColorsLeft, setCanScrollColorsLeft] = useState(false);
  const [canScrollColorsRight, setCanScrollColorsRight] = useState(false);
  const t = copy[language];
  const options = getToggles(language);
  const overlayOpen = introOpen || requirementsOpen || Boolean(helpOption);
  const closeOverlay = useCallback(() => { setIntroOpen(false); setRequirementsOpen(false); setHelpOption(undefined); }, []);

  useEffect(() => { setSettings(initialSettings); }, [initialSettings]);
  const updateColorNavigation = useCallback(() => {
    const scroller = colorScroller.current;
    if (!scroller) return;
    const maximum = scroller.scrollWidth - scroller.clientWidth;
    setCanScrollColorsLeft(scroller.scrollLeft > 1);
    setCanScrollColorsRight(scroller.scrollLeft < maximum - 1);
  }, []);
  useEffect(() => {
    const scroller = colorScroller.current;
    if (!scroller) return;
    const update = () => updateColorNavigation();
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { scroller.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, [updateColorNavigation]);
  useEffect(() => {
    const scroller = colorScroller.current;
    const selected = scroller?.querySelector<HTMLButtonElement>(`button[data-color="${settings.color}"]`);
    if (!scroller || !selected) return;
    scroller.scrollTo({ left: Math.max(0, selected.offsetLeft - (scroller.clientWidth - selected.offsetWidth) / 2) });
    window.requestAnimationFrame(updateColorNavigation);
  }, [settings.color, updateColorNavigation]);
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
  function scrollColors(direction: -1 | 1) {
    const scroller = colorScroller.current;
    if (scroller) scroller.scrollBy({ left: direction * scroller.clientWidth * 0.75 });
  }
  function createTrace() {
    const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    traceId.current = id;
    return id;
  }
  function logUpload(event: VideoUploadEvent, details: Record<string, unknown> = {}, id = traceId.current) {
    if (!id) return;
    void fetch("/api/diagnostics/video-upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ traceId: id, event, details }), keepalive: true }).catch(() => undefined);
  }
  function selectFile(file: File | undefined, id = traceId.current || createTrace()) {
    const currentSelection = ++selection.current;
    if (!file) return;
    const upload = videoUploadDetails(file);
    const fileDetails = { extension: file.name.split(".").pop()?.toLowerCase(), contentType: file.type || undefined, size: file.size };
    logUpload("file_selected", fileDetails, id);
    if (!upload || file.size > MAX_VIDEO_UPLOAD_BYTES) {
      setSelectedVideo(undefined); setPreview(undefined); setMessage(t.montage.fileInvalid);
      logUpload("file_rejected", { ...fileDetails, reason: !upload ? "unsupported_type" : "file_too_large" }, id);
      return;
    }
    setSelectedVideo(undefined); setMessage(t.montage.checking);
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      if (currentSelection !== selection.current) { URL.revokeObjectURL(url); return; }
      const metadata = { ...fileDetails, duration: video.duration, width: video.videoWidth, height: video.videoHeight };
      logUpload("metadata_loaded", metadata, id);
      if (!Number.isFinite(video.duration) || video.duration < 2 || video.duration > 30) {
        URL.revokeObjectURL(url); setMessage(t.montage.videoInvalid); logUpload("file_rejected", { ...metadata, reason: "invalid_duration" }, id); return;
      }
      if (preview) URL.revokeObjectURL(preview);
      setPreview(url); setSelectedVideo({ file, contentType: upload.contentType, traceId: id }); setMessage(t.montage.ready);
      logUpload("preview_ready", metadata, id);
    };
    video.onerror = () => {
      if (currentSelection !== selection.current) { URL.revokeObjectURL(url); return; }
      URL.revokeObjectURL(url); setMessage(t.montage.videoUnreadable);
      logUpload("metadata_error", { ...fileDetails, mediaError: video.error?.code, reason: "video_metadata_error" }, id);
    };
    video.src = url;
    video.load();
  }
  async function uploadAndGenerate() {
    if (!authorized) return;
    if (!selectedVideo) { setMessage(t.montage.chooseVideo); return; }
    const { file, contentType, traceId: uploadTraceId } = selectedVideo;
    setMessage(""); logUpload("upload_started", { contentType, size: file.size }, uploadTraceId);
    const created = await fetch("/api/projects", { method: "POST" });
    const createdData = await created.json() as ProjectResponse;
    if (!created.ok || !createdData.project) { setMessage(createdData.error || t.montage.createFailed); return; }
    setProject(createdData.project); setUploading(1);
    const uploaded = await new Promise<boolean>((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", `/api/projects/${createdData.project!.id}/input`);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.setRequestHeader("X-Upload-Trace-Id", uploadTraceId);
      xhr.upload.onprogress = (event) => { if (event.lengthComputable) setUploading(Math.round(event.loaded / event.total * 100)); };
      xhr.onload = () => { const data = JSON.parse(xhr.responseText || "{}") as { error?: string }; if (!(xhr.status >= 200 && xhr.status < 300)) setMessage(data.error || t.montage.uploadFailed); resolve(xhr.status >= 200 && xhr.status < 300); };
      xhr.onerror = () => { setMessage(t.montage.uploadFailed); resolve(false); };
      xhr.send(file);
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
    <div className={styles.colorCarousel}>
      {canScrollColorsLeft && <button type="button" className={`${styles.colorArrow} ${styles.colorArrowLeft}`} aria-label={t.montage.previousColors} onClick={() => scrollColors(-1)}><span aria-hidden="true">‹</span></button>}
      <div className={styles.colors} ref={colorScroller}>{montageColors.map((color, index) => <button type="button" key={color} data-color={color} aria-pressed={settings.color === color} className={settings.color === color ? styles.colorActive : ""} onClick={() => save({ ...settings, color })}><i data-color={color} />{t.montage.colors[index]}</button>)}</div>
      {canScrollColorsRight && <button type="button" className={`${styles.colorArrow} ${styles.colorArrowRight}`} aria-label={t.montage.nextColors} onClick={() => scrollColors(1)}><span aria-hidden="true">›</span></button>}
    </div>
    <div className={styles.sectionTitle}><strong>{t.montage.video}</strong><button type="button" className={styles.requirementsLink} onClick={() => setRequirementsOpen(true)}><Icon name="help" /> {t.montage.requirements}</button></div>
    <label className={styles.upload} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const id = createTrace(); selectFile(event.dataTransfer.files[0], id); }}><input ref={fileInput} type="file" accept="video/mp4,video/quicktime,video/x-matroska,video/webm" onClick={() => { const id = createTrace(); logUpload("picker_opened", {}, id); }} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; selectFile(file); }} /><Icon name="upload" /><div><b>{selectedVideo ? selectedVideo.file.name : t.montage.upload}</b><span>{uploading ? `${language === "ru" ? "Загрузка" : "Uploading"} ${uploading}%` : t.montage.uploadHint}</span></div></label>
    {message && <p className={styles.status} role="status">{message}</p>}
    <Toggle {...options[0]} help={() => setHelpOption(options[0])} value={settings.trimVideo} change={(value) => save({ ...settings, trimVideo: value })} featured />
    <div className={styles.sectionTitle}><strong>{t.montage.parameters}</strong></div>
    {options.slice(1).map((option) => <Toggle key={option.key} label={option.label} help={() => setHelpOption(option)} value={settings[option.key]} change={(value) => save({ ...settings, [option.key]: value })} />)}
    <button className={styles.generate} onClick={needsTopUp ? onSelectBalance : uploadAndGenerate} disabled={!authorized || authPending || busy}>{authPending ? t.montage.connecting : busy ? t.montage.processing : trialAvailable ? t.montage.trial : needsTopUp ? t.montage.topUp : t.montage.generate}<small>{authPending ? t.profile.profile : trialAvailable ? t.montage.trialHint : needsTopUp ? t.montage.topUpHint(23 - balance) : `23 ${t.montage.tokens}`}</small></button>
    <p className={styles.balanceSummary}><span>{t.montage.balance}</span> {authorized ? balance : "—"} {t.montage.tokens}</p>
    {authError && <p className={styles.status} role="status">{authError}</p>}
    {nav}
    {requirementsOpen && <VideoRequirements language={language} onClose={closeOverlay} />}
    {helpOption && <OptionHelp language={language} option={helpOption} onClose={closeOverlay} />}
    {introOpen && <div className={styles.modalBack} onMouseDown={closeOverlay}><section className={styles.modal} onMouseDown={(event) => event.stopPropagation()}><div className={styles.modalVideo}>{preview ? <video src={preview} controls playsInline autoPlay /> : <div className={styles.demo}><span>{t.montage.introTitle}</span><b>Reels</b><em>{t.montage.introSubtitle}</em></div>}</div><button onClick={closeOverlay}>{t.montage.introClose}</button></section></div>}
  </>;
}

function Toggle({ label, help, value, change, featured = false }: { label: string; help(): void; value: boolean; change(value: boolean): void; featured?: boolean }) {
  return <div className={styles.toggleRow}><span>{featured && <b className={styles.new}>NEW</b>}{label}<button type="button" className={styles.hint} aria-label={`Подробнее: ${label}`} aria-haspopup="dialog" onClick={help}><Icon name="help" /></button></span><button aria-label={label} aria-pressed={value} className={`${styles.switch} ${value ? styles.switchOn : ""}`} onClick={() => change(!value)}><i /></button></div>;
}
