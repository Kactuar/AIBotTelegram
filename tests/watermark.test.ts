import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { afterEach, expect, test } from "vitest";
import { createWatermark } from "@/src/server/watermark";
import { createTestDatabase } from "./helpers";

let remove: (() => void) | undefined;
afterEach(() => { remove?.(); remove = undefined; });

async function decodedFrames(executable: string, file: string) {
  return new Promise<number>((resolve, reject) => {
    const process = spawn(executable, ["-hide_banner", "-i", file, "-map", "0:v:0", "-f", "null", "-"]);
    let stderr = "";
    process.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    process.on("error", reject);
    process.on("close", (code: number | null) => {
      const frames = [...stderr.matchAll(/frame=\s*(\d+)/g)].map((match) => Number(match[1]));
      if (code === 0 && frames.length) resolve(frames.at(-1)!);
      else reject(new Error(`ffmpeg_decode_failed: ${stderr.trim().slice(-1000)}`));
    });
  });
}

test("preserves multiple video frames in a watermarked video", async () => {
  const fixture = createTestDatabase(); remove = fixture.remove;
  const executable = ffmpegPath;
  if (!executable) throw new Error("ffmpeg-static is required for trial watermarks");
  const input = path.join(fixture.root, "input.mp4");
  const output = path.join(fixture.root, "output.mp4");
  await new Promise<void>((resolve, reject) => {
    const process = spawn(executable, ["-y", "-f", "lavfi", "-i", "color=c=blue:s=360x640:d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", input]);
    let stderr = "";
    process.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    process.on("error", reject);
    process.on("close", (code: number | null) => code === 0 ? resolve() : reject(new Error(`ffmpeg_fixture_failed: ${stderr.trim().slice(-1000)}`)));
  });
  await createWatermark(input, output);
  expect(fs.statSync(output).size).toBeGreaterThan(0);
  expect(await decodedFrames(executable, output)).toBeGreaterThan(40);
});
