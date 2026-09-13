"use client";

import { useEffect, useState, type ReactNode } from "react";
import { copy, type MiniAppLanguage } from "./i18n";
import styles from "@/app/mini-app/page.module.css";

type ReferralData = {
  link: string;
  balance: number;
  invitedCount: number;
  earnedTokens: number;
  last7Days: { date: string; invited: number; payments: number }[];
};

export default function InviteScreen({ language, authorized, authPending, header, nav, onBalance }: { language: MiniAppLanguage; authorized: boolean; authPending: boolean; header: ReactNode; nav: ReactNode; onBalance(balance: number): void }) {
  const [data, setData] = useState<ReferralData>();
  const [loadError, setLoadError] = useState("");
  const [copyError, setCopyError] = useState("");
  const [copied, setCopied] = useState(false);
  const t = copy[language].invite;

  useEffect(() => {
    if (authPending || !authorized) return;
    const controller = new AbortController();
    void fetch("/api/referrals", { signal: controller.signal }).then(async (response) => {
      const payload = await response.json() as ReferralData & { error?: string };
      if (!response.ok) throw new Error(payload.error || "referral_request_failed");
      if (!controller.signal.aborted) { setData(payload); onBalance(payload.balance); }
    }).catch((requestError: unknown) => {
      if (!controller.signal.aborted) setLoadError(requestError instanceof Error ? requestError.message : "referral_request_failed");
    });
    return () => controller.abort();
  }, [authorized, authPending, onBalance]);

  if (authPending) return <main className={styles.inviteScreen}>{header}<p className={styles.inviteLoading}>{t.loading}</p>{nav}</main>;
  if (!authorized) return <main className={styles.inviteScreen}>{header}<p className={styles.inviteLoading}>{t.unavailable}</p>{nav}</main>;
  if (loadError || !data) return <main className={styles.inviteScreen}>{header}<p className={styles.inviteLoading} role="alert">{loadError || t.loading}</p>{nav}</main>;

  const chartMax = Math.max(1, ...data.last7Days.flatMap((day) => [day.invited, day.payments]));
  const hasActivity = data.last7Days.some((day) => day.invited || day.payments);
  const dateLabel = (date: string) => new Intl.DateTimeFormat(language === "ru" ? "ru-RU" : "en-US", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
  const share = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(data.link)}&text=${encodeURIComponent(t.shareText)}`;
    if (window.Telegram?.WebApp?.openTelegramLink) window.Telegram.WebApp.openTelegramLink(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(data.link); setCopyError(""); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setCopyError(t.copyFailed); }
  };

  return <main className={styles.inviteScreen}>
    {header}
    <h1>{t.title}</h1><p className={styles.inviteLead}>{t.subtitle}</p>
    <section className={styles.inviteLinkCard}>
      <strong>{t.link}</strong><p>{data.link}</p>
      <div><button className={styles.inviteShare} onClick={share}>{t.share}</button><button className={styles.inviteCopy} onClick={copyLink}>{copied ? t.copied : t.copy}</button></div>
    </section>
    <section className={styles.inviteStats}>
      <article><b>{data.invitedCount}</b><span>{t.invited}</span></article>
      <article><b>{data.earnedTokens}</b><span>{t.earned}</span></article>
    </section>
    <section className={styles.inviteChartCard}>
      <strong>{t.sevenDays}</strong>
      {!hasActivity ? <p>{t.empty}</p> : <><div className={styles.inviteLegend}><span><i data-kind="invited" />{t.invitedLegend}</span><span><i data-kind="payments" />{t.paymentsLegend}</span></div><div className={styles.inviteChart}>{data.last7Days.map((day) => <div key={day.date} aria-label={`${dateLabel(day.date)}: ${day.invited} ${t.invitedLegend}, ${day.payments} ${t.paymentsLegend}`}><section><i data-kind="invited" style={{ height: `${day.invited / chartMax * 100}%` }} /><i data-kind="payments" style={{ height: `${day.payments / chartMax * 100}%` }} /></section><span>{dateLabel(day.date)}</span></div>)}</div></>}
    </section>
    {copyError && <p className={styles.status} role="alert">{copyError}</p>}
    {nav}
  </main>;
}
