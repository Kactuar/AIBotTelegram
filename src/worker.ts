import dotenv from "dotenv";
dotenv.config({ path: process.env.AIBOT_ENV_PATH || ".env.local" });
import fs from "node:fs/promises";
import { Api } from "grammy";
import { appConfig } from "@/src/server/config";
import { db } from "@/src/server/database";
import { claimQueuedProject, clearOpenRouterJob, expiredResults, failProject, finishProject, openRouterJob, projectById, saveOpenRouterJob, updateProject } from "@/src/server/projects";
import { getBotLanguage } from "@/src/server/users";
import { translations } from "@/src/bot/i18n";
import { downloadSignature, sourceSignature } from "@/src/server/auth";
import { downloadOpenRouterOutput, openRouterTask, OpenRouterError, startOpenRouterEdit } from "@/src/server/openrouter";
import { editedSegmentPath, preparedSegmentPath, removeFile, resultPath, watermarkedResultPath } from "@/src/server/storage";
import { createWatermark } from "@/src/server/watermark";
import { composePrompt } from "@/src/domain/montage";
import { concatVideoSegments, prepareVideoSegments, removeVideoIntermediates } from "@/src/server/video-processing";

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const POLL_INTERVAL_MS = 30 * 1000;
const RETRY_DELAY_MS = 30 * 1000;
const MAX_ATTEMPTS = 2;
let lastCleanup = 0;

async function notifyCompleted(projectId: string) {
  const project = projectById(projectId);
  if (!project) return;
  const expires = String(Math.floor(Date.now() / 1000) + 72 * 60 * 60);
  const link = `${appConfig().appUrl}/api/projects/${project.id}/video?expires=${expires}&signature=${downloadSignature(project.id, expires)}`;
  await new Api(appConfig().botToken).sendMessage(project.userId, translations[getBotLanguage(project.userId)].completed(link));
}

function sourceUrl(projectId: string, segment: 1 | 2) {
  const expires = String(Math.floor(Date.now() / 1000) + 2 * 60 * 60);
  const signature = sourceSignature(projectId, String(segment), expires);
  const url = new URL(`/api/projects/${projectId}/source`, appConfig().appUrl);
  if (url.protocol !== "https:") throw new Error("public_source_url_required");
  url.searchParams.set("segment", String(segment));
  url.searchParams.set("expires", expires);
  url.searchParams.set("signature", signature);
  return url.toString();
}

async function exists(filename: string) {
  try { await fs.access(filename); return true; } catch { return false; }
}

function retryAt(delay = RETRY_DELAY_MS) { return new Date(Date.now() + delay).toISOString(); }

function retryableTaskFailure(message = "") {
  return !/(safety|content policy|moderation|policy violation|disallowed)/i.test(message);
}

function failureCode(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "openrouter_not_configured") return "provider_not_configured";
  if (message.startsWith("invalid_video") || message.startsWith("video_probe") || message.startsWith("video_segment")) return "invalid_video";
  return "provider_failed";
}

async function cleanupFailedProject(projectId: string, userId: string, inputPath: string | null) {
  await removeFile(inputPath);
  await removeFile(resultPath(userId, projectId));
  await removeFile(watermarkedResultPath(userId, projectId));
  await removeVideoIntermediates(userId, projectId);
  clearOpenRouterJob(projectId);
}

async function failAndCleanup(projectId: string, code: string) {
  const project = projectById(projectId);
  if (!project) return;
  await cleanupFailedProject(project.id, project.userId, project.inputPath);
  failProject(project.id, code);
}

async function submitSegment(project: NonNullable<ReturnType<typeof projectById>>, segment: 1 | 2, count: 1 | 2, attempt: number) {
  saveOpenRouterJob(project.id, { segmentIndex: segment, attempt, jobId: null, nextActionAt: new Date().toISOString() });
  const prompt = composePrompt(project.settings, { segmentIndex: segment, segmentCount: count });
  const jobId = await startOpenRouterEdit(sourceUrl(project.id, segment), prompt);
  saveOpenRouterJob(project.id, { segmentIndex: segment, attempt, jobId, nextActionAt: retryAt(POLL_INTERVAL_MS) });
}

async function submitSegmentWithRetry(project: NonNullable<ReturnType<typeof projectById>>, segment: 1 | 2, count: 1 | 2, attempt: number) {
  try {
    await submitSegment(project, segment, count, attempt);
    return true;
  } catch (error) {
    const current = openRouterJob(project.id);
    if (error instanceof OpenRouterError && error.retryable && current && current.attempt < MAX_ATTEMPTS) {
      saveOpenRouterJob(project.id, { ...current, attempt: current.attempt + 1, jobId: null, nextActionAt: retryAt(error.retryAfterMs || RETRY_DELAY_MS) });
      return false;
    }
    throw error;
  }
}

