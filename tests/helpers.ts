import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { closeDatabase } from "@/src/server/database";

export function createTestDatabase() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aibot-test-"));
  const filename = path.join(root, "app.sqlite");
  process.env.DATABASE_PATH = filename;
  process.env.APP_URL = "http://verification.local";
  process.env.BOT_TOKEN = "verification-token";
  process.env.SESSION_SECRET = "verification-session-secret";
  process.env.PAYMENTS_MODE = "mock";
  return { root, filename, remove: () => { closeDatabase(); fs.rmSync(root, { recursive: true, force: true }); } };
}

export function createLegacyDatabase(filename: string) {
  const legacy = new Database(filename);
  legacy.exec("CREATE TABLE users (telegram_id TEXT PRIMARY KEY, balance INTEGER NOT NULL, settings_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)");
  legacy.close();
}
