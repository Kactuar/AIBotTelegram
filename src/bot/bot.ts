import { Bot, type Context } from "grammy";
import { registerBalanceHandlers } from "@/src/bot/handlers/balance";
import { registerMontageHandlers } from "@/src/bot/handlers/montage";
import { registerReferralHandlers } from "@/src/bot/handlers/referral";
import { registerStartHandlers } from "@/src/bot/handlers/start";
import { registerSupportHandlers } from "@/src/bot/handlers/support";
import { registerVideosHandlers } from "@/src/bot/handlers/videos";
import { languageOf, translations } from "@/src/bot/i18n";

const token = process.env.BOT_TOKEN;
if (!token) throw new Error("BOT_TOKEN is not defined");

export const bot = new Bot<Context>(token);
registerStartHandlers(bot);
registerMontageHandlers(bot);
registerVideosHandlers(bot);
registerBalanceHandlers(bot);
registerReferralHandlers(bot);
registerSupportHandlers(bot);
bot.catch(async (error) => {
  console.error("Telegram bot error", error.error);
  try { await error.ctx.reply(translations[languageOf(error.ctx)].error); }
  catch (replyError) { console.error("Unable to send bot error message", replyError); }
});
