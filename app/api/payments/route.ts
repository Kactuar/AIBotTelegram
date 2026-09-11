import { NextResponse } from "next/server";
import { requireUserId } from "@/src/lib/auth";
import { paymentOperations, paymentState } from "@/src/lib/database";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await requireUserId();
    return NextResponse.json({ ...paymentState(userId), operations: paymentOperations(userId) });
  } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
}
