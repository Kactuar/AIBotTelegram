import { describe, expect, it } from "vitest";
import { composePrompt, defaultMontageSettings } from "@/src/domain/montage";
import { paymentPackages, priceFor } from "@/src/domain/payments";
import { tariffs, mockVideos } from "@/src/bot/mock/data";
import { tariffsKeyboard } from "@/src/bot/keyboards/balance";
import { mainKeyboard } from "@/src/bot/keyboards/main";
import { videoListKeyboard } from "@/src/bot/keyboards/videos";

describe("pure domain and bot helpers", () => {
  it("keeps prompt composition and payment catalogue unchanged", () => {
    const prompt = composePrompt({ ...defaultMontageSettings, color: "crimson", generateHook: true, badges: true });
    expect(prompt).toContain("Deep crimson-red accents.");
    expect(prompt).toContain("compelling visual hook");
    expect(prompt).toContain("glass badges");
    expect(prompt).not.toContain("sound design");
    expect(paymentPackages.map((item) => item.stars)).toEqual([1118, 2618, 4868]);
    expect(priceFor(paymentPackages[1], "foreign_card_2").label).toBe("$43.00");
  });

  it("keeps menus and tariff keyboards populated", () => {
    expect(mockVideos.length).toBeGreaterThan(0);
    expect(videoListKeyboard(mockVideos).inline_keyboard).toHaveLength(mockVideos.length);
    expect(tariffsKeyboard(tariffs).inline_keyboard).toHaveLength(tariffs.length + 1);
    expect(tariffs.every((tariff) => tariff.tokens > 0 && tariff.priceRubles > 0)).toBe(true);
    const button = mainKeyboard().keyboard[0][0];
    expect(typeof button === "string" ? undefined : button.style).toBe("primary");
  });
});
