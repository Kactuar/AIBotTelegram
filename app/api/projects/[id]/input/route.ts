import { NextResponse } from "next/server";
import { requireUserId } from "@/src/server/auth";
import { projectById, updateProject } from "@/src/server/projects";
import { canAcceptUpload, extensionFor, inputPath, writeUpload } from "@/src/server/storage";
import { MAX_VIDEO_UPLOAD_BYTES } from "@/src/domain/video-upload";

export const runtime = "nodejs";
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const traceId = request.headers.get("x-upload-trace-id") || undefined;
  try {
    const [userId, { id }] = await Promise.all([requireUserId(), context.params]);
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
    updateProject(id, { status: "uploading" });
    const target = inputPath(userId, id, extension);
    const size = await writeUpload(request.body, target);
    updateProject(id, { status: "uploaded", inputPath: target });
    console.info("[video-upload]", JSON.stringify({ event: "upload_saved", traceId, userId, projectId: id, extension, size }));
    return NextResponse.json({ size });
  } catch (error) {
    const message = error instanceof Error && error.message === "file_too_large" ? "Maximum upload size is 100 MB" : "Upload failed";
    console.error("[video-upload]", JSON.stringify({ event: "upload_failed", traceId, reason: error instanceof Error ? error.message : "unknown" }));
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
