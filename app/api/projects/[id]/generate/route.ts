import { NextResponse } from "next/server";
import { isAllowedUser, requireUserId } from "@/src/lib/auth";
import { projectById, reserveGeneration } from "@/src/lib/database";
import { composePrompt } from "@/src/lib/prompt";

export const runtime = "nodejs";
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [userId, { id }] = await Promise.all([requireUserId(), context.params]);
    if (!isAllowedUser(userId)) return NextResponse.json({ error: "Generation is not available for this account" }, { status: 403 });
    const project = projectById(id);
    if (!project || project.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const reserved = reserveGeneration(id, userId, composePrompt(project.settings));
    if (!reserved.ok) return NextResponse.json({ error: reserved.reason === "insufficient_balance" ? "Not enough mock tokens" : "Project is not ready" }, { status: 409 });
    return NextResponse.json({ status: "queued" });
  } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
}
