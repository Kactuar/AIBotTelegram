import type { Bot, Context } from "grammy";
import { MY_VIDEOS } from "@/src/bot/keyboards/main";
import { videoCardKeyboard, videoListKeyboard } from "@/src/bot/keyboards/videos";
import { mockVideos } from "@/src/bot/mock/data";
import type { VideoProject } from "@/src/bot/types";
const listText = "Ваши ролики — нажмите на карточку, чтобы посмотреть детали:";
const statusLabel: Record<VideoProject["status"], string> = { draft: "📝 Черновик", processing: "⏳ Обрабатывается", completed: "✅ Готово", failed: "❌ Ошибка" };
function videoText(video: VideoProject) { return `Ролик #${video.id}\nСтатус: ${statusLabel[video.status]}\nСтиль: ${video.style}\nЦвет: ${video.color}\nСтоимость: ${video.price} токенов\nДата: ${video.fullDate}`; }
export function registerVideosHandlers(bot: Bot<Context>) {
  bot.hears(MY_VIDEOS, (ctx) => ctx.reply(listText, { reply_markup: videoListKeyboard(mockVideos) }));
  bot.callbackQuery(/^video:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const video = mockVideos.find(({ id }) => id === Number(ctx.match[1]));
    if (!video) return;
    await ctx.editMessageText(videoText(video), { reply_markup: videoCardKeyboard(video) });
  });
  bot.callbackQuery("videos:list", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(listText, { reply_markup: videoListKeyboard(mockVideos) });
  });
}
