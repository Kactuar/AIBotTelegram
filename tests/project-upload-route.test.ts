import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireUserId = vi.hoisted(() => vi.fn<() => Promise<string>>());
const canAcceptUpload = vi.hoisted(() => vi.fn<() => Promise<boolean>>());
vi.mock("@/src/server/auth", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/src/server/auth")>()), requireUserId }));
vi.mock("@/src/server/storage", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/src/server/storage")>()), canAcceptUpload }));

import { PUT } from "@/app/api/projects/[id]/input/route";
import { defaultMontageSettings } from "@/src/domain/montage";
import { createProject, projectById } from "@/src/server/projects";
import { createTestDatabase } from "./helpers";

let remove: (() => void) | undefined;
afterEach(() => { vi.restoreAllMocks(); remove?.(); remove = undefined; delete process.env.STORAGE_ROOT; });

describe("project upload route", () => {
  it("fails a project when its upload stream fails after the upload state is claimed", async () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    process.env.STORAGE_ROOT = path.join(fixture.root, "storage");
    requireUserId.mockResolvedValue("42");
    canAcceptUpload.mockResolvedValue(true);
    const project = createProject("upload-failure", "42", defaultMontageSettings);
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error("stream_failed")); } });
    const request = new Request("http://verification.local/api/projects/upload-failure/input", {
      method: "PUT",
      headers: { "Content-Type": "video/mp4" },
      body,
      duplex: "half",
    } as RequestInit);

    const response = await PUT(request, { params: Promise.resolve({ id: project.id }) });
    expect(response.status).toBe(400);
    expect(projectById(project.id)).toMatchObject({ status: "failed", errorCode: "upload_failed" });
  });
});
