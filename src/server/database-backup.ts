import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import { appConfig } from "@/src/server/config";

function integrityCheck(filename: string) {
  const backup = new Database(filename, { readonly: true });
  try {
    const result = backup.pragma("integrity_check", { simple: true });
    if (result !== "ok") throw new Error(`backup_integrity_check_failed: ${String(result)}`);
  } finally { backup.close(); }
}

export async function backupDatabase(destination: string) {
  const source = path.resolve(appConfig().databasePath);
  const target = path.resolve(destination);
  if (source === target) throw new Error("backup_destination_must_not_be_the_live_database");
  await fs.mkdir(path.dirname(target), { recursive: true });
  const connection = new Database(source, { readonly: true, fileMustExist: true });
  try { await connection.backup(target); }
  finally { connection.close(); }
  integrityCheck(target);
  const digest = crypto.createHash("sha256").update(await fs.readFile(target)).digest("hex");
  await fs.writeFile(`${target}.sha256`, `${digest}  ${path.basename(target)}\n`, "utf8");
  return { target, digest };
}

export async function verifyDatabaseBackup(filename: string) {
  const target = path.resolve(filename);
  integrityCheck(target);
  const digest = crypto.createHash("sha256").update(await fs.readFile(target)).digest("hex");
  const manifest = await fs.readFile(`${target}.sha256`, "utf8").catch(() => undefined);
  if (manifest && !manifest.startsWith(digest)) throw new Error("backup_checksum_mismatch");
  return { target, digest };
}

export async function restoreDatabaseBackup(backup: string, destination: string) {
  const source = path.resolve(backup);
  const target = path.resolve(destination);
  if (target === path.resolve(appConfig().databasePath)) throw new Error("restore_destination_must_not_be_the_live_database");
  await verifyDatabaseBackup(source);
  try { await fs.access(target); throw new Error("restore_destination_already_exists"); }
  catch (error) { if (!(error instanceof Error) || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
  return verifyDatabaseBackup(target);
}
