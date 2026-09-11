import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { projectById } from "@/src/lib/database";
import { validDownloadSignature } from "@/src/lib/auth";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(request.url);
  if (!validDownloadSignature(id, url.searchParams.get("expires") || "", url.searchParams.get("signature"))) return new NextResponse("Expired link", { status: 403 });
  const project = projectById(id);
  const target = project?.isTrial && !project.trialUnlockedAt ? project.watermarkedResultPath : project?.resultPath;
  if (!target || project?.status !== "completed") return new NextResponse("Not found", { status: 404 });
  try {
    const file = await fs.readFile(target);
    return new NextResponse(file, { headers: { "Content-Type": "video/mp4", "Content-Disposition": `attachment; filename="brandly-${id}.mp4"`, "Cache-Control": "private, no-store" } });
  } catch { return new NextResponse("Not found", { status: 404 }); }
}
