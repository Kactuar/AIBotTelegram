import dotenv from "dotenv";
dotenv.config({ path: process.env.AIBOT_ENV_PATH || ".env.local" });
import fs from "node:fs/promises";
import { Api } from "grammy";
import { appConfig } from "@/src/lib/config";
import { claimQueuedProject, db, expiredResults, failProject, finishProject, getBotLanguage, projectById, updateProject } from "@/src/lib/database";
import { translations } from "@/src/bot/i18n";
import { downloadSignature } from "@/src/lib/auth";
import { downloadRunwayOutput, runwayTask, startRunwayEdit } from "@/src/lib/runway";
import { removeFile, resultPath, watermarkedResultPath } from "@/src/lib/storage";
import { createWatermark } from "@/src/lib/watermark";

const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
let lastCleanup = 0;

async function notifyCompleted(projectId: string) {
  const project = projectById(projectId);
  if (!project) return;
  const expires = String(Math.floor(Date.now() / 1000) + 72 * 60 * 60);
  const link = `${appConfig().appUrl}/api/projects/${project.id}/video?expires=${expires}&signature=${downloadSignature(project.id, expires)}`;
  await new Api(appConfig().botToken).sendMessage(project.userId, translations[getBotLanguage(project.userId)].completed(link));
}

async function processProject() {
  const project = claimQueuedProject();
  if (!project) return;
  try {
    if (!project.inputPath || !project.prompt) throw new Error("missing_project_input");
    const taskId = await startRunwayEdit(project.inputPath, project.prompt);
    updateProject(project.id, { runwayTaskId: taskId, status: "processing" });
    await removeFile(project.inputPath);
    updateProject(project.id, { inputPath: null });
  } catch (error) {
    console.error("Unable to start Runway task", error);
    failProject(project.id, error instanceof Error && error.message === "runway_not_configured" ? "provider_not_configured" : "provider_start_failed");
  }
}

async function processRunningProjects() {
  const database = db();
  const rows = database.prepare("SELECT id FROM projects WHERE status = 'processing' AND runway_task_id IS NOT NULL").all() as { id: string }[];
  for (const row of rows) {
    const project = projectById(row.id);
    if (!project?.runwayTaskId) continue;
    try {
      const task = await runwayTask(project.runwayTaskId);
      if (task.status === "FAILED" || task.status === "CANCELLED") failProject(project.id, task.status === "FAILED" ? task.failureCode || "provider_failed" : "provider_cancelled");
      if (task.status === "SUCCEEDED") {
        const output = task.output[0];
        if (!output) throw new Error("provider_empty_output");
        const target = resultPath(project.userId, project.id);
        await downloadRunwayOutput(output, target);
        const latest = projectById(project.id);
        const watermarked = latest?.isTrial && !latest.trialUnlockedAt ? watermarkedResultPath(project.userId, project.id) : undefined;
        if (watermarked) {
          try { await createWatermark(target, watermarked); }
          catch (error) { await removeFile(target); await removeFile(watermarked); throw error; }
        }
        finishProject(project.id, target, watermarked);
        await notifyCompleted(project.id);
      }
    } catch (error) {
      console.error("Unable to update Runway task", error);
      failProject(project.id, "provider_poll_failed");
    }
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

run().catch((error) => { console.error("Worker stopped", error); process.exitCode = 1; });
