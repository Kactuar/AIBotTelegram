import { NextResponse } from "next/server";
import { requireUserId } from "@/src/lib/auth";
import { projectById } from "@/src/lib/database";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [userId, { id }] = await Promise.all([requireUserId(), context.params]);
    const project = projectById(id);
    if (!project || project.userId !== userId) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ project });
  } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
}
