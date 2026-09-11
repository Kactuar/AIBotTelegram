"use client";

import { useEffect, useState, type ReactNode } from "react";
import { copy, type MiniAppLanguage } from "./i18n";
import { Icon } from "./MiniApp";
import styles from "@/app/mini-app/page.module.css";

type Profile = { firstName?: string; username?: string; language: MiniAppLanguage; completedVideos: number };
type Links = { supportUrl?: string; officialChannelUrl?: string };

export default function ProfileScreen({ authorized, header, nav, language, onLanguage, onBalance, supportOpen, setSupportOpen }: {
  authorized: boolean; header: ReactNode; nav: ReactNode; language: MiniAppLanguage;
  onLanguage(language: MiniAppLanguage): void; onBalance(): void; supportOpen: boolean; setSupportOpen(value: boolean): void;
}) {
  const [profile, setProfile] = useState<Profile>();
  const [links, setLinks] = useState<Links>({});
  const [expanded, setExpanded] = useState<number>();
  const [message, setMessage] = useState("");
  const t = copy[language];

  useEffect(() => {
    if (!authorized) return;
    let active = true;
    void fetch("/api/profile").then(async (response) => response.ok ? response.json() : undefined).then((data) => {
      if (!active || !data) return;
      setProfile(data.profile); setLinks(data.links);
      if (data.profile.language !== language) onLanguage(data.profile.language);
    });
    return () => { active = false; };
  }, [authorized]);

  const setLocale = async (next: MiniAppLanguage) => {
    if (next === language) return;
    onLanguage(next);
    const response = await fetch("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ language: next }) });
    if (!response.ok) { onLanguage(language); setMessage(t.common.unavailable); }
  };
  const open = (url: string | undefined) => {
    if (!url) { setMessage(t.common.comingSoon); return; }
    const app = window.Telegram?.WebApp;
    if (/^(https?:\/\/)?t\.me\//i.test(url) && app?.openTelegramLink) app.openTelegramLink(url);
    else if (app?.openLink) app.openLink(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  };

  if (supportOpen) return <>
    {header}
    <section className={styles.supportScreen}>
      <button className={styles.backButton} onClick={() => { setSupportOpen(false); setExpanded(undefined); }}>{t.common.back} <span>{t.profile.profile}</span></button>
      <h1>{t.support.title}</h1><p className={styles.supportLead}>{t.support.subtitle}</p>
      <section className={styles.faqCard}>{t.support.questions.map((item, index) => <article key={item.question}>
        <button aria-expanded={expanded === index} onClick={() => setExpanded(expanded === index ? undefined : index)}><b>{item.question}</b><span aria-hidden="true">⌄</span></button>
        {expanded === index && <p>{item.answer}</p>}
      </article>)}</section>
      <button className={styles.supportContact} onClick={() => open(links.supportUrl)}>{t.support.contact}</button>
      {message && <p className={styles.status} role="status">{message}</p>}
    </section>{nav}
  </>;

  const name = profile?.firstName || t.profile.noUsername;
  return <>{header}<section className={styles.profileScreen}>
    <section className={styles.profileIdentity}><h1>{name}</h1>{profile?.username && <p>@{profile.username}</p>}</section>
    <section className={styles.profileCount}><span className={styles.profileIcon}><Icon name="films" /></span><div><b>{profile ? profile.completedVideos : "—"}</b><p>{profile ? t.profile.completed(profile.completedVideos) : t.profile.videos(0)}</p></div></section>
    <section className={styles.profileList}>
      <button onClick={onBalance}><span><Icon name="coins" />{t.profile.topUp}</span><i>›</i></button>
      <button onClick={() => setSupportOpen(true)}><span><Icon name="help" />{t.profile.support}</span><i>›</i></button>
      <button onClick={() => open(links.officialChannelUrl)}><span><Icon name="people" />{t.profile.channel}</span><i>›</i></button>
    </section>
    <section className={styles.languageRow}><b>{t.profile.language}</b><div role="group" aria-label={t.profile.language}><button aria-pressed={language === "ru"} onClick={() => void setLocale("ru")}>Русский</button><button aria-pressed={language === "en"} onClick={() => void setLocale("en")}>English</button></div></section>
    <h2 className={styles.profileLabel}>{t.profile.documents}</h2>
    <section className={styles.profileList}><a href={`/offer?lang=${language}`}><span>{t.profile.offer}</span><i>›</i></a><a href={`/privacy?lang=${language}`}><span>{t.profile.privacy}</span><i>›</i></a></section>
    {message && <p className={styles.status} role="status">{message}</p>}
  </section>{nav}</>;
}
