import { NextResponse } from "next/server";
import { requireUserId } from "@/src/lib/auth";
import { appConfig } from "@/src/lib/config";
import { completedProjectCount, getBotLanguage, profileIdentity, setBotLanguage } from "@/src/lib/database";

export const runtime = "nodejs";

function publicLink(value: string | undefined) {
  if (!value) return undefined;
  try { return new URL(value).protocol === "https:" ? value : undefined; } catch { return undefined; }
}

export async function GET() {
  try {
    const userId = await requireUserId();
    return NextResponse.json({
      profile: { ...profileIdentity(userId), language: getBotLanguage(userId), completedVideos: completedProjectCount(userId) },
      links: { supportUrl: publicLink(appConfig().supportUrl), officialChannelUrl: publicLink(appConfig().officialChannelUrl) },
    });
  } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
}

export async function PUT(request: Request) {
  try {
    const userId = await requireUserId();
    const { language } = await request.json() as { language?: string };
    if (language !== "ru" && language !== "en") return NextResponse.json({ error: "Invalid language" }, { status: 400 });
    setBotLanguage(userId, language);
    return NextResponse.json({ language });
  } catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }
}
