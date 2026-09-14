import { NextResponse } from "next/server";
import { requireUserId } from "@/src/server/auth";
import { failProject, projectById, startProjectUpload, completeProjectUpload } from "@/src/server/projects";
import { canAcceptUpload, extensionFor, inputPath, removeFile, writeUpload } from "@/src/server/storage";
import { MAX_VIDEO_UPLOAD_BYTES } from "@/src/domain/video-upload";
import { internalServerError, unauthorizedResponse } from "@/src/server/http";

export const runtime = "nodejs";
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const traceId = request.headers.get("x-upload-trace-id") || undefined;
  let userId: string;
  try { userId = await requireUserId(); } catch { return unauthorizedResponse(); }
  const { id } = await context.params;
  let uploadStarted = false;
  let fileWritten = false;
  let target: string | undefined;
  try {
    const project = projectById(id);
    const contentType = request.headers.get("content-type");
    const declaredLength = Number(request.headers.get("content-length") || 0);
    console.info("[video-upload]", JSON.stringify({ event: "upload_received", traceId, userId, projectId: id, contentType, declaredLength }));
    if (!project || project.userId !== userId || project.status !== "draft") {
      console.error("[video-upload]", JSON.stringify({ event: "upload_rejected", traceId, userId, projectId: id, reason: "project_cannot_accept_file" }));
      return NextResponse.json({ error: "Project cannot accept a file" }, { status: 409 });
    }
    const extension = extensionFor(contentType);
    if (!extension) {
      console.error("[video-upload]", JSON.stringify({ event: "upload_rejected", traceId, userId, projectId: id, reason: "unsupported_content_type", contentType }));
      return NextResponse.json({ error: "Use MP4, MOV, MKV or WebM" }, { status: 415 });
    }
    if (declaredLength > MAX_VIDEO_UPLOAD_BYTES) {
      console.error("[video-upload]", JSON.stringify({ event: "upload_rejected", traceId, userId, projectId: id, reason: "declared_too_large", declaredLength }));
      return NextResponse.json({ error: "Maximum upload size is 100 MB" }, { status: 413 });
    }
    if (!request.body || !(await canAcceptUpload())) {
      console.error("[video-upload]", JSON.stringify({ event: "upload_rejected", traceId, userId, projectId: id, reason: !request.body ? "missing_body" : "storage_full" }));
      return NextResponse.json({ error: "Storage is temporarily full" }, { status: 507 });
    }
    if (!startProjectUpload(id, userId)) return NextResponse.json({ error: "Project cannot accept a file" }, { status: 409 });
    uploadStarted = true;
    target = inputPath(userId, id, extension);
    const size = await writeUpload(request.body, target);
    fileWritten = true;
    if (!completeProjectUpload(id, userId, target)) throw new Error("upload_state_changed");
    console.info("[video-upload]", JSON.stringify({ event: "upload_saved", traceId, userId, projectId: id, extension, size }));
    return NextResponse.json({ size });
  } catch (error) {
    if (uploadStarted) {
      failProject(id, "upload_failed");
      await removeFile(target || null).catch(() => undefined);
    }
    console.error("[video-upload]", JSON.stringify({ event: "upload_failed", traceId, reason: error instanceof Error ? error.message : "unknown" }));
    if (error instanceof Error && error.message === "file_too_large") return NextResponse.json({ error: "Maximum upload size is 100 MB" }, { status: 413 });
    if (uploadStarted && !fileWritten) return NextResponse.json({ error: "Upload failed" }, { status: 400 });
    return internalServerError("PUT /api/projects/[id]/input", error);
  }
}
