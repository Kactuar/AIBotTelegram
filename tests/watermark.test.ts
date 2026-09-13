import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { afterEach, expect, test } from "vitest";
import { createWatermark } from "@/src/server/watermark";
import { createTestDatabase } from "./helpers";

let remove: (() => void) | undefined;
afterEach(() => { remove?.(); remove = undefined; });

test("creates a non-empty watermarked video", async () => {
  const fixture = createTestDatabase(); remove = fixture.remove;
  const executable = ffmpegPath;
  if (!executable) throw new Error("ffmpeg-static is required for trial watermarks");
  const input = path.join(fixture.root, "input.mp4");
  const output = path.join(fixture.root, "output.mp4");
  await new Promise<void>((resolve, reject) => {
    const process = spawn(executable, ["-y", "-f", "lavfi", "-i", "color=c=blue:s=360x640:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", input]);
    let stderr = "";
    process.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    process.on("error", reject);
    process.on("close", (code: number | null) => code === 0 ? resolve() : reject(new Error(`ffmpeg_fixture_failed: ${stderr.trim().slice(-1000)}`)));
  });
  await createWatermark(input, output);
  expect(fs.statSync(output).size).toBeGreaterThan(0);
});
