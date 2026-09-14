import { NextResponse } from "next/server";
import { sessionCookie, sessionValue, verifyTelegramInitData } from "@/src/server/auth";
import { paymentState } from "@/src/server/payments";
import { getBotLanguage, getOrCreateUser, saveProfileIdentity } from "@/src/server/users";
import { internalServerError } from "@/src/server/http";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let initData: string | undefined;
  try {
    ({ initData } = await request.json() as { initData?: string });
  } catch { return NextResponse.json({ error: "Telegram authorization is required" }, { status: 401 }); }
  if (!initData) return NextResponse.json({ error: "Telegram authorization is required" }, { status: 401 });
  let identity: ReturnType<typeof verifyTelegramInitData>;
  try {
    identity = verifyTelegramInitData(initData);
  } catch {
    return NextResponse.json({ error: "Telegram authorization could not be verified" }, { status: 401 });
  }
  try {
    const user = getOrCreateUser(identity.id);
    saveProfileIdentity(identity.id, identity.firstName, identity.username);
    const state = paymentState(identity.id);
    const response = NextResponse.json({ user: { id: identity.id, firstName: identity.firstName, username: identity.username, language: getBotLanguage(identity.id), allowed: true, balance: state.balance, trialAvailable: state.trialAvailable, trialProjectId: state.trialProjectId, trialUnlocked: state.trialUnlocked }, settings: user.settings });
    response.cookies.set(sessionCookie(sessionValue(identity.id)));
    return response;
  } catch (error) { return internalServerError("POST /api/auth/telegram", error); }
}
