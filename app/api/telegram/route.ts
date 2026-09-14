import { webhookCallback } from "grammy";
import { bot } from "@/src/bot/bot";
import { telegramWebhookSecret } from "@/src/server/config";
export const runtime = "nodejs";
export const POST = webhookCallback(bot, "std/http", { secretToken: telegramWebhookSecret() });
