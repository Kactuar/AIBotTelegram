import { NextResponse } from "next/server";
import { requireUserId } from "@/src/server/auth";
import { projectById, reserveGeneration } from "@/src/server/projects";
import { composePrompt } from "@/src/domain/montage";
import { internalServerError, unauthorizedResponse } from "@/src/server/http";

export const runtime = "nodejs";
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return unauthorizedResponse(); }
  const { id } = await context.params;
  try {
    const project = projectById(id);
    if (!project || project.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const reserved = reserveGeneration(id, userId, composePrompt(project.settings));
    if (!reserved.ok) return NextResponse.json({ error: reserved.reason === "insufficient_balance" ? "Not enough mock tokens" : "Project is not ready" }, { status: 409 });
    return NextResponse.json({ status: "queued", trial: reserved.trial, cost: reserved.cost });
  } catch (error) { return internalServerError("POST /api/projects/[id]/generate", error); }
}
