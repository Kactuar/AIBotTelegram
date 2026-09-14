import { defaultMontageSettings, type MontageSettings } from "@/src/domain/montage";
import { db, now } from "@/src/server/database";

export function getBotLanguage(telegramId: string): "ru" | "en" {
  const row = db().prepare("SELECT language FROM bot_languages WHERE telegram_id = ?").get(telegramId) as { language: "ru" | "en" } | undefined;
  return row?.language ?? "ru";
}
export function setBotLanguage(telegramId: string, language: "ru" | "en") {
  db().prepare("INSERT INTO bot_languages (telegram_id, language) VALUES (?, ?) ON CONFLICT(telegram_id) DO UPDATE SET language = excluded.language").run(telegramId, language);
}
export function saveProfileIdentity(telegramId: string, firstName?: string, username?: string) {
  getUser(telegramId);
  db().prepare("UPDATE users SET first_name = ?, username = ?, updated_at = ? WHERE telegram_id = ?").run(firstName || null, username || null, now(), telegramId);
}
export function profileIdentity(telegramId: string) {
  getUser(telegramId);
  return db().prepare("SELECT first_name AS firstName, username FROM users WHERE telegram_id = ?").get(telegramId) as { firstName?: string; username?: string };
}
export function getOrCreateUser(telegramId: string) {
  const database = db();
  const existing = database.prepare("SELECT telegram_id AS telegramId, balance, settings_json AS settingsJson FROM users WHERE telegram_id = ?").get(telegramId) as { telegramId: string; balance: number; settingsJson: string } | undefined;
  if (existing) return { id: existing.telegramId, balance: existing.balance, settings: JSON.parse(existing.settingsJson) as MontageSettings };
  const createdAt = now();
  const balance = 100;
  database.prepare("INSERT INTO users (telegram_id, balance, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(telegramId, balance, JSON.stringify(defaultMontageSettings), createdAt, createdAt);
  return { id: telegramId, balance, settings: defaultMontageSettings };
}
export function getUser(telegramId: string) { return getOrCreateUser(telegramId); }
export function saveSettings(telegramId: string, settings: MontageSettings) {
  const user = getUser(telegramId);
  db().prepare("UPDATE users SET settings_json = ?, updated_at = ? WHERE telegram_id = ?").run(JSON.stringify(settings), now(), telegramId);
  return { ...user, settings };
}
