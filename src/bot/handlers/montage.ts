import type { Bot, Context } from "grammy";
import { BEGIN_MONTAGE } from "@/src/bot/keyboards/main";
import { montageIntroKeyboard, styleKeyboard } from "@/src/bot/keyboards/montage";
const montageIntroText = `✨ Всего четыре шага:

1. Выбираете стиль
2. Выбираете цвет
3. Настраиваете основные параметры
4. Присылаете сырое видео и через несколько минут забираете готовый Reels в Full HD`;
const styleLabels = { glass: "Glass", minimal: "Minimal", dynamic: "Dynamic" } as const;
export function registerMontageHandlers(bot: Bot<Context>) {
  bot.hears(BEGIN_MONTAGE, (ctx) => ctx.reply(montageIntroText, { reply_markup: montageIntroKeyboard }));
  bot.callbackQuery(["montage:start", "montage:continue"], async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText("Выберите стиль монтажа:", { reply_markup: styleKeyboard });
  });
  bot.callbackQuery(/^montage:style:(glass|minimal|dynamic)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const style = styleLabels[ctx.match[1] as keyof typeof styleLabels];
    await ctx.editMessageText(`Выбран стиль: ${style}\n\nСледующий этап будет реализован позже.`, { reply_markup: styleKeyboard });
  });
  bot.callbackQuery("montage:back", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(montageIntroText, { reply_markup: montageIntroKeyboard });
  });
}
