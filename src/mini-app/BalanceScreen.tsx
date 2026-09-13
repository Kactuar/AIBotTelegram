"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  paymentMethods,
  paymentPackages,
  priceFor,
  type PaymentMethod,
  type PaymentOperation,
  type PaymentPackage,
} from "@/src/lib/payments";
import { copy, type MiniAppLanguage } from "./i18n";
import styles from "@/app/mini-app/page.module.css";

type State = {
  balance: number;
  trialAvailable: boolean;
  paymentEnabled: boolean;
  operations: PaymentOperation[];
};

type BalanceScreenProps = {
  balance: number;
  authorized: boolean;
  authPending: boolean;
  header: ReactNode;
  nav: ReactNode;
  historyOpen: boolean;
  setHistoryOpen(value: boolean): void;
  onState(state: Pick<State, "balance" | "trialAvailable">): void;
  language: MiniAppLanguage;
};

type BalanceCopy = (typeof copy)[MiniAppLanguage]["balance"];

export default function BalanceScreen({
  balance,
  authorized,
  authPending,
  header,
  nav,
  historyOpen,
  setHistoryOpen,
  onState,
  language,
}: BalanceScreenProps) {
  const [selectedPackage, setSelectedPackage] = useState("active");
  const [method, setMethod] = useState<PaymentMethod>("ru_card");
  const [accepted, setAccepted] = useState(false);
  const [operations, setOperations] = useState<PaymentOperation[]>([]);
  const [paymentEnabled, setPaymentEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const item = paymentPackages.find((value) => value.id === selectedPackage) || paymentPackages[1];
  const t = copy[language].balance;

  const refresh = async () => {
    const response = await fetch("/api/payments");
    if (!response.ok) return;

    const data = await response.json() as State;
    setOperations(data.operations);
    setPaymentEnabled(data.paymentEnabled);
    onState(data);
  };

  useEffect(() => {
    if (authorized) void refresh();
  }, [authorized]);

  const confirm = () => new Promise<boolean>((resolve) => {
    const app = window.Telegram?.WebApp;
    if (app?.showConfirm) app.showConfirm(t.mockConfirm, resolve);
    else resolve(window.confirm(t.mockConfirm));
  });

  const complete = async (id: string, status: "paid" | "cancelled" | "failed") => {
    const response = await fetch(`/api/payments/intents/${id}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || t.operationFailed);

    setOperations((current) => [data.operation, ...current.filter((operation) => operation.id !== data.operation.id)]);
    onState(data);
    return data;
  };

  const pay = async () => {
    if (busy || !accepted) return;

    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/payments/intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packageId: item.id,
          method,
          accepted: true,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const intent = await response.json();
      if (!response.ok) throw new Error(intent.error || t.operationFailed);

      if (intent.mode === "telegram" && intent.invoiceUrl && window.Telegram?.WebApp?.openInvoice) {
        window.Telegram.WebApp.openInvoice(intent.invoiceUrl, async (status) => {
          try {
            await complete(intent.operation.id, status === "paid" ? "paid" : status === "failed" ? "failed" : "cancelled");
          } catch (error) {
            setMessage(error instanceof Error ? error.message : t.operationFailed);
          }
        });
        return;
      }

      if (await confirm()) {
        await complete(intent.operation.id, "paid");
        setMessage(t.paymentAdded(item.tokens));
      } else {
        await complete(intent.operation.id, "cancelled");
        setMessage(t.cancelled);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t.operationFailed);
    } finally {
      setBusy(false);
    }
  };

  return <>
    {header}
    {historyOpen ? <PaymentHistory
      language={language}
      operations={operations}
      t={t}
      onBack={() => setHistoryOpen(false)}
    /> : <PaymentForm
      accepted={accepted}
      authPending={authPending}
      authorized={authorized}
      balance={balance}
      busy={busy}
      item={item}
      language={language}
      message={message}
      method={method}
      paymentEnabled={paymentEnabled}
      t={t}
      onAcceptedChange={setAccepted}
      onMethodChange={setMethod}
      onPackageChange={setSelectedPackage}
      onPay={pay}
      onShowHistory={() => setHistoryOpen(true)}
    />}
    {nav}
  </>;
}

function PaymentHistory({ language, operations, t, onBack }: {
  language: MiniAppLanguage;
  operations: PaymentOperation[];
  t: BalanceCopy;
  onBack(): void;
}) {
  return <section className={styles.balanceContent}>
    <div className={styles.historyHeading}>
      <button onClick={onBack}>← {copy[language].common.back}</button>
      <h1>{t.history}</h1>
    </div>
    {operations.length ? <div className={styles.historyList}>
      {operations.map((operation) => <article key={operation.id}>
        <div>
          <b>{paymentMethodLabel(language, operation.method)}</b>
          <span>{new Date(operation.createdAt).toLocaleString(language === "ru" ? "ru-RU" : "en-US")}</span>
        </div>
        <strong>{operation.status === "paid" ? t.paidStatus(operation.tokens) : operation.status === "cancelled" ? t.cancelledStatus : t.pending}</strong>
      </article>)}
    </div> : <p className={styles.emptyHistory}>{t.noOperations}</p>}
  </section>;
}

function PaymentForm({
  accepted,
  authPending,
  authorized,
  balance,
  busy,
  item,
  language,
  message,
  method,
  paymentEnabled,
  t,
  onAcceptedChange,
  onMethodChange,
  onPackageChange,
  onPay,
  onShowHistory,
}: {
  accepted: boolean;
  authPending: boolean;
  authorized: boolean;
  balance: number;
  busy: boolean;
  item: PaymentPackage;
  language: MiniAppLanguage;
  message: string;
  method: PaymentMethod;
  paymentEnabled: boolean;
  t: BalanceCopy;
  onAcceptedChange(value: boolean): void;
  onMethodChange(value: PaymentMethod): void;
  onPackageChange(value: string): void;
  onPay(): void;
  onShowHistory(): void;
}) {
  const total = priceFor(item, method);

  return <section className={styles.balanceContent}>
    <section className={styles.balanceCard}>
      <span>{t.title}</span>
      <h1>{balance} <small>{copy[language].montage.tokens}</small></h1>
      <p>{t.enoughFor(Math.floor(balance / 23))}</p>
      <button onClick={onShowHistory}>{t.history}</button>
    </section>

    <section className={styles.bonusCard}>
      <i className={styles.bonusIcon} aria-hidden="true">🎁</i>
      <div className={styles.bonusContent}>
        <strong>{t.bonusTitle}</strong>
        <p>{t.bonusBody}</p>
      </div>
    </section>

    <h2 className={styles.balanceLabel}>{t.choosePackage}</h2>
    <div className={styles.packageList}>
      {paymentPackages.map((entry, index) => <PackageCard
        key={entry.id}
        entry={entry}
        language={language}
        selected={entry.id === item.id}
        title={copy[language].payment.packageTitles[index]}
        t={t}
        onSelect={() => onPackageChange(entry.id)}
      />)}
    </div>

    <h2 className={styles.balanceLabel}>{t.paymentMethod}</h2>
    <div className={styles.methodList}>
      {paymentMethods.map((entry) => <button
        key={entry.id}
        aria-pressed={entry.id === method}
        className={entry.id === method ? styles.methodSelected : ""}
        onClick={() => onMethodChange(entry.id)}
      >
        <b>{paymentMethodLabel(language, entry.id)}</b>
        <span>{priceFor(item, entry.id).label}</span>
      </button>)}
    </div>

    <h2 className={styles.balanceLabel}>{t.total}</h2>
    <section className={styles.totalCard}>
      <p><span>{t.receive}</span><b>{t.videos(item.videos)}</b></p>
      <p><span>{t.toAccount}</span><b>{t.tokens(item.tokens)}</b></p>
      <p><span>{t.toPay}</span><b>{total.label}</b></p>
    </section>

    <label className={styles.terms}>
      <input type="checkbox" checked={accepted} onChange={(event) => onAcceptedChange(event.target.checked)} />
      <span>{t.agree} <a href={`/offer?lang=${language}`}>{t.offer}</a> {language === "ru" ? "и" : "and"} <a href={`/privacy?lang=${language}`}>{t.privacy}</a></span>
    </label>

    <button
      className={styles.payButton}
      disabled={!accepted || busy || !authorized || authPending || !paymentEnabled}
      onClick={onPay}
    >
      {busy ? t.processing : paymentEnabled ? t.pay(total.label) : t.disabled}
    </button>
    {message && <p className={styles.status} role="status">{message}</p>}
  </section>;
}

function PackageCard({ entry, language, selected, title, t, onSelect }: {
  entry: PaymentPackage;
  language: MiniAppLanguage;
  selected: boolean;
  title: string;
  t: BalanceCopy;
  onSelect(): void;
}) {
  const videos = t.videos(entry.videos);

  return <button
    aria-pressed={selected}
    className={styles.packageCard}
    onClick={onSelect}
  >
    {entry.popular && <i>{t.popular}</i>}
    <span className={styles.packageDetails}>
      <b><strong>{entry.videos}</strong><small>{videos.replace(`${entry.videos} `, "")}</small></b>
      <strong>{title}</strong>
      <span>{t.tokens(entry.tokens)}</span>
    </span>
    <span className={styles.packagePrice}>
      <b>{entry.rubles.toLocaleString("ru-RU")} ₽</b>
      <span>{t.perVideo(Math.round(entry.rubles / entry.videos))}</span>
    </span>
  </button>;
}

function paymentMethodLabel(language: MiniAppLanguage, id: PaymentMethod) {
  return copy[language].payment.methods[paymentMethods.findIndex((entry) => entry.id === id)];
}
