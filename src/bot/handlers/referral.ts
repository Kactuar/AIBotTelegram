import type { Bot, Context } from "grammy";
import { REFERRAL } from "@/src/bot/keyboards/main";
import { languageOf, translations } from "@/src/bot/i18n";
import { getOrCreateReferralCode, referralState } from "@/src/lib/database";

async function referralText(ctx: Context) {
  const t = translations[languageOf(ctx)];
  const me = await ctx.api.getMe();
  const userId = String(ctx.from?.id ?? "");
  const code = getOrCreateReferralCode(userId);
  const state = referralState(userId);
  const link = me.username ? `https://t.me/${me.username}?start=${code}` : t.noUsername;
  return t.referral(link, state.invitedCount, state.earnedTokens);
}
export function registerReferralHandlers(bot: Bot<Context>) {
  bot.hears(REFERRAL, async (ctx) => ctx.reply(await referralText(ctx)));
  bot.callbackQuery("referral:show", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(await referralText(ctx));
  });
}
