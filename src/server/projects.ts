import { type MontageSettings, type ProjectRecord, type ProjectStatus } from "@/src/domain/montage";
import { db, now } from "@/src/server/database";
import { getUser } from "@/src/server/users";

export interface OpenRouterJobRecord {
  projectId: string;
  segmentIndex: 1 | 2;
  attempt: number;
  jobId: string | null;
  nextActionAt: string;
  updatedAt: string;
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
export function availableProjects(userId: string) {
  return db().prepare("SELECT * FROM projects WHERE user_id = ? AND status = 'completed' AND result_expires_at > ? ORDER BY created_at DESC").all(userId, now()).map((row) => toProject(row as Record<string, unknown>));
}
export function createProject(id: string, userId: string, settings: MontageSettings) {
  getUser(userId);
  const time = now();
  db().prepare("INSERT INTO projects (id, user_id, settings_json, status, created_at, updated_at) VALUES (?, ?, ?, 'draft', ?, ?)").run(id, userId, JSON.stringify(settings), time, time);
  return projectById(id)!;
}
export function updateProject(id: string, fields: Partial<Pick<ProjectRecord, "inputPath" | "resultPath" | "watermarkedResultPath" | "trialUnlockedAt" | "runwayTaskId" | "prompt" | "errorCode" | "resultExpiresAt">> & { status?: ProjectStatus; reservedTokens?: number; isTrial?: boolean }) {
  const columns: string[] = [];
  const values: unknown[] = [];
  const map: Record<string, string> = { inputPath: "input_path", resultPath: "result_path", watermarkedResultPath: "watermarked_result_path", trialUnlockedAt: "trial_unlocked_at", isTrial: "is_trial", runwayTaskId: "runway_task_id", prompt: "prompt", errorCode: "error_code", resultExpiresAt: "result_expires_at", status: "status", reservedTokens: "reserved_tokens" };
  for (const [key, value] of Object.entries(fields)) if (value !== undefined) { columns.push(`${map[key]} = ?`); values.push(typeof value === "boolean" ? Number(value) : value); }
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
  return database.transaction(() => {
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
  })();
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
export function expiredResults() { return db().prepare("SELECT * FROM projects WHERE status = 'completed' AND result_expires_at < ?").all(now()).map((row) => toProject(row as Record<string, unknown>)); }
export function completedProjectCount(telegramId: string) {
  return Number((db().prepare("SELECT COUNT(*) AS count FROM projects WHERE user_id = ? AND status = 'completed'").get(telegramId) as { count: number }).count);
}

export function openRouterJob(projectId: string): OpenRouterJobRecord | undefined {
  const row = db().prepare("SELECT * FROM openrouter_jobs WHERE project_id = ?").get(projectId) as Record<string, unknown> | undefined;
  if (!row) return undefined;
  return { projectId: String(row.project_id), segmentIndex: Number(row.segment_index) as 1 | 2, attempt: Number(row.attempt), jobId: row.job_id as string | null, nextActionAt: String(row.next_action_at), updatedAt: String(row.updated_at) };
}

export function saveOpenRouterJob(projectId: string, fields: { segmentIndex: 1 | 2; attempt: number; jobId: string | null; nextActionAt: string }) {
  const timestamp = now();
  db().prepare(`INSERT INTO openrouter_jobs (project_id, segment_index, attempt, job_id, next_action_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET segment_index = excluded.segment_index, attempt = excluded.attempt,
      job_id = excluded.job_id, next_action_at = excluded.next_action_at, updated_at = excluded.updated_at`).run(projectId, fields.segmentIndex, fields.attempt, fields.jobId, fields.nextActionAt, timestamp);
  return openRouterJob(projectId)!;
}

export function clearOpenRouterJob(projectId: string) { db().prepare("DELETE FROM openrouter_jobs WHERE project_id = ?").run(projectId); }
