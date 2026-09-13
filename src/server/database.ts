import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { appConfig } from "@/src/server/config";

let database: Database.Database | undefined;

export function closeDatabase() { database?.close(); database = undefined; }

export function db() {
  if (database) return database;
  const filename = appConfig().databasePath;
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  database = new Database(filename);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS bot_languages (telegram_id TEXT PRIMARY KEY, language TEXT NOT NULL CHECK (language IN ('ru', 'en')));
    CREATE TABLE IF NOT EXISTS users (
      telegram_id TEXT PRIMARY KEY, first_name TEXT, username TEXT, balance INTEGER NOT NULL,
      settings_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, settings_json TEXT NOT NULL, prompt TEXT, input_path TEXT,
      result_path TEXT, watermarked_result_path TEXT, is_trial INTEGER NOT NULL DEFAULT 0, trial_unlocked_at TEXT,
      runway_task_id TEXT, status TEXT NOT NULL, error_code TEXT, reserved_tokens INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, result_expires_at TEXT
    );
    CREATE INDEX IF NOT EXISTS projects_user_status ON projects(user_id, status);
    CREATE TABLE IF NOT EXISTS payment_operations (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, package_id TEXT NOT NULL, method TEXT NOT NULL,
      currency TEXT NOT NULL, amount INTEGER NOT NULL, tokens INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled', 'failed')),
      idempotency_key TEXT NOT NULL, accepted_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(user_id, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS payment_operations_user_created ON payment_operations(user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS referral_codes (user_id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS referral_attributions (invited_user_id TEXT PRIMARY KEY, inviter_user_id TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS referral_attributions_inviter_created ON referral_attributions(inviter_user_id, created_at);
    CREATE TABLE IF NOT EXISTS referral_rewards (payment_id TEXT PRIMARY KEY, inviter_user_id TEXT NOT NULL, invited_user_id TEXT NOT NULL, tokens INTEGER NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS referral_rewards_inviter_created ON referral_rewards(inviter_user_id, created_at);
  `);
  for (const [table, column, definition] of [["projects", "watermarked_result_path", "TEXT"], ["projects", "is_trial", "INTEGER NOT NULL DEFAULT 0"], ["projects", "trial_unlocked_at", "TEXT"], ["users", "first_name", "TEXT"], ["users", "username", "TEXT"]] as const) {
    const known = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!known.some((item) => item.name === column)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
  return database;
}

export const now = () => new Date().toISOString();
