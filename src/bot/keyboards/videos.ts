import { InlineKeyboard } from "grammy";
import type { VideoProject } from "@/src/bot/types";
import { translations, type Language } from "@/src/bot/i18n";
const statusIcon: Record<VideoProject["status"], string> = { draft: "📝", processing: "⏳", completed: "✅", failed: "❌" };
export function videoListKeyboard(videos: VideoProject[]) {
  const keyboard = new InlineKeyboard();
  videos.forEach((video, index) => {
    if (index > 0) keyboard.row();
    keyboard.text(`${statusIcon[video.status]} #${video.id} · ${video.date}`, `video:${video.id}`);
  });
  return keyboard;
}
export function videoCardKeyboard(video: VideoProject, language: Language) {
  const keyboard = new InlineKeyboard();
  if (video.downloadUrl) keyboard.url(translations[language].download, video.downloadUrl).row();
  return keyboard.text(translations[language].backToVideos, "videos:list");
}
