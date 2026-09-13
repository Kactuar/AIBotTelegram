import { NextResponse } from "next/server";
import { requireUserId } from "@/src/server/auth";
import { appConfig } from "@/src/server/config";
import { completeMockPayment } from "@/src/server/payments";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const [userId, { id }] = await Promise.all([requireUserId(), context.params]);
    const { status } = await request.json() as { status?: "paid" | "cancelled" | "failed" };
    if (appConfig().paymentMode !== "mock" || !status || !["paid", "cancelled", "failed"].includes(status)) return NextResponse.json({ error: "Mock payments are disabled" }, { status: 503 });
    const result = completeMockPayment(userId, id, status);
    return result ? NextResponse.json(result) : NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
}
