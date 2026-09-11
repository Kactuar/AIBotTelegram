import { InlineKeyboard } from "grammy";
import { translations, type Language } from "@/src/bot/i18n";
export function supportKeyboard(language: Language, url?: string) {
  const keyboard = new InlineKeyboard().text("ⓘ FAQ", "support:faq").row();
  if (url) keyboard.url(translations[language].operator, url).row();
  return keyboard.text(language === "ru" ? "🇬🇧 English" : "🇷🇺 Русский", language === "ru" ? "language:en" : "language:ru");
}
