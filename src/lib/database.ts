import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { appConfig } from "@/src/lib/config";
import { defaultMontageSettings, type MontageSettings, type ProjectRecord, type ProjectStatus } from "@/src/montage/types";
import { paymentPackage, type PaymentMethod, type PaymentOperation, type PaymentStatus } from "@/src/lib/payments";

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
      first_name TEXT,
      username TEXT,
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
      watermarked_result_path TEXT,
      is_trial INTEGER NOT NULL DEFAULT 0,
      trial_unlocked_at TEXT,
      runway_task_id TEXT,
      status TEXT NOT NULL,
      error_code TEXT,
      reserved_tokens INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      result_expires_at TEXT
    );
    CREATE INDEX IF NOT EXISTS projects_user_status ON projects(user_id, status);
    CREATE TABLE IF NOT EXISTS payment_operations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      package_id TEXT NOT NULL,
      method TEXT NOT NULL,
      currency TEXT NOT NULL,
      amount INTEGER NOT NULL,
      tokens INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled', 'failed')),
      idempotency_key TEXT NOT NULL,
      accepted_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, idempotency_key)
    );
    CREATE INDEX IF NOT EXISTS payment_operations_user_created ON payment_operations(user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS referral_codes (
      user_id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS referral_attributions (
      invited_user_id TEXT PRIMARY KEY,
      inviter_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS referral_attributions_inviter_created ON referral_attributions(inviter_user_id, created_at);
    CREATE TABLE IF NOT EXISTS referral_rewards (
      payment_id TEXT PRIMARY KEY,
      inviter_user_id TEXT NOT NULL,
      invited_user_id TEXT NOT NULL,
      tokens INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS referral_rewards_inviter_created ON referral_rewards(inviter_user_id, created_at);
  `);
  for (const [table, column, definition] of [["projects", "watermarked_result_path", "TEXT"], ["projects", "is_trial", "INTEGER NOT NULL DEFAULT 0"], ["projects", "trial_unlocked_at", "TEXT"], ["users", "first_name", "TEXT"], ["users", "username", "TEXT"]] as const) {
    const known = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!known.some((item) => item.name === column)) database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
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

export function completedProjectCount(telegramId: string) {
  return Number((db().prepare("SELECT COUNT(*) AS count FROM projects WHERE user_id = ? AND status = 'completed'").get(telegramId) as { count: number }).count);
}

export function saveProfileIdentity(telegramId: string, firstName?: string, username?: string) {
  getUser(telegramId);
  db().prepare("UPDATE users SET first_name = ?, username = ?, updated_at = ? WHERE telegram_id = ?").run(firstName || null, username || null, now(), telegramId);
}

export function profileIdentity(telegramId: string) {
  getUser(telegramId);
  return db().prepare("SELECT first_name AS firstName, username FROM users WHERE telegram_id = ?").get(telegramId) as { firstName?: string; username?: string };
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
    inputPath: row.input_path as string | null, resultPath: row.result_path as string | null, watermarkedResultPath: row.watermarked_result_path as string | null,
    isTrial: Boolean(row.is_trial), trialUnlockedAt: row.trial_unlocked_at as string | null, runwayTaskId: row.runway_task_id as string | null,
    status: row.status as ProjectStatus, errorCode: row.error_code as string | null, reservedTokens: Number(row.reserved_tokens),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at), resultExpiresAt: row.result_expires_at as string | null,
  };
}

export function projectById(id: string) {
  const row = db().prepare("SELECT * FROM projects WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? toProject(row) : undefined;
}

export function createProject(id: string, userId: string, settings: MontageSettings) {
  getUser(userId);
  const time = now();
  db().prepare("INSERT INTO projects (id, user_id, settings_json, status, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, ?)")
    .run(id, userId, JSON.stringify(settings), time, time);
  return projectById(id)!;
}

export function updateProject(id: string, fields: Partial<Pick<ProjectRecord, "inputPath" | "resultPath" | "watermarkedResultPath" | "trialUnlockedAt" | "runwayTaskId" | "prompt" | "errorCode" | "resultExpiresAt">> & { status?: ProjectStatus; reservedTokens?: number; isTrial?: boolean }) {
  const columns: string[] = [];
  const values: unknown[] = [];
  const map: Record<string, string> = { inputPath: "input_path", resultPath: "result_path", watermarkedResultPath: "watermarked_result_path", trialUnlockedAt: "trial_unlocked_at", isTrial: "is_trial", runwayTaskId: "runway_task_id", prompt: "prompt", errorCode: "error_code", resultExpiresAt: "result_expires_at", status: "status", reservedTokens: "reserved_tokens" };
  for (const [key, value] of Object.entries(fields)) { if (value !== undefined) { columns.push(`${map[key]} = ?`); values.push(typeof value === "boolean" ? Number(value) : value); } }
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
    const paid = Boolean(database.prepare("SELECT 1 FROM payment_operations WHERE user_id = ? AND status = 'paid' LIMIT 1").get(userId));
    const usedTrial = Boolean(database.prepare("SELECT 1 FROM projects WHERE user_id = ? AND is_trial = 1 AND status != 'failed' LIMIT 1").get(userId));
    if (!paid && !usedTrial) {
      updateProject(id, { status: "queued", prompt, isTrial: true, reservedTokens: 0 });
      return { ok: true as const, trial: true, cost: 0 };
    }
    if (user.balance < 23) return { ok: false as const, reason: "insufficient_balance" };
    database.prepare("UPDATE users SET balance = balance - 23, updated_at = ? WHERE telegram_id = ?").run(now(), userId);
    updateProject(id, { status: "queued", prompt, reservedTokens: 23 });
    return { ok: true as const, trial: false, cost: 23 };
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

export function finishProject(id: string, resultPath: string, watermarkedResultPath?: string) {
  updateProject(id, { status: "completed", resultPath, watermarkedResultPath, reservedTokens: 0, resultExpiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() });
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

function toPayment(row: Record<string, unknown>): PaymentOperation {
  return { id: String(row.id), packageId: String(row.package_id), method: row.method as PaymentMethod, currency: String(row.currency), amount: Number(row.amount), tokens: Number(row.tokens), status: row.status as PaymentStatus, createdAt: String(row.created_at), updatedAt: String(row.updated_at) };
}

export function paymentState(userId: string) {
  const user = getUser(userId);
  const paid = Boolean(db().prepare("SELECT 1 FROM payment_operations WHERE user_id = ? AND status = 'paid' LIMIT 1").get(userId));
  const trial = db().prepare("SELECT id, status, trial_unlocked_at FROM projects WHERE user_id = ? AND is_trial = 1 AND status != 'failed' ORDER BY created_at DESC LIMIT 1").get(userId) as { id: string; status: ProjectStatus; trial_unlocked_at: string | null } | undefined;
  return { balance: user.balance, trialAvailable: !paid && !trial, trialProjectId: trial?.id, trialUnlocked: Boolean(trial?.trial_unlocked_at), paymentEnabled: appConfig().paymentMode === "mock" };
}

export function paymentOperations(userId: string) {
  return db().prepare("SELECT * FROM payment_operations WHERE user_id = ? ORDER BY created_at DESC").all(userId).map((row) => toPayment(row as Record<string, unknown>));
}

export interface ReferralDay { date: string; invited: number; payments: number; }
export interface ReferralState { balance: number; invitedCount: number; earnedTokens: number; last7Days: ReferralDay[]; }

export function getOrCreateReferralCode(userId: string) {
  getUser(userId);
  const existing = db().prepare("SELECT code FROM referral_codes WHERE user_id = ?").get(userId) as { code: string } | undefined;
  if (existing) return existing.code;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = crypto.randomBytes(6).toString("base64url");
    const inserted = db().prepare("INSERT OR IGNORE INTO referral_codes (user_id, code, created_at) VALUES (?, ?, ?)").run(userId, code, now());
    if (inserted.changes) return code;
    const concurrent = db().prepare("SELECT code FROM referral_codes WHERE user_id = ?").get(userId) as { code: string } | undefined;
    if (concurrent) return concurrent.code;
  }
  throw new Error("referral_code_generation_failed");
}

export function claimReferralAttribution(invitedUserId: string, code: string | undefined) {
  if (!code || !/^[A-Za-z0-9_-]{8}$/.test(code)) return false;
  const referral = db().prepare("SELECT user_id FROM referral_codes WHERE code = ?").get(code) as { user_id: string } | undefined;
  if (!referral || referral.user_id === invitedUserId) return false;
  return Boolean(db().prepare("INSERT OR IGNORE INTO referral_attributions (invited_user_id, inviter_user_id, created_at) VALUES (?, ?, ?)")
    .run(invitedUserId, referral.user_id, now()).changes);
}

export function referralState(userId: string): ReferralState {
  const user = getUser(userId);
  const database = db();
  const invitedCount = Number((database.prepare("SELECT COUNT(*) AS count FROM referral_attributions WHERE inviter_user_id = ?").get(userId) as { count: number }).count);
  const earnedTokens = Number((database.prepare("SELECT COALESCE(SUM(tokens), 0) AS tokens FROM referral_rewards WHERE inviter_user_id = ?").get(userId) as { tokens: number }).tokens);
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 6);
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    return date.toISOString().slice(0, 10);
  });
  const since = `${dates[0]}T00:00:00.000Z`;
  const invitedByDate = new Map((database.prepare("SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS count FROM referral_attributions WHERE inviter_user_id = ? AND created_at >= ? GROUP BY date").all(userId, since) as { date: string; count: number }[]).map((row) => [row.date, Number(row.count)]));
  const paymentsByDate = new Map((database.prepare("SELECT substr(created_at, 1, 10) AS date, COUNT(*) AS count FROM referral_rewards WHERE inviter_user_id = ? AND created_at >= ? GROUP BY date").all(userId, since) as { date: string; count: number }[]).map((row) => [row.date, Number(row.count)]));
  return { balance: user.balance, invitedCount, earnedTokens, last7Days: dates.map((date) => ({ date, invited: invitedByDate.get(date) ?? 0, payments: paymentsByDate.get(date) ?? 0 })) };
}

export function createPaymentIntent(userId: string, id: string, packageId: string, method: PaymentMethod, idempotencyKey: string) {
  const item = paymentPackage(packageId);
  if (!item || appConfig().paymentMode !== "mock") return undefined;
  getUser(userId);
  const price = method === "foreign_card_2" ? { amount: item.dollars, currency: "USD" } : method === "telegram_stars" ? { amount: item.stars, currency: "XTR" } : { amount: item.rubles, currency: "RUB" };
  const time = now();
  const insert = db().prepare("INSERT OR IGNORE INTO payment_operations (id, user_id, package_id, method, currency, amount, tokens, status, idempotency_key, accepted_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)")
    .run(id, userId, item.id, method, price.currency, price.amount, item.tokens, idempotencyKey, time, time, time);
  const row = insert.changes ? db().prepare("SELECT * FROM payment_operations WHERE id = ?").get(id) : db().prepare("SELECT * FROM payment_operations WHERE user_id = ? AND idempotency_key = ?").get(userId, idempotencyKey);
  return row ? toPayment(row as Record<string, unknown>) : undefined;
}

export function completeMockPayment(userId: string, id: string, status: Extract<PaymentStatus, "paid" | "cancelled" | "failed">) {
  return db().transaction(() => {
    const row = db().prepare("SELECT * FROM payment_operations WHERE id = ? AND user_id = ?").get(id, userId) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    const operation = toPayment(row);
    if (operation.status === "pending") {
      const time = now();
      db().prepare("UPDATE payment_operations SET status = ?, updated_at = ? WHERE id = ?").run(status, time, id);
      if (status === "paid") {
        db().prepare("UPDATE users SET balance = balance + ?, updated_at = ? WHERE telegram_id = ?").run(operation.tokens, time, userId);
        db().prepare("UPDATE projects SET trial_unlocked_at = ?, updated_at = ? WHERE user_id = ? AND is_trial = 1 AND status != 'failed' AND trial_unlocked_at IS NULL").run(time, time, userId);
        const attribution = db().prepare("SELECT inviter_user_id FROM referral_attributions WHERE invited_user_id = ?").get(userId) as { inviter_user_id: string } | undefined;
        const reward = Math.floor(operation.tokens / 10);
        if (attribution && reward > 0) {
          const rewarded = db().prepare("INSERT OR IGNORE INTO referral_rewards (payment_id, inviter_user_id, invited_user_id, tokens, created_at) VALUES (?, ?, ?, ?, ?)")
            .run(operation.id, attribution.inviter_user_id, userId, reward, time);
          if (rewarded.changes) db().prepare("UPDATE users SET balance = balance + ?, updated_at = ? WHERE telegram_id = ?").run(reward, time, attribution.inviter_user_id);
        }
      }
    }
    return { operation: toPayment(db().prepare("SELECT * FROM payment_operations WHERE id = ?").get(id) as Record<string, unknown>), ...paymentState(userId) };
  })();
}
