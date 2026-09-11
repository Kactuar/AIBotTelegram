import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireUserId } from "@/src/lib/auth";
import { createProject, getUser, hasActiveProject } from "@/src/lib/database";

export const runtime = "nodejs";
export async function POST() {
  try {
    const userId = await requireUserId();
    if (hasActiveProject(userId)) return NextResponse.json({ error: "Finish the current project first" }, { status: 409 });
    const project = createProject(crypto.randomUUID(), userId, getUser(userId).settings);
    return NextResponse.json({ project });
  } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
}
