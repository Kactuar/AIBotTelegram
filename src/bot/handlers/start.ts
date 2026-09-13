import type { Bot, Context } from "grammy";
import { mainKeyboard } from "@/src/bot/keyboards/main";
import { languageOf, translations } from "@/src/bot/i18n";
import { claimReferralAttribution } from "@/src/server/referrals";
export function registerStartHandlers(bot: Bot<Context>) {
  bot.command("start", async (ctx) => {
    claimReferralAttribution(String(ctx.from?.id ?? ""), ctx.match?.trim());
    const language = languageOf(ctx);
    await ctx.reply(translations[language].welcome, { reply_markup: mainKeyboard(language) });
  });
}
