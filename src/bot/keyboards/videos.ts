import { InlineKeyboard } from "grammy";
import type { VideoProject } from "@/src/bot/types";
const statusIcon: Record<VideoProject["status"], string> = { draft: "📝", processing: "⏳", completed: "✅", failed: "❌" };
export function videoListKeyboard(videos: VideoProject[]) {
  const keyboard = new InlineKeyboard();
  videos.forEach((video, index) => {
    if (index > 0) keyboard.row();
    keyboard.text(`${statusIcon[video.status]} #${video.id} · ${video.date}`, `video:${video.id}`);
  });
  return keyboard;
}
export function videoCardKeyboard(video: VideoProject) {
  const keyboard = new InlineKeyboard();
  if (video.downloadUrl) keyboard.url("↓ Скачать", video.downloadUrl).row();
  return keyboard.text("← Назад к списку", "videos:list");
}
