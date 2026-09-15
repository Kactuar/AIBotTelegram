import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { appConfig } from "@/src/server/config";

let database: Database.Database | undefined;

const migrations: (() => void)[] = [
  () => dbConnection().exec(`
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
      , FOREIGN KEY(user_id) REFERENCES users(telegram_id)
    );
    CREATE TABLE IF NOT EXISTS openrouter_jobs (
      project_id TEXT PRIMARY KEY REFERENCES projects(id), segment_index INTEGER NOT NULL CHECK (segment_index IN (1, 2)),
      attempt INTEGER NOT NULL DEFAULT 1, job_id TEXT, next_action_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS projects_user_status ON projects(user_id, status);
    CREATE TABLE IF NOT EXISTS payment_operations (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, package_id TEXT NOT NULL, method TEXT NOT NULL,
      currency TEXT NOT NULL, amount INTEGER NOT NULL, tokens INTEGER NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled', 'failed')),
      idempotency_key TEXT NOT NULL, accepted_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      UNIQUE(user_id, idempotency_key), FOREIGN KEY(user_id) REFERENCES users(telegram_id)
    );
    CREATE INDEX IF NOT EXISTS payment_operations_user_created ON payment_operations(user_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS referral_codes (user_id TEXT PRIMARY KEY REFERENCES users(telegram_id), code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS referral_attributions (invited_user_id TEXT PRIMARY KEY REFERENCES users(telegram_id), inviter_user_id TEXT NOT NULL REFERENCES users(telegram_id), created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS referral_attributions_inviter_created ON referral_attributions(inviter_user_id, created_at);
    CREATE TABLE IF NOT EXISTS referral_rewards (payment_id TEXT PRIMARY KEY REFERENCES payment_operations(id), inviter_user_id TEXT NOT NULL REFERENCES users(telegram_id), invited_user_id TEXT NOT NULL REFERENCES users(telegram_id), tokens INTEGER NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS referral_rewards_inviter_created ON referral_rewards(inviter_user_id, created_at);
  `),
  () => {
    const connection = dbConnection();
    for (const [table, column, definition] of [["projects", "watermarked_result_path", "TEXT"], ["projects", "is_trial", "INTEGER NOT NULL DEFAULT 0"], ["projects", "trial_unlocked_at", "TEXT"], ["users", "first_name", "TEXT"], ["users", "username", "TEXT"]] as const) {
      const known = connection.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
      if (!known.some((item) => item.name === column)) connection.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  },
  () => dbConnection().exec("CREATE UNIQUE INDEX IF NOT EXISTS projects_one_active_per_user ON projects(user_id) WHERE status IN ('draft', 'uploading', 'uploaded', 'queued', 'processing')"),
  () => dbConnection().exec("CREATE TABLE IF NOT EXISTS worker_heartbeat (id INTEGER PRIMARY KEY CHECK (id = 1), updated_at TEXT NOT NULL)"),
  () => {
    const connection = dbConnection();
    const foreignKeys = connection.prepare("PRAGMA foreign_key_list(projects)").all();
    if (foreignKeys.length) return;
    connection.exec(`
      DROP INDEX IF EXISTS projects_user_status;
      DROP INDEX IF EXISTS projects_one_active_per_user;
      DROP INDEX IF EXISTS payment_operations_user_created;
      DROP INDEX IF EXISTS referral_attributions_inviter_created;
      DROP INDEX IF EXISTS referral_rewards_inviter_created;

      ALTER TABLE users RENAME TO users_without_foreign_keys;
      CREATE TABLE users (
        telegram_id TEXT PRIMARY KEY, first_name TEXT, username TEXT, balance INTEGER NOT NULL,
        settings_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO users (telegram_id, first_name, username, balance, settings_json, created_at, updated_at)
        SELECT telegram_id, first_name, username, balance, settings_json, created_at, updated_at FROM users_without_foreign_keys;

      ALTER TABLE projects RENAME TO projects_without_foreign_keys;
      CREATE TABLE projects (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(telegram_id), settings_json TEXT NOT NULL, prompt TEXT, input_path TEXT,
        result_path TEXT, watermarked_result_path TEXT, is_trial INTEGER NOT NULL DEFAULT 0, trial_unlocked_at TEXT,
        runway_task_id TEXT, status TEXT NOT NULL, error_code TEXT, reserved_tokens INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL, result_expires_at TEXT
      );
      INSERT INTO projects (id, user_id, settings_json, prompt, input_path, result_path, watermarked_result_path, is_trial, trial_unlocked_at, runway_task_id, status, error_code, reserved_tokens, created_at, updated_at, result_expires_at)
        SELECT id, user_id, settings_json, prompt, input_path, result_path, watermarked_result_path, is_trial, trial_unlocked_at, runway_task_id, status, error_code, reserved_tokens, created_at, updated_at, result_expires_at FROM projects_without_foreign_keys;

      ALTER TABLE openrouter_jobs RENAME TO openrouter_jobs_without_foreign_keys;
      CREATE TABLE openrouter_jobs (
        project_id TEXT PRIMARY KEY REFERENCES projects(id), segment_index INTEGER NOT NULL CHECK (segment_index IN (1, 2)),
        attempt INTEGER NOT NULL DEFAULT 1, job_id TEXT, next_action_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      INSERT INTO openrouter_jobs SELECT * FROM openrouter_jobs_without_foreign_keys;

      ALTER TABLE payment_operations RENAME TO payment_operations_without_foreign_keys;
      CREATE TABLE payment_operations (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(telegram_id), package_id TEXT NOT NULL, method TEXT NOT NULL,
        currency TEXT NOT NULL, amount INTEGER NOT NULL, tokens INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'cancelled', 'failed')),
        idempotency_key TEXT NOT NULL, accepted_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        UNIQUE(user_id, idempotency_key)
      );
      INSERT INTO payment_operations SELECT * FROM payment_operations_without_foreign_keys;

      ALTER TABLE referral_codes RENAME TO referral_codes_without_foreign_keys;
      CREATE TABLE referral_codes (user_id TEXT PRIMARY KEY REFERENCES users(telegram_id), code TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL);
      INSERT INTO referral_codes SELECT * FROM referral_codes_without_foreign_keys;

      ALTER TABLE referral_attributions RENAME TO referral_attributions_without_foreign_keys;
      CREATE TABLE referral_attributions (invited_user_id TEXT PRIMARY KEY REFERENCES users(telegram_id), inviter_user_id TEXT NOT NULL REFERENCES users(telegram_id), created_at TEXT NOT NULL);
      INSERT INTO referral_attributions SELECT * FROM referral_attributions_without_foreign_keys;

      ALTER TABLE referral_rewards RENAME TO referral_rewards_without_foreign_keys;
      CREATE TABLE referral_rewards (payment_id TEXT PRIMARY KEY REFERENCES payment_operations(id), inviter_user_id TEXT NOT NULL REFERENCES users(telegram_id), invited_user_id TEXT NOT NULL REFERENCES users(telegram_id), tokens INTEGER NOT NULL, created_at TEXT NOT NULL);
      INSERT INTO referral_rewards SELECT * FROM referral_rewards_without_foreign_keys;

      DROP TABLE users_without_foreign_keys;
      DROP TABLE projects_without_foreign_keys;
      DROP TABLE openrouter_jobs_without_foreign_keys;
      DROP TABLE payment_operations_without_foreign_keys;
      DROP TABLE referral_codes_without_foreign_keys;
      DROP TABLE referral_attributions_without_foreign_keys;
      DROP TABLE referral_rewards_without_foreign_keys;

      CREATE INDEX projects_user_status ON projects(user_id, status);
      CREATE UNIQUE INDEX projects_one_active_per_user ON projects(user_id) WHERE status IN ('draft', 'uploading', 'uploaded', 'queued', 'processing');
      CREATE INDEX payment_operations_user_created ON payment_operations(user_id, created_at DESC);
      CREATE INDEX referral_attributions_inviter_created ON referral_attributions(inviter_user_id, created_at);
      CREATE INDEX referral_rewards_inviter_created ON referral_rewards(inviter_user_id, created_at);
    `);
  },
];

export function closeDatabase() { database?.close(); database = undefined; }

function dbConnection() {
  if (database) return database;
  const filename = appConfig().databasePath;
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  database = new Database(filename);
  database.pragma("journal_mode = WAL");
  database.pragma("busy_timeout = 5000");
  database.pragma("foreign_keys = ON");
  return database;
}

function currentSchemaVersion(connection: Database.Database) {
  const exists = connection.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'").get();
  if (!exists) return 0;
  return Number((connection.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get() as { version: number }).version);
}

export function migrateDatabase() {
  const connection = dbConnection();
  connection.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
  for (let index = currentSchemaVersion(connection); index < migrations.length; index += 1) {
    connection.transaction(() => {
      migrations[index]();
      connection.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(index + 1, now());
    })();
  }
}

export function db() {
  const connection = dbConnection();
  if (currentSchemaVersion(connection) !== migrations.length) throw new Error("Database migrations are pending. Run npm run db:migrate");
  return connection;
}

export const now = () => new Date().toISOString();
