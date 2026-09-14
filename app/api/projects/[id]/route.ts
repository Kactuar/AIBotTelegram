import { NextResponse } from "next/server";
import { requireUserId } from "@/src/server/auth";
import { cancelProject, projectById, publicProject } from "@/src/server/projects";
import { internalServerError, unauthorizedResponse } from "@/src/server/http";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  let userId: string;
  let id: string;
  try {
    [userId, { id }] = await Promise.all([requireUserId(), context.params]);
  } catch { return unauthorizedResponse(); }
  try {
    const project = projectById(id);
    if (!project || project.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ project: publicProject(project) });
  } catch (error) { return internalServerError("GET /api/projects/[id]", error); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  let userId: string;
  let id: string;
  try {
    [userId, { id }] = await Promise.all([requireUserId(), context.params]);
  } catch { return unauthorizedResponse(); }
  try {
    const result = cancelProject(id, userId);
    if (result === "not_found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (result === "not_cancellable") return NextResponse.json({ error: "Project cannot be cancelled" }, { status: 409 });
    return new NextResponse(null, { status: 204 });
  } catch (error) { return internalServerError("DELETE /api/projects/[id]", error); }
}
