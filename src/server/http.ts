import crypto from "node:crypto";
import { NextResponse } from "next/server";

export function unauthorizedResponse() { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

export function internalServerError(route: string, error: unknown) {
  const requestId = crypto.randomUUID();
  console.error("API request failed", { route, requestId, error: error instanceof Error ? error.name : "unknown" });
  return NextResponse.json({ error: "Internal server error", requestId }, { status: 500 });
}
