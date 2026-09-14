import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireUserId = vi.hoisted(() => vi.fn<() => Promise<string>>());
vi.mock("@/src/server/auth", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/src/server/auth")>()), requireUserId }));

import { GET } from "@/app/api/projects/route";
import { validDownloadSignature } from "@/src/server/auth";
import { defaultMontageSettings } from "@/src/domain/montage";
import { createProject, updateProject } from "@/src/server/projects";
import { resultPath, watermarkedResultPath } from "@/src/server/storage";
import { createTestDatabase } from "./helpers";

let remove: (() => void) | undefined;
afterEach(() => { vi.restoreAllMocks(); remove?.(); remove = undefined; delete process.env.STORAGE_ROOT; });

describe("projects route", () => {
  it("lists only the caller's available completed videos with valid bounded download links", async () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    process.env.STORAGE_ROOT = path.join(fixture.root, "storage");
    requireUserId.mockResolvedValue("42");
    const active = createProject("active", "42", defaultMontageSettings);
    const activeFile = resultPath("42", active.id);
    await fs.mkdir(path.dirname(activeFile), { recursive: true });
    await fs.writeFile(activeFile, "video");
    updateProject(active.id, { status: "completed", resultPath: activeFile, resultExpiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString() });
    const trial = createProject("trial", "42", defaultMontageSettings);
    const trialFile = watermarkedResultPath("42", trial.id);
    await fs.mkdir(path.dirname(trialFile), { recursive: true });
    await fs.writeFile(trialFile, "watermarked-video");
    updateProject(trial.id, { status: "completed", isTrial: true, watermarkedResultPath: trialFile, resultExpiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString() });

    const other = createProject("other", "43", defaultMontageSettings);
    const otherFile = resultPath("43", other.id);
    await fs.mkdir(path.dirname(otherFile), { recursive: true });
    await fs.writeFile(otherFile, "video");
    updateProject(other.id, { status: "completed", resultPath: otherFile, resultExpiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString() });
    const expired = createProject("expired", "42", defaultMontageSettings);
    updateProject(expired.id, { status: "completed", resultPath: resultPath("42", expired.id), resultExpiresAt: new Date(Date.now() - 1_000).toISOString() });
    const missing = createProject("missing", "42", defaultMontageSettings);
    updateProject(missing.id, { status: "completed", resultPath: resultPath("42", missing.id), resultExpiresAt: new Date(Date.now() + 90 * 60 * 1000).toISOString() });

    const response = await GET();
    expect(response.status).toBe(200);
    const payload = await response.json() as { projects: { id: string; downloadUrl: string }[] };
    expect(payload.projects).toHaveLength(2);
    const listed = payload.projects.find((project) => project.id === active.id)!;
    expect(listed).toBeDefined();
    expect(payload.projects.find((project) => project.id === trial.id)).toBeDefined();
    const download = new URL(listed.downloadUrl);
    const expires = download.searchParams.get("expires")!;
    expect(Number(expires)).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 60 * 60);
    expect(validDownloadSignature(active.id, expires, download.searchParams.get("signature"))).toBe(true);
  });

  it("returns a safe active project so the Mini App can resume it after reload", async () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    requireUserId.mockResolvedValue("42");
    const active = createProject("active-project", "42", defaultMontageSettings);
    updateProject(active.id, { status: "uploaded", inputPath: "/private/input.mp4", prompt: "private" });

    const response = await GET();
    const payload = await response.json() as { activeProject?: Record<string, unknown> };
    expect(payload.activeProject).toMatchObject({ id: active.id, status: "uploaded" });
    expect(payload.activeProject).not.toHaveProperty("inputPath");
    expect(payload.activeProject).not.toHaveProperty("prompt");
  });

  it("does not misreport a database failure as unauthorized", async () => {
    const fixture = createTestDatabase({ migrate: false }); remove = fixture.remove;
    requireUserId.mockResolvedValue("42");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await GET();

    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "Internal server error" });
    expect(error).toHaveBeenCalledWith("API request failed", expect.objectContaining({ route: "GET /api/projects" }));
  });
});
