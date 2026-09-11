"use client";

import { useEffect, useState, type ReactNode } from "react";
import { paymentMethods, paymentPackages, priceFor, type PaymentMethod, type PaymentOperation } from "@/src/lib/payments";
import { copy, type MiniAppLanguage } from "./i18n";
import styles from "@/app/mini-app/page.module.css";

type State = { balance: number; trialAvailable: boolean; paymentEnabled: boolean; operations: PaymentOperation[] };

export default function BalanceScreen({ balance, authorized, authPending, header, nav, historyOpen, setHistoryOpen, onState, language }: {
  balance: number; authorized: boolean; authPending: boolean; header: ReactNode; nav: ReactNode; historyOpen: boolean; setHistoryOpen(value: boolean): void; language: MiniAppLanguage;
  onState(state: Pick<State, "balance" | "trialAvailable">): void;
}) {
  const [selectedPackage, setSelectedPackage] = useState("active"); const [method, setMethod] = useState<PaymentMethod>("ru_card"); const [accepted, setAccepted] = useState(false); const [operations, setOperations] = useState<PaymentOperation[]>([]); const [paymentEnabled, setPaymentEnabled] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const item = paymentPackages.find((value) => value.id === selectedPackage) || paymentPackages[1]; const t = copy[language].balance;
  const refresh = async () => { const response = await fetch("/api/payments"); if (!response.ok) return; const data = await response.json() as State; setOperations(data.operations); setPaymentEnabled(data.paymentEnabled); onState(data); };
  useEffect(() => { if (authorized) void refresh(); }, [authorized]);
  const confirm = () => new Promise<boolean>((resolve) => { const app = window.Telegram?.WebApp; if (app?.showConfirm) app.showConfirm(t.mockConfirm, resolve); else resolve(window.confirm(t.mockConfirm)); });
  const complete = async (id: string, status: "paid" | "cancelled" | "failed") => { const response = await fetch(`/api/payments/intents/${id}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || t.operationFailed); setOperations((current) => [data.operation, ...current.filter((operation) => operation.id !== data.operation.id)]); onState(data); return data; };
  const pay = async () => {
    if (busy || !accepted) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/payments/intents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packageId: item.id, method, accepted: true, idempotencyKey: crypto.randomUUID() }) });
      const intent = await response.json(); if (!response.ok) throw new Error(intent.error || t.operationFailed);
      if (intent.mode === "telegram" && intent.invoiceUrl && window.Telegram?.WebApp?.openInvoice) { window.Telegram.WebApp.openInvoice(intent.invoiceUrl, async (status) => { try { await complete(intent.operation.id, status === "paid" ? "paid" : status === "failed" ? "failed" : "cancelled"); } catch (error) { setMessage(error instanceof Error ? error.message : t.operationFailed); } }); return; }
      if (await confirm()) { await complete(intent.operation.id, "paid"); setMessage(t.paymentAdded(item.tokens)); } else { await complete(intent.operation.id, "cancelled"); setMessage(t.cancelled); }
    } catch (error) { setMessage(error instanceof Error ? error.message : t.operationFailed); } finally { setBusy(false); }
  };
  const methodLabel = (id: PaymentMethod) => copy[language].payment.methods[paymentMethods.findIndex((entry) => entry.id === id)];
  return <>{header}{historyOpen ? <section className={styles.balanceContent}><div className={styles.historyHeading}><button onClick={() => setHistoryOpen(false)}>← {copy[language].common.back}</button><h1>{t.history}</h1></div>{operations.length ? <div className={styles.historyList}>{operations.map((operation) => <article key={operation.id}><div><b>{methodLabel(operation.method)}</b><span>{new Date(operation.createdAt).toLocaleString(language === "ru" ? "ru-RU" : "en-US")}</span></div><strong>{operation.status === "paid" ? t.paidStatus(operation.tokens) : operation.status === "cancelled" ? t.cancelledStatus : t.pending}</strong></article>)}</div> : <p className={styles.emptyHistory}>{t.noOperations}</p>}</section> : <section className={styles.balanceContent}>
    <section className={styles.balanceCard}><span>{t.title}</span><h1>{balance} <small>{copy[language].montage.tokens}</small></h1><p>{t.enoughFor(Math.floor(balance / 23))}</p><button onClick={() => setHistoryOpen(true)}>{t.history}</button></section>
    <section className={styles.bonusCard}><b>🎁 <span>{t.bonusTitle}</span></b><p>{t.bonusBody}</p></section>
    <h2 className={styles.balanceLabel}>{t.choosePackage}</h2><div className={styles.packageList}>{paymentPackages.map((entry, index) => <button key={entry.id} aria-pressed={entry.id === item.id} className={`${styles.packageCard} ${entry.id === item.id ? styles.packageSelected : ""}`} onClick={() => setSelectedPackage(entry.id)}>{entry.popular && <i>{t.popular}</i>}<div><b>{t.videos(entry.videos)}</b><strong>{copy[language].payment.packageTitles[index]}</strong><span>{t.tokens(entry.tokens)}</span></div><aside><b>{entry.rubles.toLocaleString("ru-RU")} ₽</b><span>{t.perVideo(Math.round(entry.rubles / entry.videos))}</span></aside></button>)}</div>
    <h2 className={styles.balanceLabel}>{t.paymentMethod}</h2><div className={styles.methodList}>{paymentMethods.map((entry) => <button key={entry.id} aria-pressed={entry.id === method} className={entry.id === method ? styles.methodSelected : ""} onClick={() => setMethod(entry.id)}><b>{methodLabel(entry.id)}</b><span>{priceFor(item, entry.id).label}</span></button>)}</div>
    <h2 className={styles.balanceLabel}>{t.total}</h2><section className={styles.totalCard}><p><span>{t.receive}</span><b>{t.videos(item.videos)}</b></p><p><span>{t.toAccount}</span><b>{t.tokens(item.tokens)}</b></p><p><span>{t.toPay}</span><b>{priceFor(item, method).label}</b></p></section>
    <label className={styles.terms}><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>{t.agree} <a href={`/offer?lang=${language}`}>{t.offer}</a> {language === "ru" ? "и" : "and"} <a href={`/privacy?lang=${language}`}>{t.privacy}</a></span></label>
    <button className={styles.payButton} disabled={!accepted || busy || !authorized || authPending || !paymentEnabled} onClick={pay}>{busy ? t.processing : paymentEnabled ? t.pay(priceFor(item, method).label) : t.disabled}</button>{message && <p className={styles.status} role="status">{message}</p>}
  </section>}{nav}</>;
}
