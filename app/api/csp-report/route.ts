import { NextResponse } from "next/server";

export const runtime = "nodejs";
const MAX_REPORT_BYTES = 8 * 1024;

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > MAX_REPORT_BYTES) return new NextResponse(null, { status: 413 });
  try {
    const body = await request.json() as { ["csp-report"]?: { ["violated-directive"]?: unknown; ["blocked-uri"]?: unknown } };
    const report = body["csp-report"];
    const directive = typeof report?.["violated-directive"] === "string" ? report["violated-directive"].slice(0, 160) : undefined;
    const blocked = typeof report?.["blocked-uri"] === "string" ? report["blocked-uri"].slice(0, 320) : undefined;
    console.info("[csp-report]", JSON.stringify({ directive, blocked }));
  } catch { return new NextResponse(null, { status: 400 }); }
  return new NextResponse(null, { status: 204 });
}
