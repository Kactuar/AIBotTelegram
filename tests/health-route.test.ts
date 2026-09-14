import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/ready/route";
import { db } from "@/src/server/database";
import { touchWorkerHeartbeat } from "@/src/server/health";
import { createTestDatabase } from "./helpers";

let remove: (() => void) | undefined;
afterEach(() => { remove?.(); remove = undefined; delete process.env.STORAGE_ROOT; });

describe("readiness endpoint", () => {
  it("requires current worker activity as well as database and storage access", async () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    process.env.STORAGE_ROOT = path.join(fixture.root, "storage");
    await fs.mkdir(process.env.STORAGE_ROOT, { recursive: true });
    expect((await GET()).status).toBe(503);
    touchWorkerHeartbeat();
    expect((await GET()).status).toBe(200);
    db().prepare("UPDATE worker_heartbeat SET updated_at = ? WHERE id = 1").run(new Date(Date.now() - 46 * 1000).toISOString());
    expect((await GET()).status).toBe(503);
  });
});
