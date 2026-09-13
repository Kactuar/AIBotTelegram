import type { ReactNode } from "react";
import { copy, type MiniAppLanguage } from "./i18n";
import styles from "./shell.module.css";

export type MiniAppTab = "invite" | "videos" | "montage" | "balance" | "profile";
export type IconName = "moon" | "coins" | "play" | "upload" | "spark" | "people" | "films" | "profile" | "help" | "support" | "channel";

export function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = { moon: <path d="M18.5 14.6A7 7 0 0 1 9.4 5.5 7 7 0 1 0 18.5 14.6Z" />, coins: <><ellipse cx="12" cy="6" rx="6.5" ry="3" /><path d="M5.5 6v5c0 1.7 13 1.7 13 0V6m-13 5v5c0 1.7 13 1.7 13 0v-5" /></>, play: <path d="m9 7 7 5-7 5V7Z" fill="currentColor" stroke="none" />, upload: <><path d="M12 16V4m0 0L8 8m4-4 4 4M5 16v3h14v-3" /></>, spark: <g fill="currentColor" stroke="none"><path d="m10 5 2.2 6.8L19 14l-6.8 2.2L10 23l-2.2-6.8L1 14l6.8-2.2Z" /><path d="m19 1 1.1 3.9L24 6l-3.9 1.1L19 11l-1.1-3.9L14 6l3.9-1.1Z" /></g>, people: <><circle cx="9" cy="7" r="3.5" /><path d="M2 21v-2a7 7 0 0 1 14 0v2M19 6v6m-3-3h6" /></>, films: <><rect x="3" y="8" width="18" height="13" rx="3" /><path d="M6 5h12M9 2h6m-5 10 5 3-5 3Z" /></>, profile: <><circle cx="12" cy="8" r="3" /><path d="M5 20c.5-3.3 3-5 7-5s6.5 1.7 7 5" /></>, support: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="m5.6 5.6 3.6 3.6m5.6 5.6 3.6 3.6m-3.6-9.2 3.6-3.6m-9.2 9.2-3.6 3.6" /></>, channel: <><path d="m14 4-7 4H3v8h4l7 4V4ZM7 16l2 5H6l-2-5m14-8a7 7 0 0 1 0 8" /></>, help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.7 2.7 0 1 1 4.5 2c-1 .9-2 1.5-2 3M12 17h.01" /></> };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

export function AppHeader({ authorized, balance, dark, language, onDarkChange }: { authorized: boolean; balance: number; dark: boolean; language: MiniAppLanguage; onDarkChange(): void }) {
  return <header className={`${styles.header} ${dark ? styles.headerDark : ""}`}><strong>Brandly<span>.</span></strong><div><button aria-label={copy[language].common.darkTheme} className={styles.roundButton} onClick={onDarkChange}><Icon name="moon" /></button><button className={styles.balance}><Icon name="coins" />{authorized ? balance : "—"}</button></div></header>;
}

export function BottomNav({ active, balance, language, onSelect }: { active: MiniAppTab; balance?: number; language: MiniAppLanguage; onSelect(tab: MiniAppTab): void }) {
  const labels = copy[language].nav;
  const items: [MiniAppTab, IconName][] = [["invite", "people"], ["videos", "films"], ["montage", "spark"], ["balance", "coins"], ["profile", "profile"]];
  return <nav className={styles.nav}>{items.map(([key, icon]) => <button key={key} aria-current={active === key ? "page" : undefined} className={`${active === key ? styles.navActive : ""} ${key === "montage" ? styles.navMontage : ""}`} onClick={() => onSelect(key)}><Icon name={icon} /><span>{labels[key]}</span>{key === "balance" && balance !== undefined && <em>{balance}</em>}</button>)}</nav>;
}
