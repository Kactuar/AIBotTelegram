import { InlineKeyboard } from "grammy";
import { translations, type Language } from "@/src/bot/i18n";
export const montageIntroKeyboard = (language: Language) => new InlineKeyboard().text(translations[language].begin, "montage:start").row().text(translations[language].continueInBot, "montage:continue");
export const styleKeyboard = (language: Language) => new InlineKeyboard().text("Glass", "montage:style:glass").row().text("Minimal", "montage:style:minimal").row().text("Dynamic", "montage:style:dynamic").row().text(translations[language].back, "montage:back");
