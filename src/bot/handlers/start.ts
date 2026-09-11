import type { Bot, Context } from "grammy";
import { mainKeyboard } from "@/src/bot/keyboards/main";
import { languageOf, translations } from "@/src/bot/i18n";
export function registerStartHandlers(bot: Bot<Context>) {
  bot.command("start", async (ctx) => {
    const referralCode = ctx.match?.trim();
    if (referralCode) console.info(`Referral code: ${referralCode}; user: ${ctx.from?.id}`);
    const language = languageOf(ctx);
    await ctx.reply(translations[language].welcome, { reply_markup: mainKeyboard(language) });
  });
}
