import { NextResponse } from "next/server";
import { requireUserId } from "@/src/server/auth";
import { getOrCreateReferralCode, referralState } from "@/src/server/referrals";
import { bot } from "@/src/bot/bot";
import { internalServerError, unauthorizedResponse } from "@/src/server/http";

export const runtime = "nodejs";

export async function GET() {
  let userId: string;
  try { userId = await requireUserId(); }
  catch { return unauthorizedResponse(); }

  let code: string;
  let state: ReturnType<typeof referralState>;
  try {
    code = getOrCreateReferralCode(userId);
    state = referralState(userId);
  } catch (error) { return internalServerError("GET /api/referrals", error); }
  try {
    const me = await bot.api.getMe();
    if (!me.username) return NextResponse.json({ error: "Bot username is unavailable" }, { status: 503 });
    return NextResponse.json({ link: `https://t.me/${me.username}?start=${code}`, ...state });
  } catch (error) {
    console.error("Unable to load Telegram bot identity", { error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "Bot username is temporarily unavailable" }, { status: 503 });
  }
}
