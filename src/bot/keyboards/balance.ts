import { InlineKeyboard } from "grammy";
import type { Tariff } from "@/src/bot/types";
export const balanceKeyboard = new InlineKeyboard().text("💎 Пополнить баланс", "balance:topup").row().text("🎁 Пригласить друга", "referral:show");
export function tariffsKeyboard(tariffs: Tariff[]) {
  const keyboard = new InlineKeyboard();
  tariffs.forEach((tariff, index) => {
    if (index > 0) keyboard.row();
    keyboard.text(`${tariff.priceRubles} ₽ — ${tariff.tokens} токенов (~${tariff.estimatedVideos} роликов)`, `payment:${tariff.tokens}`);
  });
  keyboard.row();
  return keyboard.text("← Назад", "balance:back");
}
