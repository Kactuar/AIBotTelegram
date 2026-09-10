import { webhookCallback } from "grammy";
import { bot } from "@/src/bot/bot";
export const runtime = "nodejs";
export const POST = webhookCallback(bot, "std/http");
