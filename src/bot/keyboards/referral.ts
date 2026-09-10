import { InlineKeyboard } from "grammy";
export function supportKeyboard(url: string) { return new InlineKeyboard().url("🎧 Написать в поддержку", url); }
