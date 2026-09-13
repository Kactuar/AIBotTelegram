import crypto from "node:crypto";
import { cookies } from "next/headers";
import { appConfig } from "@/src/server/config";

const SESSION_COOKIE = "aibot_session";
const MAX_INIT_DATA_AGE_SECONDS = 60 * 60;

export interface TelegramIdentity { id: string; firstName?: string; username?: string; }

export function verifyTelegramInitData(initData: string, botToken = appConfig().botToken): TelegramIdentity {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDate = Number(params.get("auth_date"));
  const user = params.get("user");
  if (!hash || !authDate || !user || Math.abs(Date.now() / 1000 - authDate) > MAX_INIT_DATA_AGE_SECONDS) throw new Error("invalid_telegram_init_data");
  params.delete("hash");
  const checkString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = crypto.createHmac("sha256", secret).update(checkString).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected))) throw new Error("invalid_telegram_init_data");
  const parsed = JSON.parse(user) as { id?: number; first_name?: string; username?: string };
  if (!parsed.id) throw new Error("invalid_telegram_init_data");
  return { id: String(parsed.id), firstName: parsed.first_name, username: parsed.username };
}

function sign(value: string) { return crypto.createHmac("sha256", appConfig().sessionSecret).update(value).digest("base64url"); }

export function sessionValue(telegramId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;
  const payload = `${telegramId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function readSession(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const [telegramId, rawExpiry, signature] = value.split(".");
  const payload = `${telegramId}.${rawExpiry}`;
  if (!telegramId || !rawExpiry || !signature || Number(rawExpiry) < Date.now() / 1000) return undefined;
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return undefined;
  return telegramId;
}

export async function requireUserId() {
  const jar = await cookies();
  const userId = readSession(jar.get(SESSION_COOKIE)?.value);
  if (!userId) throw new Error("unauthorized");
  return userId;
}

export const sessionCookie = (value: string) => ({ name: SESSION_COOKIE, value, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 24 * 60 * 60 });
export function isAllowedUser(telegramId: string) { return appConfig().allowedUserIds.has(telegramId); }
export function downloadSignature(projectId: string, expires: string) { return sign(`${projectId}.${expires}`); }
export function validDownloadSignature(projectId: string, expires: string, signature: string | null) {
  if (!signature || !/^\d+$/.test(expires) || Number(expires) < Date.now() / 1000) return false;
  const expected = downloadSignature(projectId, expires);
  return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
export function sourceSignature(projectId: string, segment: string, expires: string) { return sign(`source.${projectId}.${segment}.${expires}`); }
export function validSourceSignature(projectId: string, segment: string, expires: string, signature: string | null) {
  if (!/^[12]$/.test(segment) || !/^\d+$/.test(expires) || Number(expires) < Date.now() / 1000) return false;
  const expected = sourceSignature(projectId, segment, expires);
  return Boolean(signature) && signature!.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature!), Buffer.from(expected));
}
