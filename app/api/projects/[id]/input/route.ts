import { NextResponse } from "next/server";
import { requireUserId } from "@/src/server/auth";
import { projectById, updateProject } from "@/src/server/projects";
import { canAcceptUpload, extensionFor, inputPath, writeUpload } from "@/src/server/storage";

export const runtime = "nodejs";
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [userId, { id }] = await Promise.all([requireUserId(), context.params]);
    const project = projectById(id);
    if (!project || project.userId !== userId || project.status !== "draft") return NextResponse.json({ error: "Project cannot accept a file" }, { status: 409 });
    const extension = extensionFor(request.headers.get("content-type"));
    const declaredLength = Number(request.headers.get("content-length") || 0);
    if (!extension) return NextResponse.json({ error: "Use MP4, MOV, MKV or WebM" }, { status: 415 });
    if (declaredLength > 100 * 1024 * 1024) return NextResponse.json({ error: "Maximum upload size is 100 MB" }, { status: 413 });
    if (!request.body || !(await canAcceptUpload())) return NextResponse.json({ error: "Storage is temporarily full" }, { status: 507 });
    updateProject(id, { status: "uploading" });
    const target = inputPath(userId, id, extension);
    const size = await writeUpload(request.body, target);
    updateProject(id, { status: "uploaded", inputPath: target });
    return NextResponse.json({ size });
  } catch (error) {
    const message = error instanceof Error && error.message === "file_too_large" ? "Maximum upload size is 100 MB" : "Upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
