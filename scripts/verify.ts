import assert from "node:assert/strict";
import { tariffs, mockVideos } from "../src/bot/mock/data";
import { tariffsKeyboard } from "../src/bot/keyboards/balance";
import { videoListKeyboard } from "../src/bot/keyboards/videos";
import { mainKeyboard } from "../src/bot/keyboards/main";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { composePrompt } from "../src/lib/prompt";
import { defaultMontageSettings } from "../src/montage/types";
import { readSession, verifyTelegramInitData } from "../src/lib/auth";
import { POST as authorizeTelegram } from "../app/api/auth/telegram/route";
import { verifyLanguage } from "./verify-language";
import { closeDatabase, createProject, failProject, getUser, hasActiveProject, reserveGeneration, updateProject } from "../src/lib/database";
assert.ok(mockVideos.length > 0, "At least one mock video is required");
assert.equal(videoListKeyboard(mockVideos).inline_keyboard.length, mockVideos.length);
assert.equal(tariffsKeyboard(tariffs).inline_keyboard.length, tariffs.length + 1);
assert.ok(tariffs.every((tariff) => tariff.tokens > 0 && tariff.priceRubles > 0));
const buttonStyle = (row: number, column: number) => {
  const button = mainKeyboard().keyboard[row][column];
  return typeof button === "string" || !("style" in button) ? undefined : button.style;
};
assert.equal(buttonStyle(0, 0), "primary");
assert.equal(buttonStyle(1, 0), "success");
assert.equal(buttonStyle(1, 1), "primary");
const prompt = composePrompt({ ...defaultMontageSettings, color: "crimson", generateHook: true, badges: true });
assert.ok(prompt.includes("crimson-red"));
assert.ok(prompt.includes("compelling visual hook"));
assert.ok(prompt.includes("glass badges"));
assert.ok(!prompt.includes("sound design"));
assert.ok(prompt.indexOf("Glass Reels") < prompt.indexOf("crimson-red"));
assert.ok(prompt.indexOf("crimson-red") < prompt.indexOf("compelling visual hook"));
const token = "verification-token";
const init = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: "test", user: JSON.stringify({ id: 42, first_name: "Test" }) });
const check = [...init.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
init.set("hash", crypto.createHmac("sha256", secret).update(check).digest("hex"));
assert.equal(verifyTelegramInitData(init.toString(), token).id, "42");
init.set("user", JSON.stringify({ id: 99 }));
assert.throws(() => verifyTelegramInitData(init.toString(), token));
const verificationDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "aibot-verify-")), "app.sqlite");
process.env.DATABASE_PATH = verificationDb;
process.env.TELEGRAM_ALLOWED_USER_IDS = "42";
process.env.APP_URL = "http://verification.local";
process.env.BOT_TOKEN = "verification-token";
process.env.SESSION_SECRET = "verification-session-secret";
assert.equal(getUser("42").balance, 100);
const project = createProject("verify-project", "42", defaultMontageSettings);
assert.ok(hasActiveProject("42"));
updateProject(project.id, { status: "uploaded", inputPath: "/tmp/input.mp4" });
assert.equal(reserveGeneration(project.id, "42", prompt).ok, true);
assert.equal(getUser("42").balance, 77);
failProject(project.id, "provider_failed");
assert.equal(getUser("42").balance, 100);
async function verifyAuthRoute() {
  const signedData = (id: number) => {
    const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: "Test" }) });
    const checkString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
    params.set("hash", crypto.createHmac("sha256", secret).update(checkString).digest("hex"));
    return params;
  };
  const authorize = (initData?: string) => authorizeTelegram(new Request("http://verification.local/api/auth/telegram", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData }),
  }));
  const allowed = await authorize(signedData(42).toString());
  assert.equal(allowed.status, 200);
  const payload = await allowed.json();
  assert.equal(payload.user.id, "42");
  assert.equal(payload.user.allowed, true);
  assert.equal(payload.user.balance, 100);
  assert.deepEqual(payload.settings, defaultMontageSettings);
  assert.equal(readSession(allowed.cookies.get("aibot_session")?.value), "42");
  assert.ok(allowed.headers.get("set-cookie")?.includes("HttpOnly"));

  const ordinary = await authorize(signedData(43).toString());
  assert.equal(ordinary.status, 200);
  assert.deepEqual((await ordinary.json()).user, { id: "43", firstName: "Test", allowed: false, balance: 0 });

  const forged = signedData(42);
  forged.set("user", JSON.stringify({ id: 44 }));
  for (const input of [undefined, forged.toString()]) {
    const rejected = await authorize(input);
    assert.equal(rejected.status, 401);
    assert.equal(rejected.headers.get("set-cookie"), null);
  }
  console.info("Keyboards, prompts, token reservation and Telegram auth route (signed data, session cookie, settings, allowlist, forged/missing data) passed.");
}

verifyAuthRoute().then(verifyLanguage).catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  closeDatabase();
  fs.rmSync(path.dirname(verificationDb), { recursive: true, force: true });
});
