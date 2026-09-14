import fs from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import { backupDatabase, restoreDatabaseBackup, verifyDatabaseBackup } from "@/src/server/database-backup";
import { getUser } from "@/src/server/users";
import { createTestDatabase } from "./helpers";

let remove: (() => void) | undefined;
afterEach(() => { remove?.(); remove = undefined; });

describe("SQLite backup and restore", () => {
  it("creates an integrity-checked backup and restores only to a new path", async () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    getUser("42");
    const backup = path.join(fixture.root, "backups", "app.sqlite");
    const created = await backupDatabase(backup);
    expect(created.digest).toHaveLength(64);
    expect(await verifyDatabaseBackup(backup)).toEqual(created);
    expect(await fs.readFile(`${backup}.sha256`, "utf8")).toContain(created.digest);

    const restored = path.join(fixture.root, "restore", "app.sqlite");
    await expect(restoreDatabaseBackup(backup, restored)).resolves.toMatchObject({ target: restored });
    const connection = new Database(restored, { readonly: true });
    expect(connection.prepare("SELECT telegram_id FROM users WHERE telegram_id = ?").get("42")).toEqual({ telegram_id: "42" });
    connection.close();
    await expect(restoreDatabaseBackup(backup, restored)).rejects.toThrow("restore_destination_already_exists");
  });
});
