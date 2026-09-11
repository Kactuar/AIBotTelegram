import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { appConfig } from "@/src/lib/config";
import { defaultMontageSettings, type MontageSettings, type ProjectRecord, type ProjectStatus } from "@/src/montage/types";

let database: Database.Database | undefined;

export function closeDatabase() { database?.close(); database = undefined; }

export function db() {
  if (database) return database;
  const filename = appConfig().databasePath;
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  database = new Database(filename);
  database.pragma("journal_mode = WAL");
  database.exec(`
    CREATE TABLE IF NOT EXISTS bot_languages (
      telegram_id TEXT PRIMARY KEY,
      language TEXT NOT NULL CHECK (language IN ('ru', 'en'))
    );
    CREATE TABLE IF NOT EXISTS users (
      telegram_id TEXT PRIMARY KEY,
      balance INTEGER NOT NULL,
      settings_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      settings_json TEXT NOT NULL,
      prompt TEXT,
      input_path TEXT,
      result_path TEXT,
      runway_task_id TEXT,
      status TEXT NOT NULL,
      error_code TEXT,
      reserved_tokens INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      result_expires_at TEXT
    );
    CREATE INDEX IF NOT EXISTS projects_user_status ON projects(user_id, status);
  `);
  return database;
}

const now = () => new Date().toISOString();

export function getBotLanguage(telegramId: string): "ru" | "en" {
  const row = db().prepare("SELECT language FROM bot_languages WHERE telegram_id = ?").get(telegramId) as { language: "ru" | "en" } | undefined;
  return row?.language ?? "ru";
}

export function setBotLanguage(telegramId: string, language: "ru" | "en") {
  db().prepare("INSERT INTO bot_languages (telegram_id, language) VALUES (?, ?) ON CONFLICT(telegram_id) DO UPDATE SET language = excluded.language").run(telegramId, language);
}

export function getOrCreateUser(telegramId: string, isAllowed: boolean) {
  const database = db();
  const existing = database.prepare("SELECT telegram_id AS telegramId, balance, settings_json AS settingsJson FROM users WHERE telegram_id = ?").get(telegramId) as { telegramId: string; balance: number; settingsJson: string } | undefined;
  if (existing) return { id: existing.telegramId, balance: existing.balance, settings: JSON.parse(existing.settingsJson) as MontageSettings };
  const createdAt = now();
  const balance = isAllowed ? 100 : 0;
  database.prepare("INSERT INTO users (telegram_id, balance, settings_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run(telegramId, balance, JSON.stringify(defaultMontageSettings), createdAt, createdAt);
  return { id: telegramId, balance, settings: defaultMontageSettings };
}

export function getUser(telegramId: string) {
  return getOrCreateUser(telegramId, appConfig().allowedUserIds.has(telegramId));
}

export function saveSettings(telegramId: string, settings: MontageSettings) {
  const user = getUser(telegramId);
  db().prepare("UPDATE users SET settings_json = ?, updated_at = ? WHERE telegram_id = ?").run(JSON.stringify(settings), now(), telegramId);
  return { ...user, settings };
}

function toProject(row: Record<string, unknown>): ProjectRecord {
  return {
    id: String(row.id), userId: String(row.user_id), settings: JSON.parse(String(row.settings_json)), prompt: row.prompt as string | null,
    inputPath: row.input_path as string | null, resultPath: row.result_path as string | null, runwayTaskId: row.runway_task_id as string | null,
    status: row.status as ProjectStatus, errorCode: row.error_code as string | null, reservedTokens: Number(row.reserved_tokens),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at), resultExpiresAt: row.result_expires_at as string | null,
  };
}

export function projectById(id: string) {
  const row = db().prepare("SELECT * FROM projects WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? toProject(row) : undefined;
}

export function createProject(id: string, userId: string, settings: MontageSettings) {
  const time = now();
  db().prepare("INSERT INTO projects (id, user_id, settings_json, status, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, ?)")
    .run(id, userId, JSON.stringify(settings), time, time);
  return projectById(id)!;
}

export function updateProject(id: string, fields: Partial<Pick<ProjectRecord, "inputPath" | "resultPath" | "runwayTaskId" | "prompt" | "errorCode" | "resultExpiresAt">> & { status?: ProjectStatus; reservedTokens?: number }) {
  const columns: string[] = [];
  const values: unknown[] = [];
  const map: Record<string, string> = { inputPath: "input_path", resultPath: "result_path", runwayTaskId: "runway_task_id", prompt: "prompt", errorCode: "error_code", resultExpiresAt: "result_expires_at", status: "status", reservedTokens: "reserved_tokens" };
  for (const [key, value] of Object.entries(fields)) { if (value !== undefined) { columns.push(`${map[key]} = ?`); values.push(value); } }
  if (!columns.length) return projectById(id);
  values.push(now(), id);
  db().prepare(`UPDATE projects SET ${columns.join(", ")}, updated_at = ? WHERE id = ?`).run(...values);
  return projectById(id);
}

export function hasActiveProject(userId: string) {
  return Boolean(db().prepare("SELECT 1 FROM projects WHERE user_id = ? AND status IN ('draft', 'uploading', 'uploaded', 'queued', 'processing') LIMIT 1").get(userId));
}

export function reserveGeneration(id: string, userId: string, prompt: string) {
  const database = db();
  const tx = database.transaction(() => {
    const user = database.prepare("SELECT balance FROM users WHERE telegram_id = ?").get(userId) as { balance: number } | undefined;
    const project = projectById(id);
    if (!user || !project || project.userId !== userId || project.status !== "uploaded") return { ok: false as const, reason: "project_not_ready" };
    if (user.balance < 23) return { ok: false as const, reason: "insufficient_balance" };
    database.prepare("UPDATE users SET balance = balance - 23, updated_at = ? WHERE telegram_id = ?").run(now(), userId);
    updateProject(id, { status: "queued", prompt, reservedTokens: 23 });
    return { ok: true as const };
  });
  return tx();
}

export function claimQueuedProject() {
  const database = db();
  return database.transaction(() => {
    const row = database.prepare("SELECT * FROM projects WHERE status = 'queued' ORDER BY created_at LIMIT 1").get() as Record<string, unknown> | undefined;
    if (!row) return undefined;
    const project = toProject(row);
    const changed = database.prepare("UPDATE projects SET status = 'processing', updated_at = ? WHERE id = ? AND status = 'queued'").run(now(), project.id);
    return changed.changes ? projectById(project.id) : undefined;
  })();
}

export function finishProject(id: string, resultPath: string) {
  updateProject(id, { status: "completed", resultPath, reservedTokens: 0, resultExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() });
}

export function failProject(id: string, code: string) {
  const database = db();
  database.transaction(() => {
    const project = projectById(id);
    if (!project) return;
    if (project.reservedTokens) database.prepare("UPDATE users SET balance = balance + ?, updated_at = ? WHERE telegram_id = ?").run(project.reservedTokens, now(), project.userId);
    updateProject(id, { status: "failed", errorCode: code, reservedTokens: 0 });
  })();
}

export function expiredResults() {
  return db().prepare("SELECT * FROM projects WHERE status = 'completed' AND result_expires_at < ?").all(now()).map((row) => toProject(row as Record<string, unknown>));
}
