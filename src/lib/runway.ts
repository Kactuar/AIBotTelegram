import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import RunwayML from "@runwayml/sdk";
import { appConfig } from "@/src/lib/config";

function client() {
  const secret = appConfig().runwaySecret;
  if (!secret) throw new Error("runway_not_configured");
  return new RunwayML({ apiKey: secret });
}

export async function startRunwayEdit(input: string, prompt: string) {
  const runway = client();
  const uploaded = await runway.uploads.createEphemeral({ file: fs.createReadStream(input) });
  const task = await runway.videoToVideo.create({ model: "aleph2", videoUri: uploaded.uri, promptText: prompt, outputFormat: "mp4" });
  return task.id;
}

export async function runwayTask(taskId: string) { return client().tasks.retrieve(taskId); }

export async function downloadRunwayOutput(url: string, target: string) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error("runway_output_download_failed");
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.part`;
  try { await pipeline(Readable.fromWeb(response.body as never), fs.createWriteStream(temporary)); await fsp.rename(temporary, target); }
  catch (error) { await fsp.rm(temporary, { force: true }); throw error; }
}
