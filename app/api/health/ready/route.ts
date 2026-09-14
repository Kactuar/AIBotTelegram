import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { appConfig } from "@/src/server/config";
import { db } from "@/src/server/database";
import { workerIsHealthy } from "@/src/server/health";

export const runtime = "nodejs";

export async function GET() {
  try {
    db();
    await fs.access(appConfig().storageRoot);
    if (!workerIsHealthy()) return NextResponse.json({ error: "Not ready" }, { status: 503 });
    return NextResponse.json({ status: "ok" });
  } catch { return NextResponse.json({ error: "Not ready" }, { status: 503 }); }
}
