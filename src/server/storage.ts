import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { appConfig } from "@/src/server/config";

const MAX_BYTES = 100 * 1024 * 1024;
const MIN_FREE_BYTES = 10 * 1024 * 1024 * 1024;
const extensions: Record<string, string> = { "video/mp4": ".mp4", "video/quicktime": ".mov", "video/x-matroska": ".mkv", "video/webm": ".webm" };

export function extensionFor(contentType: string | null) { return contentType ? extensions[contentType.split(";")[0].toLowerCase()] : undefined; }
export function projectDirectory(userId: string, projectId: string) { return path.join(appConfig().storageRoot, userId, projectId); }
export function inputPath(userId: string, projectId: string, extension: string) { return path.join(projectDirectory(userId, projectId), `input${extension}`); }
export function resultPath(userId: string, projectId: string) { return path.join(projectDirectory(userId, projectId), "result.mp4"); }
export function watermarkedResultPath(userId: string, projectId: string) { return path.join(projectDirectory(userId, projectId), "trial-watermarked.mp4"); }
export function preparedSegmentPath(userId: string, projectId: string, segment: 1 | 2) { return path.join(projectDirectory(userId, projectId), `segment-${segment}.mp4`); }
export function editedSegmentPath(userId: string, projectId: string, segment: 1 | 2) { return path.join(projectDirectory(userId, projectId), `edited-${segment}.mp4`); }

export async function canAcceptUpload() {
  const root = appConfig().storageRoot;
  await fsp.mkdir(root, { recursive: true });
  const stats = await fsp.statfs(root);
  return stats.bavail * stats.bsize >= MIN_FREE_BYTES;
}

export async function writeUpload(body: ReadableStream<Uint8Array>, target: string) {
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.part`;
  let size = 0;
  const limiter = new Transform({ transform(chunk, _encoding, callback) { size += chunk.length; callback(size > MAX_BYTES ? new Error("file_too_large") : null, chunk); } });
  try {
    await pipeline(Readable.fromWeb(body as never), limiter, fs.createWriteStream(temporary, { flags: "w" }));
    await fsp.rename(temporary, target);
    return size;
  } catch (error) {
    await fsp.rm(temporary, { force: true });
    throw error;
  }
}

export async function removeFile(file: string | null) { if (file) await fsp.rm(file, { force: true }); }
