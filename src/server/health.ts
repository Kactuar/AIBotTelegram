import { db, now } from "@/src/server/database";

const MAX_HEARTBEAT_AGE_MS = 45 * 1000;

export function touchWorkerHeartbeat() {
  db().prepare("INSERT INTO worker_heartbeat (id, updated_at) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at").run(now());
}

export function workerIsHealthy(reference = Date.now()) {
  const row = db().prepare("SELECT updated_at FROM worker_heartbeat WHERE id = 1").get() as { updated_at: string } | undefined;
  return Boolean(row && reference - Date.parse(row.updated_at) <= MAX_HEARTBEAT_AGE_MS);
}
