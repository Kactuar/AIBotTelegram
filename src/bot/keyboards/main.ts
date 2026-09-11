import { Keyboard } from "grammy";
import { translations, type Language } from "@/src/bot/i18n";
export const BEGIN_MONTAGE = [translations.ru.menu.montage, translations.en.menu.montage];
export const BALANCE = [translations.ru.menu.balance, translations.en.menu.balance];
export const MY_VIDEOS = [translations.ru.menu.videos, translations.en.menu.videos];
export const REFERRAL = [translations.ru.menu.referral, translations.en.menu.referral];
export const SUPPORT = [translations.ru.menu.support, translations.en.menu.support];
export function mainKeyboard(language: Language = "ru") {
  const labels = translations[language].menu;
  return new Keyboard()
  .text(labels.montage, "primary")
  .row()
  .text(labels.balance, "success")
  .text(labels.videos, "primary")
  .row()
  .text(labels.referral)
  .text(labels.support)
  .resized()
  .persistent();
}
