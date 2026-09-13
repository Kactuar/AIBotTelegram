import { NextResponse } from "next/server";
import { requireUserId } from "@/src/server/auth";

export const runtime = "nodejs";

const events = new Set(["picker_opened", "file_selected", "file_rejected", "metadata_loaded", "preview_ready", "metadata_error", "upload_started"]);
const text = (value: unknown, max = 80) => typeof value === "string" && value.length <= max ? value : undefined;
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;

export async function POST(request: Request) {
  let userId: string;
  try { userId = await requireUserId(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
  if (Number(request.headers.get("content-length") || 0) > 2048) return NextResponse.json({ error: "Diagnostic payload is too large" }, { status: 413 });

  try {
    const body = await request.json() as { traceId?: unknown; event?: unknown; details?: Record<string, unknown> };
    const traceId = text(body.traceId, 64);
    const event = text(body.event, 32);
    if (!traceId || !event || !events.has(event)) return NextResponse.json({ error: "Invalid diagnostic event" }, { status: 400 });
    const details = body.details || {};
    const entry = {
      traceId,
      event,
      userId,
      extension: text(details.extension, 10),
      contentType: text(details.contentType),
      size: number(details.size),
      duration: number(details.duration),
      width: number(details.width),
      height: number(details.height),
      mediaError: number(details.mediaError),
      reason: text(details.reason),
    };
    (event === "file_rejected" || event === "metadata_error" ? console.error : console.info)("[video-upload]", JSON.stringify(entry));
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: "Invalid diagnostic payload" }, { status: 400 });
  }
}