async function prepareAndSubmit(project: NonNullable<ReturnType<typeof projectById>>) {
  if (!project.inputPath) throw new Error("missing_project_input");
  const prepared = await prepareVideoSegments(project.inputPath, project.userId, project.id);
  await submitSegmentWithRetry(project, 1, prepared.count, 1);
}

export async function advanceProject(project: NonNullable<ReturnType<typeof projectById>>) {
  const job = openRouterJob(project.id);
  if (!job) {
    await prepareAndSubmit(project);
    return;
  }
  if (Date.parse(job.nextActionAt) > Date.now()) return;
  const segment = job.segmentIndex;
  if (!job.jobId) {
    try {
      const count = await exists(preparedSegmentPath(project.userId, project.id, 2)) ? 2 : 1;
      await submitSegment(project, segment, count, job.attempt);
    } catch (error) {
      if (error instanceof OpenRouterError && error.retryable && job.attempt < MAX_ATTEMPTS) saveOpenRouterJob(project.id, { ...job, attempt: job.attempt + 1, jobId: null, nextActionAt: retryAt(error.retryAfterMs || RETRY_DELAY_MS) });
      else throw error;
    }
    return;
  }
  try {
    const task = await openRouterTask(job.jobId);
    if (task.status === "pending" || task.status === "in_progress") {
      saveOpenRouterJob(project.id, { ...job, nextActionAt: retryAt(POLL_INTERVAL_MS) });
      return;
    }
    if (task.status !== "completed") {
      if (retryableTaskFailure(task.error) && job.attempt < MAX_ATTEMPTS) saveOpenRouterJob(project.id, { ...job, attempt: job.attempt + 1, jobId: null, nextActionAt: retryAt(RETRY_DELAY_MS) });
      else throw new Error(`provider_${task.status}: ${task.error || "unknown failure"}`);
      return;
    }
    const output = editedSegmentPath(project.userId, project.id, segment);
    await downloadOpenRouterOutput(job.jobId, output);
    const hasSecond = await exists(preparedSegmentPath(project.userId, project.id, 2));
    if (segment === 1 && hasSecond) {
      await submitSegmentWithRetry(project, 2, 2, 1);
      return;
    }
    const target = resultPath(project.userId, project.id);
    await concatVideoSegments(project.userId, project.id, hasSecond ? 2 : 1, target);
    const latest = projectById(project.id);
    const watermarked = latest?.isTrial && !latest.trialUnlockedAt ? watermarkedResultPath(project.userId, project.id) : undefined;
    if (watermarked) {
      try { await createWatermark(target, watermarked); }
      catch (error) { await removeFile(target); await removeFile(watermarked); throw error; }
    }
    finishProject(project.id, target, watermarked);
    try {
      await removeFile(project.inputPath);
      await removeVideoIntermediates(project.userId, project.id);
      clearOpenRouterJob(project.id);
    } catch (cleanupError) { console.error("Unable to clean completed OpenRouter project", cleanupError); }
    try { await notifyCompleted(project.id); }
    catch (notificationError) { console.error("Unable to notify completed project", notificationError); }
  } catch (error) {
    if (error instanceof OpenRouterError && error.retryable && job.attempt < MAX_ATTEMPTS) {
      saveOpenRouterJob(project.id, { ...job, attempt: job.attempt + 1, nextActionAt: retryAt(error.retryAfterMs || RETRY_DELAY_MS) });
      return;
    }
    throw error;
  }
}

async function processProject() {
  const project = claimQueuedProject();
  if (!project) return;
  try { await advanceProject(project); }
  catch (error) { console.error("Unable to start OpenRouter task", error); await failAndCleanup(project.id, failureCode(error)); }
}

async function processRunningProjects() {
  const rows = db().prepare("SELECT id FROM projects WHERE status = 'processing'").all() as { id: string }[];
  for (const row of rows) {
    const project = projectById(row.id);
    if (!project) continue;
    try { await advanceProject(project); }
    catch (error) { console.error("Unable to update OpenRouter task", error); await failAndCleanup(project.id, failureCode(error)); }
  }
}

async function cleanup() {
  if (Date.now() - lastCleanup < 60 * 60 * 1000) return;
  lastCleanup = Date.now();
  for (const project of expiredResults()) {
    await removeFile(project.resultPath);
    await removeFile(project.watermarkedResultPath);
    updateProject(project.id, { resultPath: null, watermarkedResultPath: null });
  }
}

async function run() {
  db();
  console.info("aibot worker started");
  while (true) {
    await cleanup();
    await processRunningProjects();
    await processProject();
    await pause(5000);
  }
}

if (process.env.NODE_ENV !== "test" && process.env.VITEST !== "true") run().catch((error) => { console.error("Worker stopped", error); process.exitCode = 1; });
