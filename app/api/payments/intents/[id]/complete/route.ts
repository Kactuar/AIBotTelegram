import { NextResponse } from "next/server";
import { requireUserId } from "@/src/server/auth";
import { appConfig } from "@/src/server/config";
import { completeMockPayment } from "@/src/server/payments";
import { internalServerError, unauthorizedResponse } from "@/src/server/http";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return unauthorizedResponse(); }
  const { id } = await context.params;
  let status: "paid" | "cancelled" | "failed" | undefined;
  try {
    ({ status } = await request.json() as { status?: typeof status });
  } catch { return NextResponse.json({ error: "Invalid payment status" }, { status: 400 }); }
  if (!status || !["paid", "cancelled", "failed"].includes(status)) return NextResponse.json({ error: "Invalid payment status" }, { status: 400 });
  try {
    if (appConfig().paymentMode !== "mock") return NextResponse.json({ error: "Mock payments are disabled" }, { status: 503 });
    const result = completeMockPayment(userId, id, status);
    return result ? NextResponse.json(result) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) { return internalServerError("POST /api/payments/intents/[id]/complete", error); }
}
