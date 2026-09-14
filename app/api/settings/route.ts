import { NextResponse } from "next/server";
import { requireUserId } from "@/src/server/auth";
import { getUser, saveSettings } from "@/src/server/users";
import { defaultMontageSettings, montageColors, type MontageColor, type MontageSettings } from "@/src/domain/montage";

export const runtime = "nodejs";
const valid = (value: unknown): value is MontageSettings => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return item.style === "glass" && montageColors.includes(String(item.color) as MontageColor) && ["trimVideo", "generateHook", "soundEffects", "mediaCards", "emojiSubtitles", "badges", "cameraMotion"].every((key) => typeof item[key] === "boolean");
};

export async function GET() {
  try { const user = getUser(await requireUserId()); return NextResponse.json({ settings: user.settings, balance: user.balance }); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
}

export async function PUT(request: Request) {
  try {
    const settings = await request.json();
    if (!valid(settings)) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
    const user = saveSettings(await requireUserId(), { ...defaultMontageSettings, ...settings });
    return NextResponse.json({ settings: user.settings, balance: user.balance });
  } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
}
