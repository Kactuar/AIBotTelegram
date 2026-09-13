import { NextResponse } from "next/server";
import { requireUserId } from "@/src/lib/auth";
import { getOrCreateReferralCode, referralState } from "@/src/lib/database";
import { bot } from "@/src/bot/bot";

export const runtime = "nodejs";

export async function GET() {
  let userId: string;
  try { userId = await requireUserId(); }
  catch { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); }

  try {
    const code = getOrCreateReferralCode(userId);
    const me = await bot.api.getMe();
    if (!me.username) return NextResponse.json({ error: "Bot username is unavailable" }, { status: 503 });
    return NextResponse.json({ link: `https://t.me/${me.username}?start=${code}`, ...referralState(userId) });
  } catch (error) {
    console.error("Unable to load referral state", error);
    return NextResponse.json({ error: "Referral data is temporarily unavailable" }, { status: 503 });
  }
}
