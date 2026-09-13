export type InvoiceStatus = "paid" | "cancelled" | "failed" | "pending";

export type TelegramWebApp = {
  initData: string;
  ready(): void;
  expand(): void;
  BackButton?: { show(): void; hide(): void; onClick(listener: () => void): void; offClick(listener: () => void): void };
  showConfirm?(message: string, callback: (confirmed: boolean) => void): void;
  openInvoice?(url: string, callback: (status: InvoiceStatus) => void): void;
  openLink?(url: string): void;
  openTelegramLink?(url: string): void;
};

declare global { interface Window { Telegram?: { WebApp?: TelegramWebApp }; } }

export function telegramWebApp() { return window.Telegram?.WebApp; }
