import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GET as source } from "@/app/api/projects/[id]/source/route";
import { sourceSignature } from "@/src/server/auth";
import { createProject, updateProject } from "@/src/server/projects";
import { preparedSegmentPath } from "@/src/server/storage";
import { defaultMontageSettings } from "@/src/domain/montage";
import { createTestDatabase } from "./helpers";

let remove: (() => void) | undefined;
afterEach(() => { remove?.(); remove = undefined; });

describe("signed OpenRouter source route", () => {
  it("serves only a valid, active segment URL", async () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    const project = createProject("source-project", "42", defaultMontageSettings);
    updateProject(project.id, { status: "processing" });
    const target = preparedSegmentPath("42", project.id, 1);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, Buffer.from("segment"));
    const expires = String(Math.floor(Date.now() / 1000) + 300);
    const signature = sourceSignature(project.id, "1", expires);
    const response = await source(new Request(`http://verification.local/api/projects/${project.id}/source?segment=1&expires=${expires}&signature=${signature}`), { params: Promise.resolve({ id: project.id }) });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("segment");
    expect(response.headers.get("content-type")).toContain("video/mp4");
  });

  it("rejects forged, expired, invalid-segment and non-processing requests", async () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    const project = createProject("source-project", "42", defaultMontageSettings);
    const future = String(Math.floor(Date.now() / 1000) + 300);
    const valid = sourceSignature(project.id, "1", future);
    const forged = await source(new Request("http://verification.local"), { params: Promise.resolve({ id: project.id }) });
    expect(forged.status).toBe(403);
    const expired = await source(new Request(`http://verification.local?segment=1&expires=1&signature=${valid}`), { params: Promise.resolve({ id: project.id }) });
    expect(expired.status).toBe(403);
    const invalidSegment = await source(new Request(`http://verification.local?segment=3&expires=${future}&signature=${valid}`), { params: Promise.resolve({ id: project.id }) });
    expect(invalidSegment.status).toBe(403);
  });
});
