import { InlineKeyboard } from "grammy";
import type { Tariff } from "@/src/bot/types";
import { translations, type Language } from "@/src/bot/i18n";
export const balanceKeyboard = (language: Language = "ru") => new InlineKeyboard().text(translations[language].topUp, "balance:topup").row().text(translations[language].invite, "referral:show");
export function tariffsKeyboard(tariffs: Tariff[], language: Language = "ru") {
  const keyboard = new InlineKeyboard();
  tariffs.forEach((tariff, index) => {
    if (index > 0) keyboard.row();
    keyboard.text(translations[language].tariff(tariff.priceRubles, tariff.tokens, tariff.estimatedVideos), `payment:${tariff.tokens}`);
  });
  keyboard.row();
  return keyboard.text(translations[language].back, "balance:back");
}
