import { NextResponse } from "next/server";
import { requireUserId } from "@/src/server/auth";
import { appConfig } from "@/src/server/config";
import { completedProjectCount } from "@/src/server/projects";
import { getBotLanguage, profileIdentity, setBotLanguage } from "@/src/server/users";
import { internalServerError, unauthorizedResponse } from "@/src/server/http";

export const runtime = "nodejs";

function publicLink(value: string | undefined) {
  if (!value) return undefined;
  try { return new URL(value).protocol === "https:" ? value : undefined; } catch { return undefined; }
}

export async function GET() {
  let userId: string;
  try { userId = await requireUserId(); } catch { return unauthorizedResponse(); }
  try {
    return NextResponse.json({
      profile: { ...profileIdentity(userId), language: getBotLanguage(userId), completedVideos: completedProjectCount(userId) },
      links: { supportUrl: publicLink(appConfig().supportUrl), officialChannelUrl: publicLink(appConfig().officialChannelUrl) },
    });
  } catch (error) { return internalServerError("GET /api/profile", error); }
}

export async function PUT(request: Request) {
  let userId: string;
  try { userId = await requireUserId(); } catch { return unauthorizedResponse(); }
  let language: string | undefined;
  try {
    ({ language } = await request.json() as { language?: string });
  } catch { return NextResponse.json({ error: "Invalid language" }, { status: 400 }); }
  if (language !== "ru" && language !== "en") return NextResponse.json({ error: "Invalid language" }, { status: 400 });
  try {
    setBotLanguage(userId, language);
    return NextResponse.json({ language });
  } catch (error) { return internalServerError("PUT /api/profile", error); }
}
