import { afterEach, describe, expect, it, vi } from "vitest";
import { telegramWebhookSecret } from "@/src/server/config";

const bot = vi.hoisted(() => ({}));
const webhookCallback = vi.hoisted(() => vi.fn(() => () => new Response()));
vi.mock("grammy", () => ({ webhookCallback }));
vi.mock("@/src/bot/bot", () => ({ bot }));

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); vi.resetModules(); });

describe("Telegram webhook secret", () => {
  it("is mandatory in production and validates Telegram's allowed format", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", undefined);
    expect(telegramWebhookSecret).toThrow("TELEGRAM_WEBHOOK_SECRET is not configured");

    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "invalid secret");
    expect(telegramWebhookSecret).toThrow("TELEGRAM_WEBHOOK_SECRET has an invalid format");

    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "valid_webhook-secret_42");
    expect(telegramWebhookSecret()).toBe("valid_webhook-secret_42");
  });

  it("configures grammY to reject updates without the Telegram secret header", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", "valid_webhook-secret_42");
    await import("@/app/api/telegram/route");
    expect(webhookCallback).toHaveBeenCalledWith(bot, "std/http", { secretToken: "valid_webhook-secret_42" });
  });
});
