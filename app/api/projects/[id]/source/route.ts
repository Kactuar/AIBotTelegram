import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { projectById } from "@/src/server/projects";
import { validSourceSignature } from "@/src/server/auth";
import { preparedSegmentPath } from "@/src/server/storage";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const segment = url.searchParams.get("segment") || "";
  const expires = url.searchParams.get("expires") || "";
  const signature = url.searchParams.get("signature");
  if (!validSourceSignature(id, segment, expires, signature)) return new NextResponse("Expired link", { status: 403 });
  const project = projectById(id);
  if (!project || project.status !== "processing" || !/^[12]$/.test(segment)) return new NextResponse("Not found", { status: 404 });
  const target = preparedSegmentPath(project.userId, id, Number(segment) as 1 | 2);
  try {
    const file = await fs.readFile(target);
    return new NextResponse(file, { headers: { "Content-Type": "video/mp4", "Content-Length": String(file.byteLength), "Content-Disposition": `inline; filename="segment-${segment}.mp4"`, "Cache-Control": "private, no-store" } });
  } catch { return new NextResponse("Not found", { status: 404 }); }
}
