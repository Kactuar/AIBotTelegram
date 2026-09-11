import path from "node:path";

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function appConfig() {
  return {
    appUrl: requiredEnv("APP_URL").replace(/\/$/, ""),
    botToken: requiredEnv("BOT_TOKEN"),
    sessionSecret: requiredEnv("SESSION_SECRET"),
    databasePath: process.env.DATABASE_PATH || path.join(process.cwd(), ".data", "app.sqlite"),
    storageRoot: process.env.STORAGE_ROOT || path.join(process.cwd(), ".data", "storage"),
    allowedUserIds: new Set((process.env.TELEGRAM_ALLOWED_USER_IDS || "").split(",").map((id) => id.trim()).filter(Boolean)),
    runwaySecret: process.env.RUNWAYML_API_SECRET?.trim(),
    paymentMode: process.env.PAYMENTS_MODE === "mock" ? "mock" : "disabled" as "mock" | "disabled",
  };
}
