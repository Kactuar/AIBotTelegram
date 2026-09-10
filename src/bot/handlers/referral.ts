import type { Bot, Context } from "grammy";
import { REFERRAL } from "@/src/bot/keyboards/main";
async function referralText(ctx: Context) {
  const me = await ctx.api.getMe();
  const code = (ctx.from?.id ?? 0).toString(36).toUpperCase();
  const link = me.username ? `https://t.me/${me.username}?start=${code}` : "Недоступна: у бота нет username.";
  return `Приглашайте друзей — получайте токены.

За каждую успешную оплату приглашённого друга вы получаете 10% от купленных им токенов.

Ваша ссылка:
${link}

Приглашено: 0 человек
Заработано: 0 токенов`;
}
export function registerReferralHandlers(bot: Bot<Context>) {
  bot.hears(REFERRAL, async (ctx) => ctx.reply(await referralText(ctx)));
  bot.callbackQuery("referral:show", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(await referralText(ctx));
  });
}
