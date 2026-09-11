"use client";

import { useEffect, useState, type ReactNode } from "react";
import { paymentMethods, paymentPackages, priceFor, type PaymentMethod, type PaymentOperation } from "@/src/lib/payments";
import styles from "@/app/mini-app/page.module.css";

type State = { balance: number; trialAvailable: boolean; paymentEnabled: boolean; operations: PaymentOperation[] };

export default function BalanceScreen({ balance, authorized, authPending, header, nav, historyOpen, setHistoryOpen, onState }: {
  balance: number; authorized: boolean; authPending: boolean; header: ReactNode; nav: ReactNode; historyOpen: boolean; setHistoryOpen(value: boolean): void;
  onState(state: Pick<State, "balance" | "trialAvailable">): void;
}) {
  const [selectedPackage, setSelectedPackage] = useState("active");
  const [method, setMethod] = useState<PaymentMethod>("ru_card");
  const [accepted, setAccepted] = useState(false);
  const [operations, setOperations] = useState<PaymentOperation[]>([]);
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const item = paymentPackages.find((value) => value.id === selectedPackage) || paymentPackages[1];

  const refresh = async () => {
    const response = await fetch("/api/payments");
    if (!response.ok) return;
    const data = await response.json() as State;
    setOperations(data.operations);
    setPaymentEnabled(data.paymentEnabled);
    onState(data);
  };
  useEffect(() => { if (authorized) void refresh(); }, [authorized]);

  const confirm = () => new Promise<boolean>((resolve) => {
    const app = window.Telegram?.WebApp;
    if (app?.showConfirm) app.showConfirm("Это тестовая оплата. Начислить токены?", resolve);
    else resolve(window.confirm("Это тестовая оплата. Начислить токены?"));
  });
  const complete = async (id: string, status: "paid" | "cancelled" | "failed") => {
    const response = await fetch(`/api/payments/intents/${id}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Не удалось завершить оплату.");
    setOperations((current) => [data.operation, ...current.filter((operation) => operation.id !== data.operation.id)]);
    onState(data);
    return data;
  };
  const pay = async () => {
    if (busy || !accepted) return;
    setBusy(true); setMessage("");
    try {
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch("/api/payments/intents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ packageId: item.id, method, accepted: true, idempotencyKey }) });
      const intent = await response.json();
      if (!response.ok) throw new Error(intent.error || "Не удалось создать оплату.");
      if (intent.mode === "telegram" && intent.invoiceUrl && window.Telegram?.WebApp?.openInvoice) {
        window.Telegram.WebApp.openInvoice(intent.invoiceUrl, async (status) => { try { await complete(intent.operation.id, status === "paid" ? "paid" : status === "failed" ? "failed" : "cancelled"); } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось обновить оплату."); } });
        return;
      }
      if (await confirm()) { await complete(intent.operation.id, "paid"); setMessage(`Баланс пополнен на ${item.tokens} токенов.`); }
      else { await complete(intent.operation.id, "cancelled"); setMessage("Оплата отменена."); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "Не удалось выполнить оплату."); }
    finally { setBusy(false); }
  };

  return <>
    {header}
    {historyOpen ? <section className={styles.balanceContent}><div className={styles.historyHeading}><button onClick={() => setHistoryOpen(false)}>← Назад</button><h1>История операций</h1></div>{operations.length ? <div className={styles.historyList}>{operations.map((operation) => <article key={operation.id}><div><b>{paymentMethods.find((entry) => entry.id === operation.method)?.label}</b><span>{new Date(operation.createdAt).toLocaleString("ru-RU")}</span></div><strong>{operation.status === "paid" ? `+${operation.tokens} токенов` : operation.status === "cancelled" ? "Отменено" : "В обработке"}</strong></article>)}</div> : <p className={styles.emptyHistory}>Операций пока нет.</p>}</section> : <section className={styles.balanceContent}>
      <section className={styles.balanceCard}><span>БАЛАНС</span><h1>{balance} <small>токенов</small></h1><p>Хватит на {Math.floor(balance / 23)} монтажей</p><button onClick={() => setHistoryOpen(true)}>История операций</button></section>
      <section className={styles.bonusCard}><b>🎁 <span>Бесплатно, сверх пакета</span></b><p>Пробный ролик без водяного знака придёт сразу после оплаты — токены за него не спишутся.</p></section>
      <h2 className={styles.balanceLabel}>ВЫБЕРИТЕ ПАКЕТ</h2><div className={styles.packageList}>{paymentPackages.map((entry) => <button key={entry.id} aria-pressed={entry.id === item.id} className={`${styles.packageCard} ${entry.id === item.id ? styles.packageSelected : ""}`} onClick={() => setSelectedPackage(entry.id)}>{entry.popular && <i>ПОПУЛЯРНЫЙ</i>}<div><b>{entry.videos} <small>роликов</small></b><strong>{entry.title}</strong><span>{entry.tokens} токенов</span></div><aside><b>{entry.rubles.toLocaleString("ru-RU")} ₽</b><span>{Math.round(entry.rubles / entry.videos)} ₽ за ролик</span></aside></button>)}</div>
      <h2 className={styles.balanceLabel}>СПОСОБ ОПЛАТЫ</h2><div className={styles.methodList}>{paymentMethods.map((entry) => <button key={entry.id} aria-pressed={entry.id === method} className={entry.id === method ? styles.methodSelected : ""} onClick={() => setMethod(entry.id)}><b>{entry.label}</b><span>{priceFor(item, entry.id).label}</span></button>)}</div>
      <h2 className={styles.balanceLabel}>ИТОГ</h2><section className={styles.totalCard}><p><span>Получите</span><b>{item.videos} роликов</b></p><p><span>Токенов на счёт</span><b>{item.tokens} токенов</b></p><p><span>К оплате</span><b>{priceFor(item, method).label}</b></p></section>
      <label className={styles.terms}><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Согласен с <a href="/offer">офертой</a> и <a href="/privacy">политикой конфиденциальности</a></span></label>
      <button className={styles.payButton} disabled={!accepted || busy || !authorized || authPending || !paymentEnabled} onClick={pay}>{busy ? "Обрабатываем…" : paymentEnabled ? `Оплатить ${priceFor(item, method).label}` : "Оплата временно недоступна"}</button>
      {message && <p className={styles.status} role="status">{message}</p>}
    </section>}
    {nav}
  </>;
}
