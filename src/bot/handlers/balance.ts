import type { Bot, Context } from "grammy";
import { BALANCE } from "@/src/bot/keyboards/main";
import { balanceKeyboard, tariffsKeyboard } from "@/src/bot/keyboards/balance";
import { mockBalance, tariffs } from "@/src/bot/mock/data";
import { languageOf, translations } from "@/src/bot/i18n";

export function registerBalanceHandlers(bot: Bot<Context>) {
  bot.hears(BALANCE, (ctx) => {
    const language = languageOf(ctx);
    return ctx.reply(translations[language].balance(mockBalance.tokens, mockBalance.completedVideos), { reply_markup: balanceKeyboard(language) });
  });
  bot.callbackQuery("balance:topup", async (ctx) => {
    const language = languageOf(ctx);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(translations[language].tariffs, { reply_markup: tariffsKeyboard(tariffs, language) });
  });
  bot.callbackQuery(/^payment:(\d+)$/, async (ctx) => {
    const language = languageOf(ctx);
    await ctx.answerCallbackQuery();
    const tariff = tariffs.find(({ tokens }) => tokens === Number(ctx.match[1]));
    if (!tariff) return;
    await ctx.editMessageText(translations[language].payment(tariff.tokens), { reply_markup: tariffsKeyboard(tariffs, language) });
  });
  bot.callbackQuery("balance:back", async (ctx) => {
    const language = languageOf(ctx);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(translations[language].balance(mockBalance.tokens, mockBalance.completedVideos), { reply_markup: balanceKeyboard(language) });
  });
}
