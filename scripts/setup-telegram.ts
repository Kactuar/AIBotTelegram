import dotenv from "dotenv";
import { Api } from "grammy";
dotenv.config({ path: ".env.local" });

async function main() {
  const required = ["BOT_TOKEN", "APP_URL", "MINI_APP_URL"] as const;
  for (const name of required) if (!process.env[name]) throw new Error(`${name} is not defined`);

  const appUrl = process.env.APP_URL!.replace(/\/$/, "");
  const api = new Api(process.env.BOT_TOKEN!);
  await api.setWebhook(`${appUrl}/api/telegram`);
  await api.setChatMenuButton({ menu_button: { type: "web_app", text: "Приложение ✨", web_app: { url: process.env.MINI_APP_URL! } } });

  const [webhook, menuButton] = await Promise.all([api.getWebhookInfo(), api.getChatMenuButton()]);
  if (menuButton.type !== "web_app" || menuButton.web_app.url !== process.env.MINI_APP_URL) {
    throw new Error("Telegram did not save the expected Menu Button");
  }

  console.info(`Webhook: ${webhook.url}`);
  console.info(`Menu Button: ${menuButton.text} → ${menuButton.web_app.url}`);
}

main().catch((error: unknown) => {
  console.error("Telegram setup failed", error);
  process.exitCode = 1;
});
