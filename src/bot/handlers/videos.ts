import type { Bot, Context } from "grammy";
import { MY_VIDEOS } from "@/src/bot/keyboards/main";
import { videoCardKeyboard, videoListKeyboard } from "@/src/bot/keyboards/videos";
import { mockVideos } from "@/src/bot/mock/data";
import type { VideoProject } from "@/src/bot/types";
import { languageOf, translations, type Language } from "@/src/bot/i18n";

function videoText(video: VideoProject, language: Language) {
  const t = translations[language];
  const color = language === "en" && video.color === "Янтарь" ? "Amber" : video.color;
  return t.video(video.id, t.statuses[video.status], video.style, color, video.price, video.fullDate);
}
export function registerVideosHandlers(bot: Bot<Context>) {
  bot.hears(MY_VIDEOS, (ctx) => ctx.reply(translations[languageOf(ctx)].videoList, { reply_markup: videoListKeyboard(mockVideos) }));
  bot.callbackQuery(/^video:(\d+)$/, async (ctx) => {
    const language = languageOf(ctx);
    await ctx.answerCallbackQuery();
    const video = mockVideos.find(({ id }) => id === Number(ctx.match[1]));
    if (!video) return;
    await ctx.editMessageText(videoText(video, language), { reply_markup: videoCardKeyboard(video, language) });
  });
  bot.callbackQuery("videos:list", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(translations[languageOf(ctx)].videoList, { reply_markup: videoListKeyboard(mockVideos) });
  });
}
