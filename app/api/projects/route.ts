import crypto from "node:crypto";
import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { downloadSignature, requireUserId } from "@/src/server/auth";
import { appConfig } from "@/src/server/config";
import { availableProjects, createProject, hasActiveProject } from "@/src/server/projects";
import { getUser } from "@/src/server/users";

export const runtime = "nodejs";
const DOWNLOAD_LINK_SECONDS = 60 * 60;

async function existingProject(project: ReturnType<typeof availableProjects>[number]) {
  const target = project.isTrial && !project.trialUnlockedAt ? project.watermarkedResultPath : project.resultPath;
  if (!target || !project.resultExpiresAt) return undefined;
  try { await fs.access(target); } catch { return undefined; }
  const now = Math.floor(Date.now() / 1000);
  const expires = String(Math.min(now + DOWNLOAD_LINK_SECONDS, Math.floor(new Date(project.resultExpiresAt).getTime() / 1000)));
  if (Number(expires) <= now) return undefined;
  const url = new URL(`/api/projects/${project.id}/video`, appConfig().appUrl);
  url.searchParams.set("expires", expires);
  url.searchParams.set("signature", downloadSignature(project.id, expires));
  return { id: project.id, settings: project.settings, isTrial: project.isTrial, trialUnlockedAt: project.trialUnlockedAt, createdAt: project.createdAt, resultExpiresAt: project.resultExpiresAt, downloadUrl: url.toString() };
}

export async function GET() {
  try {
    const userId = await requireUserId();
    const projects = (await Promise.all(availableProjects(userId).map(existingProject))).filter((project): project is NonNullable<typeof project> => Boolean(project));
    return NextResponse.json({ projects });
  } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
}

export async function POST() {
  try {
    const userId = await requireUserId();
    if (hasActiveProject(userId)) return NextResponse.json({ error: "Finish the current project first" }, { status: 409 });
    const project = createProject(crypto.randomUUID(), userId, getUser(userId).settings);
    return NextResponse.json({ project });
  } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
}
