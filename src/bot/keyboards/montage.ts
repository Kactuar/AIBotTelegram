import { InlineKeyboard } from "grammy";
export const montageIntroKeyboard = new InlineKeyboard().text("▷ Приступить", "montage:start").row().text("🤖 Продолжить в боте", "montage:continue");
export const styleKeyboard = new InlineKeyboard().text("Glass", "montage:style:glass").row().text("Minimal", "montage:style:minimal").row().text("Dynamic", "montage:style:dynamic").row().text("← Назад", "montage:back");
