import { afterEach, describe, expect, it, vi } from "vitest";

const requireUserId = vi.hoisted(() => vi.fn<() => Promise<string>>());
vi.mock("@/src/server/auth", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/src/server/auth")>()), requireUserId }));

import { GET } from "@/app/api/projects/[id]/route";
import { defaultMontageSettings } from "@/src/domain/montage";
import { createProject, updateProject } from "@/src/server/projects";
import { createTestDatabase } from "./helpers";

let remove: (() => void) | undefined;
afterEach(() => { vi.restoreAllMocks(); remove?.(); remove = undefined; });

describe("public project API response", () => {
  it("does not disclose persistence paths, ownership, prompt, provider, or token fields", async () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    requireUserId.mockResolvedValue("42");
    const project = createProject("project-42", "42", defaultMontageSettings);
    updateProject(project.id, {
      status: "processing",
      prompt: "private prompt",
      inputPath: "/srv/aibot/storage/42/input.mp4",
      resultPath: "/srv/aibot/storage/42/result.mp4",
      watermarkedResultPath: "/srv/aibot/storage/42/watermarked.mp4",
      runwayTaskId: "provider-job",
      reservedTokens: 23,
    });

    const response = await GET(new Request("http://verification.local/api/projects/project-42"), { params: Promise.resolve({ id: project.id }) });
    expect(response.status).toBe(200);
    const payload = await response.json() as { project: Record<string, unknown> };
    expect(payload.project).toMatchObject({ id: project.id, status: "processing", errorCode: null, isTrial: false });
    for (const key of ["userId", "prompt", "inputPath", "resultPath", "watermarkedResultPath", "runwayTaskId", "reservedTokens"]) expect(payload.project).not.toHaveProperty(key);
  });
});
