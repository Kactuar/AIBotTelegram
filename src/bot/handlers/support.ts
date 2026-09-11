import type { Bot, Context } from "grammy";
import { SUPPORT, mainKeyboard } from "@/src/bot/keyboards/main";
import { supportKeyboard } from "@/src/bot/keyboards/referral";
import { languageOf, translations, type Language } from "@/src/bot/i18n";
import { setBotLanguage } from "@/src/lib/database";
import { appConfig } from "@/src/lib/config";

const supportText = (language: Language) => translations[language].support + (appConfig().supportUrl ? "" : `\n\n${translations[language].noOperator}`);

export function registerSupportHandlers(bot: Bot<Context>) {
  bot.hears(SUPPORT, async (ctx) => {
    const language = languageOf(ctx);
    await ctx.reply(supportText(language), { reply_markup: supportKeyboard(language, appConfig().supportUrl) });
  });
  bot.callbackQuery(/^language:(ru|en)$/, async (ctx) => {
    const language = ctx.match[1] as Language;
    setBotLanguage(String(ctx.from.id), language);
    await ctx.answerCallbackQuery();
    // A new message updates Telegram's persistent reply keyboard as well.
    await ctx.reply(translations[language].languageSaved, { reply_markup: mainKeyboard(language) });
    await ctx.editMessageText(supportText(language), { reply_markup: supportKeyboard(language, appConfig().supportUrl) });
  });
  bot.callbackQuery("support:faq", async (ctx) => {
    const language = languageOf(ctx);
    await ctx.answerCallbackQuery();
    await ctx.reply(translations[language].faq);
  });
}
