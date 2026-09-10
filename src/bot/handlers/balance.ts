import type { Bot, Context } from "grammy";
import { BALANCE } from "@/src/bot/keyboards/main";
import { balanceKeyboard, tariffsKeyboard } from "@/src/bot/keyboards/balance";
import { mockBalance, tariffs } from "@/src/bot/mock/data";
const balanceText = `Ваш баланс: ${mockBalance.tokens} токенов
Хватит на ~0 монтажа
Смонтировано всего: ${mockBalance.completedVideos} роликов`;
const tariffsText = `Цены

Токены не сгорают.
Без подписки и автосписаний — платите только за смонтированные ролики.

Выберите пакет:`;
export function registerBalanceHandlers(bot: Bot<Context>) {
  bot.hears(BALANCE, (ctx) => ctx.reply(balanceText, { reply_markup: balanceKeyboard }));
  bot.callbackQuery("balance:topup", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(tariffsText, { reply_markup: tariffsKeyboard(tariffs) });
  });
  bot.callbackQuery(/^payment:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const tariff = tariffs.find(({ tokens }) => tokens === Number(ctx.match[1]));
    if (!tariff) return;
    await ctx.editMessageText(`Вы выбрали пакет: ${tariff.tokens} токенов.\n\nПодключение оплаты будет реализовано позже.`, { reply_markup: tariffsKeyboard(tariffs) });
  });
  bot.callbackQuery("balance:back", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(balanceText, { reply_markup: balanceKeyboard });
  });
}
