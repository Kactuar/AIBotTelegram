import { Keyboard } from "grammy";
export const BEGIN_MONTAGE = "▷ Начать монтаж";
export const BALANCE = "▣ Баланс";
export const MY_VIDEOS = "▣ Мои ролики";
export const REFERRAL = "🎁 Реф. программа";
export const SUPPORT = "🎧 Поддержка";
export const mainKeyboard = new Keyboard().text(BEGIN_MONTAGE).row().text(BALANCE).text(MY_VIDEOS).row().text(REFERRAL).text(SUPPORT).resized().persistent();
