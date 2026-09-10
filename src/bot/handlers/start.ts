import type { Bot, Context } from "grammy";
import { mainKeyboard } from "@/src/bot/keyboards/main";
export function registerStartHandlers(bot: Bot<Context>) {
  bot.command("start", async (ctx) => {
    const referralCode = ctx.match?.trim();
    if (referralCode) console.info(`Referral code: ${referralCode}; user: ${ctx.from?.id}`);
    await ctx.reply("Добро пожаловать!\n\nВыберите действие:", { reply_markup: mainKeyboard });
  });
}
