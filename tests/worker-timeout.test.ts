import { afterEach, describe, expect, it } from "vitest";
import { db } from "@/src/server/database";
import { defaultMontageSettings } from "@/src/domain/montage";
import { createProject, projectById, updateProject } from "@/src/server/projects";
import { advanceProject } from "@/src/worker";
import { createTestDatabase } from "./helpers";

let remove: (() => void) | undefined;
afterEach(() => { remove?.(); remove = undefined; });

describe("worker provider deadline", () => {
  it("rejects processing work that exceeds the provider deadline before it calls the provider", async () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    const project = createProject("timed-out", "42", defaultMontageSettings);
    updateProject(project.id, { status: "processing", inputPath: "/tmp/input.mp4" });
    db().prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(new Date(Date.now() - 2 * 60 * 60 * 1000 - 1).toISOString(), project.id);
    await expect(advanceProject(projectById(project.id)!)).rejects.toThrow("provider_job_timed_out");
  });
});
