"use client";

import { useCallback, useEffect, useState } from "react";
import { defaultMontageSettings } from "@/src/domain/montage";
import type { AuthorizationResponse } from "@/src/domain/api";
import { AppHeader, BottomNav, type MiniAppTab } from "./AppShell";
import BalanceScreen from "./BalanceScreen";
import InviteScreen from "./InviteScreen";
import MontageScreen from "./MontageScreen";
import ProfileScreen from "./ProfileScreen";
import VideosScreen from "./VideosScreen";
import { type MiniAppLanguage } from "./i18n";
import { telegramWebApp } from "./telegram";
import styles from "@/app/mini-app/page.module.css";

export default function MiniApp() {
  const [dark, setDark] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [authPending, setAuthPending] = useState(true);
  const [authError, setAuthError] = useState("");
  const [balance, setBalance] = useState(0);
  const [trialAvailable, setTrialAvailable] = useState(false);
  const [settings, setSettings] = useState(defaultMontageSettings);
  const [tab, setTab] = useState<MiniAppTab>("montage");
  const [language, setLanguage] = useState<MiniAppLanguage>("ru");
  const [balanceHistory, setBalanceHistory] = useState(false);
  const [profileSupport, setProfileSupport] = useState(false);
  const closeOverlay = useCallback(() => { setBalanceHistory(false); setProfileSupport(false); }, []);
  const applyPaymentState = useCallback((state: { balance: number; trialAvailable: boolean }) => { setBalance(state.balance); setTrialAvailable(state.trialAvailable); }, []);
  useEffect(() => {
    const app = telegramWebApp();
    app?.ready(); app?.expand();
    const button = app?.BackButton;
    button?.onClick(closeOverlay);
    return () => button?.offClick(closeOverlay);
  }, [closeOverlay]);
  useEffect(() => { const button = telegramWebApp()?.BackButton; if (balanceHistory || profileSupport) button?.show(); else button?.hide(); }, [balanceHistory, profileSupport]);
  useEffect(() => {
    const app = telegramWebApp();
    if (!app?.initData) {
      setAuthPending(false);
      setAuthError(app ? "Telegram не передал данные для входа. Откройте приложение через кнопку меню бота." : "Не удалось загрузить Telegram. Проверьте соединение и переоткройте приложение.");
      return;
    }
    const controller = new AbortController();
    async function authorize() {
      try {
        const response = await fetch("/api/auth/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData: app!.initData }), signal: controller.signal });
        if (!response.ok) { setAuthError(response.status === 401 ? "Не удалось подтвердить Telegram-профиль. Закройте и снова откройте приложение из меню бота." : "Сервис входа временно недоступен. Попробуйте открыть приложение позже."); return; }
        const data = await response.json() as AuthorizationResponse;
        if (controller.signal.aborted) return;
        setAuthorized(true); setBalance(data.user.balance); setTrialAvailable(data.user.trialAvailable);
        setLanguage(data.user.language === "en" ? "en" : "ru"); setSettings(data.settings); setAuthError("");
      } catch {
        if (!controller.signal.aborted) setAuthError("Не удалось связаться с сервером. Проверьте соединение и переоткройте приложение.");
      } finally {
        if (!controller.signal.aborted) setAuthPending(false);
      }
    }
    void authorize();
    return () => controller.abort();
  }, []);

  const header = <AppHeader authorized={authorized} balance={balance} dark={dark} language={language} onDarkChange={() => setDark((value) => !value)} />;
  const nav = (active: MiniAppTab) => <BottomNav active={active} balance={authorized ? balance : undefined} language={language} onSelect={setTab} />;
  const appClass = `${styles.app} ${dark ? styles.dark : ""}`;

  if (tab === "balance") return <section className={appClass}><BalanceScreen language={language} balance={balance} authorized={authorized} authPending={authPending} header={header} historyOpen={balanceHistory} setHistoryOpen={setBalanceHistory} onState={applyPaymentState} nav={nav("balance")} /></section>;
  if (tab === "invite") return <section className={appClass}><InviteScreen language={language} authorized={authorized} authPending={authPending} header={header} onBalance={setBalance} nav={nav("invite")} /></section>;
  if (tab === "profile") return <section className={appClass}><ProfileScreen authorized={authorized} header={header} language={language} onLanguage={setLanguage} onBalance={() => setTab("balance")} supportOpen={profileSupport} setSupportOpen={setProfileSupport} nav={nav("profile")} /></section>;
  if (tab === "videos") return <VideosScreen authorized={authorized} authPending={authPending} header={header} language={language} nav={nav("videos")} />;
  return <section className={appClass}><MontageScreen authorized={authorized} authPending={authPending} authError={authError} balance={balance} initialSettings={settings} language={language} trialAvailable={trialAvailable} header={header} nav={nav("montage")} onBalanceChange={(change) => setBalance(change)} onSelectBalance={() => setTab("balance")} onTrialAvailableChange={setTrialAvailable} /></section>;
}
