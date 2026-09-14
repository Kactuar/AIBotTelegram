import { NextResponse } from "next/server";
import { requireUserId } from "@/src/server/auth";
import { paymentOperations, paymentState } from "@/src/server/payments";
import { internalServerError, unauthorizedResponse } from "@/src/server/http";

export const runtime = "nodejs";

export async function GET() {
  let userId: string;
  try { userId = await requireUserId(); } catch { return unauthorizedResponse(); }
  try {
    return NextResponse.json({ ...paymentState(userId), operations: paymentOperations(userId) });
  } catch (error) { return internalServerError("GET /api/payments", error); }
}
