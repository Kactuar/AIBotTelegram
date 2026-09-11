"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MontageColor, MontageSettings, ProjectRecord } from "@/src/montage/types";
import { defaultMontageSettings } from "@/src/montage/types";
import VideoRequirements from "./VideoRequirements";
import OptionHelp, { getToggles } from "./OptionHelp";
import BalanceScreen from "./BalanceScreen";
import ProfileScreen from "./ProfileScreen";
import { copy, type MiniAppLanguage } from "./i18n";
import styles from "@/app/mini-app/page.module.css";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready(): void;
        expand(): void;
        BackButton?: { show(): void; hide(): void; onClick(listener: () => void): void; offClick(listener: () => void): void };
        showConfirm?(message: string, callback: (confirmed: boolean) => void): void;
        openInvoice?(url: string, callback: (status: "paid" | "cancelled" | "failed" | "pending") => void): void;
        openLink?(url: string): void;
        openTelegramLink?(url: string): void;
      };
    };
  }
}

const colors: MontageColor[] = ["amber", "azure", "lime", "crimson"];

export function Icon({ name }: { name: "moon" | "coins" | "play" | "upload" | "spark" | "people" | "films" | "profile" | "help" }) {
  const paths: Record<string, React.ReactNode> = { moon: <path d="M18.5 14.6A7 7 0 0 1 9.4 5.5 7 7 0 1 0 18.5 14.6Z" />, coins: <><ellipse cx="12" cy="6" rx="6.5" ry="3" /><path d="M5.5 6v5c0 1.7 13 1.7 13 0V6m-13 5v5c0 1.7 13 1.7 13 0v-5" /></>, play: <path d="m9 7 7 5-7 5V7Z" fill="currentColor" stroke="none" />, upload: <><path d="M12 16V4m0 0L8 8m4-4 4 4M5 16v3h14v-3" /></>, spark: <g fill="currentColor" stroke="none"><path d="m10 5 2.2 6.8L19 14l-6.8 2.2L10 23l-2.2-6.8L1 14l6.8-2.2Z" /><path d="m19 1 1.1 3.9L24 6l-3.9 1.1L19 11l-1.1-3.9L14 6l3.9-1.1Z" /></g>, people: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5M17 9a2.5 2.5 0 1 0 0-5m1.5 16c0-2.3-1.2-4-3.1-4.7" /></>, films: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 5v14m8-14v14M4 9h4m8 0h4" /></>, profile: <><circle cx="12" cy="8" r="3" /><path d="M5 20c.5-3.3 3-5 7-5s6.5 1.7 7 5" /></>, help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.7 2.7 0 1 1 4.5 2c-1 .9-2 1.5-2 3M12 17h.01" /></> };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export default function MiniApp() {
  const [settings, setSettings] = useState(defaultMontageSettings); const [dark, setDark] = useState(false); const [preview, setPreview] = useState<string>(); const [selectedFile, setSelectedFile] = useState<File>(); const [modal, setModal] = useState(false); const [authorized, setAuthorized] = useState(false); const [allowed, setAllowed] = useState(false); const [balance, setBalance] = useState(0); const [project, setProject] = useState<ProjectRecord>(); const [uploading, setUploading] = useState(0); const [message, setMessage] = useState(""); const [tab, setTab] = useState("montage"); const [language, setLanguage] = useState<MiniAppLanguage>("ru"); const fileInput = useRef<HTMLInputElement>(null);
  const [requirementsOpen, setRequirementsOpen] = useState(false);
  const [helpOption, setHelpOption] = useState<ReturnType<typeof getToggles>[number]>();
  const [authPending, setAuthPending] = useState(true); const [trialAvailable, setTrialAvailable] = useState(false); const [balanceHistory, setBalanceHistory] = useState(false);
  const [authError, setAuthError] = useState(""); const [profileSupport, setProfileSupport] = useState(false);
  const t = copy[language]; const options = getToggles(language);
  const closeModal = useCallback(() => { setModal(false); setRequirementsOpen(false); setHelpOption(undefined); setBalanceHistory(false); setProfileSupport(false); }, []);
  useEffect(() => { const app = window.Telegram?.WebApp; app?.ready(); app?.expand(); if (!localStorage.getItem("aibot_intro_seen")) { setModal(true); localStorage.setItem("aibot_intro_seen", "1"); } const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") closeModal(); }; window.addEventListener("keydown", onEscape); app?.BackButton?.onClick(closeModal); return () => { window.removeEventListener("keydown", onEscape); app?.BackButton?.offClick(closeModal); }; }, [closeModal]);
  useEffect(() => { const button = window.Telegram?.WebApp?.BackButton; if (modal || requirementsOpen || helpOption || balanceHistory || profileSupport) button?.show(); else button?.hide(); }, [modal, requirementsOpen, helpOption, balanceHistory, profileSupport]);
  useEffect(() => {
    const app = window.Telegram?.WebApp;
    if (!app?.initData) {
      setAuthPending(false);
      setAuthError(app ? "Telegram не передал данные для входа. Откройте приложение через кнопку меню бота." : "Не удалось загрузить Telegram. Проверьте соединение и переоткройте приложение.");
      return;
    }
    const controller = new AbortController();
    async function authorize() {
      try {
        const response = await fetch("/api/auth/telegram", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: app!.initData }), signal: controller.signal,
        });
        if (!response.ok) {
          setAuthError(response.status === 401 ? "Не удалось подтвердить Telegram-профиль. Закройте и снова откройте приложение из меню бота." : "Сервис входа временно недоступен. Попробуйте открыть приложение позже.");
          return;
        }
        const data = await response.json();
        if (controller.signal.aborted) return;
        setAuthorized(true);
        setAllowed(data.user.allowed);
        setBalance(data.user.balance);
        setTrialAvailable(data.user.trialAvailable);
        setLanguage(data.user.language === "en" ? "en" : "ru");
        setSettings(data.settings);
        setAuthError("");
      } catch {
        if (!controller.signal.aborted) setAuthError("Не удалось связаться с сервером. Проверьте соединение и переоткройте приложение.");
      } finally {
        if (!controller.signal.aborted) setAuthPending(false);
      }
    }
    void authorize();
    return () => controller.abort();
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { if (!project || !["queued", "processing"].includes(project.status)) return; const timer = window.setInterval(async () => { const response = await fetch(`/api/projects/${project.id}`); const data = await response.json(); if (data.project) { setProject(data.project); if (data.project.status === "completed") setMessage(t.montage.projectReady); if (data.project.status === "failed") setMessage(t.montage.projectFailed); } }, 5000); return () => window.clearInterval(timer); }, [project?.id, project?.status, language]);
  function save(next: MontageSettings) { setSettings(next); if (authorized) fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }); }
  async function selectFile(file?: File) { if (!file) return; if (!/^video\/(mp4|quicktime|x-matroska|webm)$/.test(file.type) || file.size > 100 * 1024 * 1024) { setMessage(t.montage.fileInvalid); return; } const url = URL.createObjectURL(file); const video = document.createElement("video"); video.src = url; video.onloadedmetadata = () => { if (video.duration < 2 || video.duration > 30 || video.videoHeight <= video.videoWidth) { URL.revokeObjectURL(url); setMessage(t.montage.videoInvalid); return; } if (preview) URL.revokeObjectURL(preview); setPreview(url); setSelectedFile(file); setMessage(t.montage.ready); }; video.onerror = () => { URL.revokeObjectURL(url); setMessage(t.montage.videoUnreadable); }; }
  async function uploadAndGenerate() { if (!authorized) return; if (!selectedFile) { setMessage(t.montage.chooseVideo); return; } const created = await fetch("/api/projects", { method: "POST" }); const createdData = await created.json(); if (!created.ok) { setMessage(createdData.error || t.montage.createFailed); return; } setProject(createdData.project); setUploading(1); const uploaded = await new Promise<boolean>((resolve) => { const xhr = new XMLHttpRequest(); xhr.open("PUT", `/api/projects/${createdData.project.id}/input`); xhr.setRequestHeader("Content-Type", selectedFile.type); xhr.upload.onprogress = (event) => { if (event.lengthComputable) setUploading(Math.round(event.loaded / event.total * 100)); }; xhr.onload = () => { if (!(xhr.status >= 200 && xhr.status < 300)) setMessage(JSON.parse(xhr.responseText || "{}").error || t.montage.uploadFailed); resolve(xhr.status >= 200 && xhr.status < 300); }; xhr.onerror = () => { setMessage(t.montage.uploadFailed); resolve(false); }; xhr.send(selectedFile); }); if (!uploaded) { setUploading(0); return; } const queued = await fetch(`/api/projects/${createdData.project.id}/generate`, { method: "POST" }); const queuedData = await queued.json(); setUploading(0); if (!queued.ok) { setMessage(queuedData.error || t.montage.queueFailed); return; } setProject((current) => current ? { ...current, status: "queued" } : current); if (queuedData.cost) setBalance((value) => value - queuedData.cost); if (queuedData.trial) setTrialAvailable(false); setMessage(queuedData.trial ? t.montage.trialQueued : t.montage.queued); }
  const needsTopUp = authorized && balance < 23 && !trialAvailable;
  const busy = uploading > 0 || ["queued", "processing"].includes(project?.status || "");
  const header = <header className={styles.header}><strong>Brandly<span>.</span></strong><div><button aria-label={t.common.darkTheme} className={styles.roundButton} onClick={() => setDark(!dark)}><Icon name="moon" /></button><button className={styles.balance}><Icon name="coins" />{balance}</button></div></header>;
  if (tab === "balance") return <section className={`${styles.app} ${dark ? styles.dark : ""}`}><BalanceScreen language={language} balance={balance} authorized={authorized} authPending={authPending} header={header} historyOpen={balanceHistory} setHistoryOpen={setBalanceHistory} onState={(state) => { setBalance(state.balance); setTrialAvailable(state.trialAvailable); }} nav={<Nav language={language} active="balance" select={setTab} balance={authorized ? balance : undefined} />} /></section>;
  if (tab === "profile") return <section className={`${styles.app} ${dark ? styles.dark : ""}`}><ProfileScreen authorized={authorized} header={header} language={language} onLanguage={setLanguage} onBalance={() => setTab("balance")} supportOpen={profileSupport} setSupportOpen={setProfileSupport} nav={<Nav language={language} active="profile" select={setTab} balance={authorized ? balance : undefined} />} /></section>;
  if (tab !== "montage") return <section className={styles.placeholder}><h1>{t.nav[tab as "videos" | "invite"]}</h1><p>{t.common.comingSoon}</p><button onClick={() => setTab("montage")}>{t.nav.montage}</button><Nav language={language} active={tab} select={setTab} balance={authorized ? balance : undefined} /></section>;
  return <section className={`${styles.app} ${dark ? styles.dark : ""}`}>{header}<section className={styles.preview} data-color={settings.color}>{preview ? <video src={preview} controls playsInline /> : <div className={styles.demo}><span>{language === "ru" ? "Это пример" : "Subtitle"}</span><b>{language === "ru" ? "субтитров" : "preview"}</b><em>{language === "ru" ? "в стиле Glass" : "in Glass style"}</em></div>}<button className={styles.play} onClick={() => setModal(true)} aria-label={t.common.close}><Icon name="play" /></button></section><div className={styles.styles}><button className={styles.activeStyle}>Glass</button><button disabled>Poster <small>{t.montage.stylesSoon}</small></button><button disabled>Editorial <small>{t.montage.stylesSoon}</small></button></div><div className={styles.colors}>{colors.map((color, index) => <button key={color} className={settings.color === color ? styles.colorActive : ""} onClick={() => save({ ...settings, color })}><i data-color={color} />{t.montage.colors[index]}</button>)}</div><div className={styles.sectionTitle}><strong>{t.montage.video}</strong><button type="button" className={styles.requirementsLink} onClick={() => setRequirementsOpen(true)}><Icon name="help" /> {t.montage.requirements}</button></div><label className={styles.upload} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); selectFile(event.dataTransfer.files[0]); }}><input ref={fileInput} type="file" accept="video/mp4,video/quicktime,video/x-matroska,video/webm" onChange={(event) => selectFile(event.target.files?.[0])} /><Icon name="upload" /><div><b>{selectedFile ? selectedFile.name : t.montage.upload}</b><span>{uploading ? `${language === "ru" ? "Загрузка" : "Uploading"} ${uploading}%` : t.montage.uploadHint}</span></div></label><Toggle {...options[0]} help={() => setHelpOption(options[0])} value={settings.trimVideo} change={(value) => save({ ...settings, trimVideo: value })} featured /><div className={styles.sectionTitle}><strong>{t.montage.parameters}</strong></div>{options.slice(1).map((option) => <Toggle key={option.key} label={option.label} help={() => setHelpOption(option)} value={settings[option.key]} change={(value) => save({ ...settings, [option.key]: value })} />)}
    <button className={styles.generate} onClick={needsTopUp ? () => setTab("balance") : uploadAndGenerate} disabled={!authorized || authPending || busy}>
      {authPending ? t.montage.connecting : busy ? t.montage.processing : trialAvailable ? t.montage.trial : needsTopUp ? t.montage.topUp : t.montage.generate}
      <small>{authPending ? t.profile.profile : trialAvailable ? t.montage.trialHint : needsTopUp ? t.montage.topUpHint(23 - balance) : `23 ${t.montage.tokens}`}</small>
    </button>
    <p className={styles.balanceSummary}><span>{t.montage.balance}</span> {authorized ? balance : "—"} {t.montage.tokens}</p>
    {(authError || message) && <p className={styles.status} role="status">{authError || message}</p>}
    <Nav language={language} active="montage" select={setTab} balance={authorized ? balance : undefined} />{requirementsOpen && <VideoRequirements language={language} onClose={closeModal} />}{helpOption && <OptionHelp language={language} option={helpOption} onClose={closeModal} />}{modal && <div className={styles.modalBack} onMouseDown={closeModal}><section className={styles.modal} onMouseDown={(event) => event.stopPropagation()}><div className={styles.modalVideo}>{preview ? <video src={preview} controls playsInline autoPlay /> : <div className={styles.demo}><span>{t.montage.introTitle}</span><b>Reels</b><em>{t.montage.introSubtitle}</em></div>}</div><button onClick={closeModal}>{t.montage.introClose}</button></section></div>}</section>;
}

