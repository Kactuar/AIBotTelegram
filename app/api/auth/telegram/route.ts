import { NextResponse } from "next/server";
import { sessionCookie, sessionValue, verifyTelegramInitData, isAllowedUser } from "@/src/lib/auth";
import { getOrCreateUser, paymentState } from "@/src/lib/database";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { initData } = await request.json() as { initData?: string };
    if (!initData) return NextResponse.json({ error: "Telegram authorization is required" }, { status: 401 });
    const identity = verifyTelegramInitData(initData);
    const user = getOrCreateUser(identity.id, isAllowedUser(identity.id));
    const state = paymentState(identity.id);
    const response = NextResponse.json({ user: { id: identity.id, firstName: identity.firstName, allowed: isAllowedUser(identity.id), balance: state.balance, trialAvailable: state.trialAvailable, trialProjectId: state.trialProjectId, trialUnlocked: state.trialUnlocked }, settings: user.settings });
    response.cookies.set(sessionCookie(sessionValue(identity.id)));
    return response;
  } catch {
    return NextResponse.json({ error: "Telegram authorization could not be verified" }, { status: 401 });
  }
}
