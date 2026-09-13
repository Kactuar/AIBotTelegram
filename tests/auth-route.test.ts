import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { POST as authorizeTelegram } from "@/app/api/auth/telegram/route";
import { readSession, verifyTelegramInitData } from "@/src/server/auth";
import { createLegacyDatabase, createTestDatabase } from "./helpers";

let remove: (() => void) | undefined;
afterEach(() => { remove?.(); remove = undefined; });

function signedInitData(id: number, token = "verification-token") {
  const params = new URLSearchParams({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: "test", user: JSON.stringify({ id, first_name: "Test", username: `user${id}` }) });
  const checkString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  params.set("hash", crypto.createHmac("sha256", secret).update(checkString).digest("hex"));
  return params;
}

describe("Telegram authorization route", () => {
  it("verifies initData and creates the signed session cookie", async () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    createLegacyDatabase(fixture.filename);
    const valid = signedInitData(42).toString();
    expect(verifyTelegramInitData(valid)).toMatchObject({ id: "42", firstName: "Test", username: "user42" });
    const response = await authorizeTelegram(new Request("http://verification.local/api/auth/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData: valid }) }));
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.user).toMatchObject({ id: "42", allowed: true, balance: 100, language: "ru", trialAvailable: true });
    const cookie = response.cookies.get("aibot_session")?.value;
    expect(readSession(cookie)).toBe("42");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });

  it("rejects a forged Telegram user payload", async () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    createLegacyDatabase(fixture.filename);
    const forged = signedInitData(42);
    forged.set("user", JSON.stringify({ id: 99 }));
    const response = await authorizeTelegram(new Request("http://verification.local/api/auth/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ initData: forged.toString() }) }));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
