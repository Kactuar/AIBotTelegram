import type { Bot, Context } from "grammy";
import { BEGIN_MONTAGE } from "@/src/bot/keyboards/main";
import { montageIntroKeyboard, styleKeyboard } from "@/src/bot/keyboards/montage";
import { languageOf, translations } from "@/src/bot/i18n";

const styleLabels = { glass: "Glass", minimal: "Minimal", dynamic: "Dynamic" } as const;
export function registerMontageHandlers(bot: Bot<Context>) {
  bot.hears(BEGIN_MONTAGE, (ctx) => {
    const language = languageOf(ctx);
    return ctx.reply(translations[language].montage, { reply_markup: montageIntroKeyboard(language) });
  });
  bot.callbackQuery(["montage:start", "montage:continue"], async (ctx) => {
    const language = languageOf(ctx);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(translations[language].selectStyle, { reply_markup: styleKeyboard(language) });
  });
  bot.callbackQuery(/^montage:style:(glass|minimal|dynamic)$/, async (ctx) => {
    const language = languageOf(ctx);
    await ctx.answerCallbackQuery();
    const style = styleLabels[ctx.match[1] as keyof typeof styleLabels];
    await ctx.editMessageText(translations[language].selectedStyle(style), { reply_markup: styleKeyboard(language) });
  });
  bot.callbackQuery("montage:back", async (ctx) => {
    const language = languageOf(ctx);
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(translations[language].montage, { reply_markup: montageIntroKeyboard(language) });
  });
}
