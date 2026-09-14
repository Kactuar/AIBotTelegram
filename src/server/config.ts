import path from "node:path";

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

const TELEGRAM_WEBHOOK_SECRET = /^[A-Za-z0-9_-]{1,256}$/;

export function telegramWebhookSecret() {
  const value = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!value) {
    if (process.env.NODE_ENV === "production") throw new Error("TELEGRAM_WEBHOOK_SECRET is not configured");
    return undefined;
  }
  if (!TELEGRAM_WEBHOOK_SECRET.test(value)) throw new Error("TELEGRAM_WEBHOOK_SECRET has an invalid format");
  return value;
}

export function appConfig() {
  return {
    appUrl: requiredEnv("APP_URL").replace(/\/$/, ""),
    botToken: requiredEnv("BOT_TOKEN"),
    sessionSecret: requiredEnv("SESSION_SECRET"),
    databasePath: process.env.DATABASE_PATH || path.join(process.cwd(), ".data", "app.sqlite"),
    storageRoot: process.env.STORAGE_ROOT || path.join(process.cwd(), ".data", "storage"),
    openRouterApi: process.env.OPENROUTER_API?.trim(),
    paymentMode: process.env.PAYMENTS_MODE === "mock" ? "mock" : "disabled" as "mock" | "disabled",
    supportUrl: process.env.SUPPORT_URL?.trim(),
    officialChannelUrl: process.env.OFFICIAL_CHANNEL_URL?.trim(),
  };
}