function Toggle({ label, help, value, change, featured = false }: { label: string; help(): void; value: boolean; change(value: boolean): void; featured?: boolean }) { return <div className={styles.toggleRow}><span>{featured && <b className={styles.new}>NEW</b>}{label}<button type="button" className={styles.hint} aria-label={`Подробнее: ${label}`} aria-haspopup="dialog" onClick={help}><Icon name="help" /></button></span><button aria-label={label} aria-pressed={value} className={`${styles.switch} ${value ? styles.switchOn : ""}`} onClick={() => change(!value)}><i /></button></div>; }
function Nav({ active, select, balance, language }: { active: string; select(tab: string): void; balance?: number; language: MiniAppLanguage }) { const labels = copy[language].nav; return <nav className={styles.nav}>{[["invite", "people"], ["videos", "films"], ["montage", "spark"], ["balance", "coins"], ["profile", "profile"]].map(([key, icon]) => <button key={key} aria-current={active === key ? "page" : undefined} className={`${active === key ? styles.navActive : ""} ${key === "montage" ? styles.navMontage : ""}`} onClick={() => select(key)}><Icon name={icon as Parameters<typeof Icon>[0]["name"]} /><span>{labels[key as keyof typeof labels]}</span>{key === "balance" && balance !== undefined && <em>{balance}</em>}</button>)}</nav>; }
