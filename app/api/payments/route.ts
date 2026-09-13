import { NextResponse } from "next/server";
import { requireUserId } from "@/src/server/auth";
import { paymentOperations, paymentState } from "@/src/server/payments";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await requireUserId();
    return NextResponse.json({ ...paymentState(userId), operations: paymentOperations(userId) });
  } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
}
