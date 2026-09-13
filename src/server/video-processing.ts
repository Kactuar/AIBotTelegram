import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fsp from "node:fs/promises";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { editedSegmentPath, preparedSegmentPath, projectDirectory } from "@/src/server/storage";

const executable = process.env.FFMPEG_PATH || ffmpegPath;
const MAX_DURATION_SECONDS = 30;
const MAX_SEGMENT_SECONDS = 15;
const MAX_SEGMENT_BYTES = 50 * 1024 * 1024;

type VideoInfo = { duration: number; width: number; height: number };

function ffmpeg() {
  if (!executable) throw new Error("ffmpeg_not_configured");
  return executable;
}

async function run(args: string[], code: string) {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(ffmpeg(), ["-hide_banner", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("error", reject);
    child.on("close", (exitCode) => exitCode === 0 ? resolve(stderr) : reject(new Error(`${code}: ${stderr.trim().slice(-1200)}`)));
  });
}

function clockToSeconds(value: string) {
  const [hours, minutes, seconds] = value.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

function parseInfo(stderr: string): VideoInfo {
  const duration = /Duration:\s+(\d{2}:\d{2}:\d{2}\.\d+)/.exec(stderr)?.[1];
  const size = /,\s+(\d{2,5})x(\d{2,5})(?:[,\s]|$)/.exec(stderr);
  if (!duration || !size) throw new Error("video_probe_failed");
  return { duration: clockToSeconds(duration), width: Number(size[1]), height: Number(size[2]) };
}

export async function inspectVideo(input: string, validateSource = true) {
  const stderr = await run(["-i", input, "-map", "0:v:0", "-frames:v", "1", "-f", "null", "-"], "video_probe_failed");
  const info = parseInfo(stderr);
  if (validateSource && (info.duration < 2 || info.duration > MAX_DURATION_SECONDS + 0.05)) throw new Error("invalid_video_dimensions_or_duration");
  return info;
}

async function normalizeSegment(input: string, target: string, start: number, duration?: number) {
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.part`;
  const args = [
    "-y", "-i", input, "-ss", String(start), ...(duration === undefined ? [] : ["-t", String(duration)]),
    "-map", "0:v:0", "-map", "0:a?", "-vf", "scale=720:720:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
    "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-maxrate", "8M", "-bufsize", "16M", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-f", "mp4", temporary,
  ];
  try {
    await run(args, "video_segment_failed");
    const stats = await fsp.stat(temporary);
    if (stats.size > MAX_SEGMENT_BYTES) throw new Error("video_segment_too_large");
    if ((await inspectVideo(temporary, false)).duration > MAX_SEGMENT_SECONDS + 0.1) throw new Error("video_segment_too_long");
    await fsp.rename(temporary, target);
  } catch (error) {
    await fsp.rm(temporary, { force: true });
    throw error;
  }
}

export async function prepareVideoSegments(input: string, userId: string, projectId: string) {
  const info = await inspectVideo(input);
  const count = info.duration > MAX_SEGMENT_SECONDS + 0.05 ? 2 : 1;
  const first = preparedSegmentPath(userId, projectId, 1);
  const second = preparedSegmentPath(userId, projectId, 2);
  await Promise.all([fsp.rm(first, { force: true }), fsp.rm(second, { force: true })]);
  await normalizeSegment(input, first, 0, count === 2 ? MAX_SEGMENT_SECONDS : info.duration);
  if (count === 2) await normalizeSegment(input, second, MAX_SEGMENT_SECONDS);
  return { count: count as 1 | 2, paths: count === 2 ? [first, second] as [string, string] : [first] as [string] };
}

function concatEntry(file: string) { return `file '${file.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`; }

export async function concatVideoSegments(userId: string, projectId: string, count: 1 | 2, target: string) {
  const list = path.join(projectDirectory(userId, projectId), `.concat-${crypto.randomUUID()}.txt`);
  const files = Array.from({ length: count }, (_, index) => editedSegmentPath(userId, projectId, (index + 1) as 1 | 2));
  await fsp.writeFile(list, `${files.map(concatEntry).join("\n")}\n`, "utf8");
  const temporary = `${target}.part`;
  try {
    await run([
      "-y", "-f", "concat", "-safe", "0", "-i", list,
      "-map", "0:v:0", "-map", "0:a?", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-f", "mp4", temporary,
    ], "video_concat_failed");
    await fsp.rename(temporary, target);
  } catch (error) {
    await fsp.rm(temporary, { force: true });
    throw error;
  } finally {
    await fsp.rm(list, { force: true });
  }
}

export async function removeVideoIntermediates(userId: string, projectId: string) {
  await Promise.all([
    fsp.rm(preparedSegmentPath(userId, projectId, 1), { force: true }),
    fsp.rm(preparedSegmentPath(userId, projectId, 2), { force: true }),
    fsp.rm(editedSegmentPath(userId, projectId, 1), { force: true }),
    fsp.rm(editedSegmentPath(userId, projectId, 2), { force: true }),
  ]);
}
