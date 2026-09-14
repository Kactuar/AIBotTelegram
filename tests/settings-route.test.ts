import { afterEach, describe, expect, it, vi } from "vitest";

const requireUserId = vi.hoisted(() => vi.fn<() => Promise<string>>());
vi.mock("@/src/server/auth", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/src/server/auth")>()), requireUserId }));

import { PUT } from "@/app/api/settings/route";
import { defaultMontageSettings } from "@/src/domain/montage";
import { createTestDatabase } from "./helpers";

let remove: (() => void) | undefined;
afterEach(() => { vi.restoreAllMocks(); remove?.(); remove = undefined; });

describe("settings route", () => {
  it("persists an added palette color and rejects an unknown one", async () => {
    const fixture = createTestDatabase(); remove = fixture.remove;
    requireUserId.mockResolvedValue("42");
    const request = (color: string) => new Request("http://verification.local/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...defaultMontageSettings, color }) });

    const saved = await PUT(request("neon-pink"));
    expect(saved.status).toBe(200);
    expect((await saved.json()).settings.color).toBe("neon-pink");

    const rejected = await PUT(request("unknown"));
    expect(rejected.status).toBe(400);
    expect(await rejected.json()).toEqual({ error: "Invalid settings" });
  });
});
