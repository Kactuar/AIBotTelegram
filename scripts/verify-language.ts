import assert from "node:assert/strict";
import { Bot } from "grammy";
import type { Update } from "grammy/types";
import { registerStartHandlers } from "../src/bot/handlers/start";
import { registerSupportHandlers } from "../src/bot/handlers/support";
import { registerBalanceHandlers } from "../src/bot/handlers/balance";
import { registerMontageHandlers } from "../src/bot/handlers/montage";
import { registerVideosHandlers } from "../src/bot/handlers/videos";
import { registerReferralHandlers } from "../src/bot/handlers/referral";
import { closeDatabase, db, getBotLanguage } from "../src/lib/database";
import { translations } from "../src/bot/i18n";

export async function verifyLanguage() {
  const bot = new Bot("offline-test-token", { botInfo: { id: 99, is_bot: true, first_name: "Test", username: "test_bot", can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false, can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false, allows_users_to_create_topics: false, can_manage_bots: false, supports_join_request_queries: false } });
  const calls: { method: string; text?: string; reply_markup?: unknown }[] = [];
  // Every Telegram API call is intercepted; these checks send no messages.
  bot.api.config.use(async (_previous, method, payload) => {
    calls.push({ method, ...payload });
    const result = method === "getMe" ? bot.botInfo : true;
    return { ok: true, result } as Awaited<ReturnType<typeof _previous>>;
  });
  [registerStartHandlers, registerSupportHandlers, registerBalanceHandlers, registerMontageHandlers, registerVideosHandlers, registerReferralHandlers].forEach((register) => register(bot));
  let updateId = 0;
  async function send(text: string, userId = 7001, callback = false) {
    calls.length = 0;
    const from = { id: userId, is_bot: false, first_name: "Test" };
    const message = { message_id: ++updateId, date: 1, chat: { id: userId, type: "private" as const, first_name: "Test" }, from, text, entities: text === "/start" ? [{ type: "bot_command" as const, offset: 0, length: 6 }] : undefined };
    const update: Update = callback
      ? { update_id: updateId, callback_query: { id: String(updateId), from, chat_instance: "offline", data: text, message } }
      : { update_id: updateId, message };
    await bot.handleUpdate(update);
  }
  const hasText = (text: string) => calls.some((call) => call.text?.includes(text));
  const hasButton = (text: string) => calls.some((call) => (JSON.stringify(call.reply_markup) ?? "").includes(text));

  assert.equal(getBotLanguage("7001"), "ru");
  await send(translations.ru.menu.support);
  assert.ok(hasButton("language:en"));
  await send("language:en", 7001, true);
  assert.equal(getBotLanguage("7001"), "en");
  assert.equal(getBotLanguage("7002"), "ru");
  assert.ok(hasText("Language: English ✅"));
  assert.ok(hasButton(translations.en.menu.montage));
  assert.ok(hasButton("language:ru"));
  assert.equal((db().prepare("SELECT COUNT(*) AS count FROM users WHERE telegram_id = '7001'").get() as { count: number }).count, 0);
  closeDatabase();
  assert.equal(getBotLanguage("7001"), "en", "Language survives reopening the database");
  await send("/start");
  assert.ok(hasText(translations.en.welcome));
  for (const label of Object.values(translations.en.menu)) {
    await send(label);
    assert.ok(calls.some((call) => call.method === "sendMessage"), `English menu button is handled: ${label}`);
    assert.ok(calls.every((call) => !call.text || !/[А-Яа-яЁё]/.test(call.text)));
  }
  await send(translations.ru.menu.balance);
  assert.ok(hasText("Your balance"), "Old Russian buttons still use the saved language");
  for (const callback of ["balance:topup", "payment:240", "balance:back", "montage:start", "montage:style:glass", "montage:back", "video:16294", "videos:list", "referral:show", "support:faq"]) {
    await send(callback, 7001, true);
    assert.ok(calls.some((call) => call.text), `Callback is handled: ${callback}`);
    assert.ok(calls.every((call) => !call.text || !/[А-Яа-яЁё]/.test(call.text)), callback);
  }
  await send("/start", 7002);
  assert.ok(hasText(translations.ru.welcome));
  await send("language:ru", 7001, true);
  assert.equal(getBotLanguage("7001"), "ru");
  assert.ok(hasText("Язык: Русский ✅"));
  assert.ok(hasButton(translations.ru.menu.support));
  await send("language:de", 7001, true);
  assert.equal(getBotLanguage("7001"), "ru");
  console.info("Language switching, menus, callbacks, persistence and user isolation passed (offline Telegram API).");
}
