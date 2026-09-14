import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultMontageSettings } from "@/src/domain/montage";
import { openRouterJob, saveOpenRouterJob, createProject, updateProject } from "@/src/server/projects";
import { editedSegmentPath, preparedSegmentPath } from "@/src/server/storage";
vi.mock("@/src/server/video-processing", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/src/server/video-processing")>()), inspectVideo: vi.fn().mockResolvedValue({ duration: 15, width: 720, height: 720 }) }));
import { advanceProject } from "@/src/worker";
import { createTestDatabase } from "./helpers";

let remove: (() => void) | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  remove?.();
  remove = undefined;
  delete process.env.STORAGE_ROOT;
  delete process.env.OPENROUTER_API;
  delete process.env.APP_URL;
});

describe("OpenRouter worker workflow", () => {
  it("submits the second segment only after the first completes", async () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    process.env.STORAGE_ROOT = path.join(fixture.root, "storage");
    process.env.OPENROUTER_API = "test-openrouter-key";
    process.env.APP_URL = "https://verification.local";
    const project = createProject("workflow", "42", defaultMontageSettings);
    updateProject(project.id, { status: "processing", inputPath: path.join(fixture.root, "input.mp4") });
    const first = preparedSegmentPath("42", project.id, 1);
    const second = preparedSegmentPath("42", project.id, 2);
    await fs.mkdir(path.dirname(first), { recursive: true });
    await fs.writeFile(first, "source-1");
    await fs.writeFile(second, "source-2");
    saveOpenRouterJob(project.id, { segmentIndex: 1, attempt: 1, jobId: "job-1", nextActionAt: new Date(0).toISOString() });
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "job-1", status: "completed" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(Buffer.from("edited-1"), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "job-2", status: "pending" }), { status: 202 }));
    await advanceProject({ ...project, status: "processing", inputPath: path.join(fixture.root, "input.mp4") });
    expect(await fs.readFile(editedSegmentPath("42", project.id, 1), "utf8")).toBe("edited-1");
    expect(openRouterJob(project.id)).toMatchObject({ segmentIndex: 2, jobId: "job-2", attempt: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
