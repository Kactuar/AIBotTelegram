import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireUserId } from "@/src/server/auth";
import { appConfig } from "@/src/server/config";
import { createPaymentIntent } from "@/src/server/payments";
import { isPaymentMethod, paymentPackage } from "@/src/domain/payments";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const userId = await requireUserId();
    const body = await request.json() as { packageId?: string; method?: string; accepted?: boolean; idempotencyKey?: string };
    if (!body.accepted || !body.packageId || !body.method || !body.idempotencyKey || body.idempotencyKey.length > 128 || !paymentPackage(body.packageId) || !isPaymentMethod(body.method)) return NextResponse.json({ error: "Invalid payment request" }, { status: 400 });
    if (appConfig().paymentMode !== "mock") return NextResponse.json({ error: "Mock payments are disabled" }, { status: 503 });
    const operation = createPaymentIntent(userId, crypto.randomUUID(), body.packageId, body.method, body.idempotencyKey);
    if (!operation) return NextResponse.json({ error: "Payment cannot be created" }, { status: 409 });
    return NextResponse.json({ operation, mode: "mock" as const, invoiceUrl: null });
  } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
}
