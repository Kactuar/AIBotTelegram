import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { appConfig } from "@/src/server/config";

const API_ROOT = "https://openrouter.ai/api/v1";
export const OPENROUTER_MODEL = "black-forest-labs/flux-video-edit";
export const OPENROUTER_REQUEST_TIMEOUT_MS = 30 * 1000;
export const OPENROUTER_DOWNLOAD_TIMEOUT_MS = 2 * 60 * 1000;
export const MAX_OPENROUTER_OUTPUT_BYTES = 100 * 1024 * 1024;

export type OpenRouterVideoTask = {
  id: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled" | "expired";
  error?: string;
  unsigned_urls?: string[];
};

export class OpenRouterError extends Error {
  constructor(message: string, readonly retryable: boolean, readonly retryAfterMs?: number, readonly statusCode?: number) {
    super(message);
    this.name = "OpenRouterError";
  }
}

function apiKey() {
  const value = appConfig().openRouterApi;
  if (!value) throw new OpenRouterError("openrouter_not_configured", false);
  return value;
}

function retryAfterMs(response: Response) {
  const value = response.headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (!Number.isNaN(seconds)) return Math.max(0, seconds * 1000);
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? undefined : Math.max(0, timestamp - Date.now());
}

async function request(pathname: string, init: RequestInit = {}, timeoutMs = OPENROUTER_REQUEST_TIMEOUT_MS) {
  const key = apiKey();
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${pathname}`, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...init.headers },
    });
  } catch (error) {
    throw new OpenRouterError(error instanceof Error ? error.message : "openrouter_network_failed", true);
  }
  if (!response.ok) {
    const body = await response.text();
    const retryable = response.status === 429 || response.status >= 500;
    throw new OpenRouterError(`openrouter_http_${response.status}: ${body.slice(-1000)}`, retryable, retryAfterMs(response), response.status);
  }
  return response;
}

export async function startOpenRouterEdit(sourceUrl: string, prompt: string) {
  const response = await request("/videos", {
    method: "POST",
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      prompt,
      input_references: [{ type: "video_url", video_url: { url: sourceUrl } }],
    }),
  });
  const payload = await response.json() as Partial<OpenRouterVideoTask>;
  if (!payload.id) throw new OpenRouterError("openrouter_invalid_submit_response", false);
  return payload.id;
}

export async function openRouterTask(jobId: string) {
  const response = await request(`/videos/${encodeURIComponent(jobId)}`, { method: "GET" });
  const payload = await response.json() as Partial<OpenRouterVideoTask>;
  if (!payload.id || !payload.status) throw new OpenRouterError("openrouter_invalid_status_response", false);
  return payload as OpenRouterVideoTask;
}

export async function downloadOpenRouterOutput(jobId: string, target: string) {
  const response = await request(`/videos/${encodeURIComponent(jobId)}/content?index=0`, { method: "GET" }, OPENROUTER_DOWNLOAD_TIMEOUT_MS);
  if (!response.body) throw new OpenRouterError("openrouter_empty_output", true);
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_OPENROUTER_OUTPUT_BYTES) throw new OpenRouterError("openrouter_output_too_large", false);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.part`;
  let size = 0;
  const limiter = new Transform({ transform(chunk, _encoding, callback) {
    size += chunk.length;
    callback(size > MAX_OPENROUTER_OUTPUT_BYTES ? new OpenRouterError("openrouter_output_too_large", false) : null, chunk);
  } });
  try {
    await pipeline(Readable.fromWeb(response.body as never), limiter, fs.createWriteStream(temporary));
    await fsp.rename(temporary, target);
  } catch (error) {
    await fsp.rm(temporary, { force: true });
    if (error instanceof OpenRouterError) throw error;
    throw new OpenRouterError(error instanceof Error ? error.message : "openrouter_output_download_failed", true);
  }
}
