import type { Bot, Context } from "grammy";
import { SUPPORT } from "@/src/bot/keyboards/main";
import { supportKeyboard } from "@/src/bot/keyboards/referral";
export function registerSupportHandlers(bot: Bot<Context>) {
  bot.hears(SUPPORT, async (ctx) => {
    const supportUrl = process.env.SUPPORT_URL;
    if (!supportUrl) return ctx.reply("Поддержка пока недоступна. Настройте SUPPORT_URL.");
    await ctx.reply("Если у вас возникли вопросы, напишите в поддержку.", { reply_markup: supportKeyboard(supportUrl) });
  });
}
