import { NextResponse } from "next/server";
import { requireUserId } from "@/src/server/auth";
import { getUser, saveSettings } from "@/src/server/users";
import { defaultMontageSettings, montageColors, type MontageColor, type MontageSettings } from "@/src/domain/montage";
import { internalServerError, unauthorizedResponse } from "@/src/server/http";

export const runtime = "nodejs";
const valid = (value: unknown): value is MontageSettings => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.style === "glass" && montageColors.includes(String(item.color) as MontageColor) && ["trimVideo", "generateHook", "soundEffects", "mediaCards", "emojiSubtitles", "badges", "cameraMotion"].every((key) => typeof item[key] === "boolean");
};

export async function GET() {
  let userId: string;
  try { userId = await requireUserId(); } catch { return unauthorizedResponse(); }
  try { const user = getUser(userId); return NextResponse.json({ settings: user.settings, balance: user.balance }); }
  catch (error) { return internalServerError("GET /api/settings", error); }
}

export async function PUT(request: Request) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return unauthorizedResponse(); }
  let settings: unknown;
  try {
    settings = await request.json();
  } catch { return NextResponse.json({ error: "Invalid settings" }, { status: 400 }); }
  if (!valid(settings)) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  try {
    const user = saveSettings(userId, { ...defaultMontageSettings, ...settings });
    return NextResponse.json({ settings: user.settings, balance: user.balance });
  } catch (error) { return internalServerError("PUT /api/settings", error); }
}
