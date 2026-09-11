import assert from "node:assert/strict";
import { tariffs, mockVideos } from "../src/bot/mock/data";
import { tariffsKeyboard } from "../src/bot/keyboards/balance";
import { videoListKeyboard } from "../src/bot/keyboards/videos";
import { mainKeyboard } from "../src/bot/keyboards/main";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { composePrompt } from "../src/lib/prompt";
import { defaultMontageSettings } from "../src/montage/types";
import { readSession, verifyTelegramInitData } from "../src/lib/auth";
import { POST as authorizeTelegram } from "../app/api/auth/telegram/route";
import { verifyLanguage } from "./verify-language";
import { closeDatabase, completedProjectCount, completeMockPayment, createPaymentIntent, createProject, failProject, finishProject, getBotLanguage, getUser, hasActiveProject, paymentOperations, paymentState, profileIdentity, projectById, reserveGeneration, saveProfileIdentity, setBotLanguage, updateProject } from "../src/lib/database";
import { paymentPackages, priceFor } from "../src/lib/payments";
import { createWatermark } from "../src/lib/watermark";
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
const init = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: "test", user: JSON.stringify({ id: 42, first_name: "Test", username: "tester" }) });
const check = [...init.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
init.set("hash", crypto.createHmac("sha256", secret).update(check).digest("hex"));
assert.deepEqual(verifyTelegramInitData(init.toString(), token), { id: "42", firstName: "Test", username: "tester" });
init.set("user", JSON.stringify({ id: 99 }));
assert.throws(() => verifyTelegramInitData(init.toString(), token));
const verificationDb = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "aibot-verify-")), "app.sqlite");
process.env.DATABASE_PATH = verificationDb;
process.env.TELEGRAM_ALLOWED_USER_IDS = "42";
process.env.APP_URL = "http://verification.local";
process.env.BOT_TOKEN = "verification-token";
process.env.SESSION_SECRET = "verification-session-secret";
process.env.PAYMENTS_MODE = "mock";
assert.deepEqual(paymentPackages.map((item) => item.stars), [1118, 2618, 4868]);
assert.equal(priceFor(paymentPackages[1], "foreign_card_2").label, "$43.00");
assert.equal(getUser("42").balance, 100);
const project = createProject("verify-project", "42", defaultMontageSettings);
assert.ok(hasActiveProject("42"));
updateProject(project.id, { status: "uploaded", inputPath: "/tmp/input.mp4" });
assert.deepEqual(reserveGeneration(project.id, "42", prompt), { ok: true, trial: true, cost: 0 });
assert.equal(getUser("42").balance, 100);
failProject(project.id, "provider_failed");
assert.equal(getUser("42").balance, 100);
const paidIntent = createPaymentIntent("45", "payment-paid-user", "start", "ru_card", "paid-user-key");
assert.ok(paidIntent);
completeMockPayment("45", paidIntent.id, "paid");
const paidProject = createProject("verify-paid-project", "45", defaultMontageSettings);
updateProject(paidProject.id, { status: "uploaded", inputPath: "/tmp/input.mp4" });
assert.deepEqual(reserveGeneration(paidProject.id, "45", prompt), { ok: true, trial: false, cost: 23 });
assert.equal(getUser("45").balance, 217);
failProject(paidProject.id, "provider_failed");
assert.equal(getUser("45").balance, 240);
const trial = createProject("verify-trial", "43", defaultMontageSettings);
updateProject(trial.id, { status: "uploaded", inputPath: "/tmp/input.mp4" });
assert.deepEqual(reserveGeneration(trial.id, "43", prompt), { ok: true, trial: true, cost: 0 });
assert.equal(getUser("43").balance, 0);
finishProject(trial.id, "/tmp/result.mp4", "/tmp/trial-watermarked.mp4");
assert.equal(completedProjectCount("43"), 1);
assert.equal(completedProjectCount("42"), 0);
setBotLanguage("43", "en");
assert.equal(getBotLanguage("43"), "en");
assert.equal(getBotLanguage("44"), "ru");
saveProfileIdentity("46", "Profile", "profile_user");
assert.deepEqual(profileIdentity("46"), { firstName: "Profile", username: "profile_user" });
assert.equal(paymentState("43").trialAvailable, false);
const payment = createPaymentIntent("43", "payment-1", "active", "telegram_stars", "payment-key");
assert.ok(payment);
assert.equal(createPaymentIntent("43", "payment-duplicate", "active", "telegram_stars", "payment-key")?.id, "payment-1");
const paid = completeMockPayment("43", "payment-1", "paid");
assert.equal(paid?.balance, 590);
assert.equal(paid?.operation.status, "paid");
assert.ok(projectById(trial.id)?.trialUnlockedAt);
assert.equal(paymentOperations("43").length, 1);
assert.equal(paymentOperations("42").length, 0);
const cancelled = createPaymentIntent("44", "payment-cancelled", "start", "ru_card", "cancel-key");
assert.ok(cancelled);
assert.equal(completeMockPayment("44", "payment-cancelled", "cancelled")?.balance, 0);
async function verifyAuthRoute() {
  const signedData = (id: number) => {
    const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id, first_name: "Test", username: `user${id}` }) });
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
  assert.equal(payload.user.username, "user42");
  assert.equal(payload.user.language, "ru");
  assert.equal(payload.user.trialAvailable, true);
  assert.deepEqual(payload.settings, defaultMontageSettings);
  assert.equal(readSession(allowed.cookies.get("aibot_session")?.value), "42");
  assert.ok(allowed.headers.get("set-cookie")?.includes("HttpOnly"));

  const ordinary = await authorize(signedData(43).toString());
  assert.equal(ordinary.status, 200);
  assert.deepEqual((await ordinary.json()).user, { id: "43", firstName: "Test", username: "user43", language: "en", allowed: false, balance: 590, trialAvailable: false, trialProjectId: "verify-trial", trialUnlocked: true });

  const forged = signedData(42);
  forged.set("user", JSON.stringify({ id: 44 }));
  for (const input of [undefined, forged.toString()]) {
    const rejected = await authorize(input);
    assert.equal(rejected.status, 401);
    assert.equal(rejected.headers.get("set-cookie"), null);
  }
  console.info("Keyboards, tariffs, mock payment idempotency, trial unlock, token reservation and Telegram auth route passed.");
}

async function verifyWatermark() {
  const executable = ffmpegPath;
  if (!executable) throw new Error("ffmpeg-static is required for trial watermarks");
  const root = path.dirname(verificationDb);
  const input = path.join(root, "watermark-input.mp4");
  const output = path.join(root, "watermark-output.mp4");
  await new Promise<void>((resolve, reject) => {
    const process = spawn(executable, ["-y", "-f", "lavfi", "-i", "color=c=blue:s=360x640:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p", input]);
    process.on("error", reject);
    process.on("exit", (code) => code === 0 ? resolve() : reject(new Error("ffmpeg_fixture_failed")));
  });
  await createWatermark(input, output);
  assert.ok(fs.statSync(output).size > 0, "Watermarked trial output must not be empty");
}

verifyAuthRoute().then(verifyWatermark).then(verifyLanguage).catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => {
  closeDatabase();
  fs.rmSync(path.dirname(verificationDb), { recursive: true, force: true });
});
