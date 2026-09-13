import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { afterEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "./helpers";
import { concatVideoSegments, inspectVideo, prepareVideoSegments } from "@/src/server/video-processing";
import { editedSegmentPath, resultPath } from "@/src/server/storage";

let remove: (() => void) | undefined;
afterEach(() => {
  remove?.();
  remove = undefined;
  delete process.env.STORAGE_ROOT;
});

async function fixtureVideo(target: string, seconds: number, size = "360x640") {
  const executable = ffmpegPath;
  if (!executable) throw new Error("ffmpeg-static is required for video processing tests");
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, ["-y", "-f", "lavfi", "-i", `color=c=blue:s=${size}:d=${seconds}`, "-c:v", "libx264", "-pix_fmt", "yuv420p", target], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(stderr.slice(-1000))));
  });
}

describe("FFmpeg video preparation", () => {
  it("keeps short videos as one segment", async () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    process.env.STORAGE_ROOT = path.join(fixture.root, "storage");
    const input = path.join(fixture.root, "input.mp4");
    await fixtureVideo(input, 3, "640x360");
    const prepared = await prepareVideoSegments(input, "42", "short");
    expect(prepared.count).toBe(1);
    const info = await inspectVideo(prepared.paths[0]);
    expect(info.height).toBeLessThanOrEqual(720);
    expect(info.width).toBeLessThanOrEqual(720);
    expect(info.width).toBeGreaterThan(info.height);
  });

  it("splits long videos, preserves order and concatenates the edited parts", async () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    process.env.STORAGE_ROOT = path.join(fixture.root, "storage");
    const input = path.join(fixture.root, "input.mp4");
    await fixtureVideo(input, 16);
    const prepared = await prepareVideoSegments(input, "42", "long");
    expect(prepared.count).toBe(2);
    for (const [index, source] of prepared.paths.entries()) {
      expect((await inspectVideo(source, false)).duration).toBeLessThanOrEqual(15.1);
      await fs.copyFile(source, editedSegmentPath("42", "long", (index + 1) as 1 | 2));
    }
    const target = resultPath("42", "long");
    await concatVideoSegments("42", "long", 2, target);
    expect((await inspectVideo(target)).duration).toBeGreaterThan(15);
  }, 30000);
});
