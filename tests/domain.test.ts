import { describe, expect, it } from "vitest";
import { composePrompt, defaultMontageSettings, montageColors } from "@/src/domain/montage";
import { paymentPackages, priceFor } from "@/src/domain/payments";
import { tariffs, mockVideos } from "@/src/bot/mock/data";
import { tariffsKeyboard } from "@/src/bot/keyboards/balance";
import { mainKeyboard } from "@/src/bot/keyboards/main";
import { videoListKeyboard } from "@/src/bot/keyboards/videos";

describe("pure domain and bot helpers", () => {
  it("keeps prompt composition and payment catalogue unchanged", () => {
    const prompt = composePrompt({ ...defaultMontageSettings, color: "crimson", generateHook: true, badges: true });
    expect(prompt).toContain("deep crimson-red");
    expect(prompt).toContain("Instagram/Reels");
    expect(prompt).toContain("modern synchronized animated subtitles");
    expect(prompt).toContain("source footage as the base");
    expect(prompt).toContain("do not replace it or generate a different video");
    expect(prompt).toContain("source-based visual or text hook");
    expect(prompt).toContain("compact Glass cards");
    expect(prompt).not.toContain("sound design");
    expect(prompt).not.toContain("emoji");
    expect(paymentPackages.map((item) => item.stars)).toEqual([1118, 2618, 4868]);
    expect(priceFor(paymentPackages[1], "foreign_card_2").label).toBe("$43.00");
  });

  it("keeps the complete montage palette ordered and described in prompts", () => {
    expect(montageColors).toEqual(["amber", "azure", "lime", "crimson", "pearl", "turquoise", "violet", "neon-pink", "white", "orange"]);
    const descriptions = {
      pearl: "soft pearl and champagne",
      turquoise: "vivid turquoise",
      violet: "rich violet",
      "neon-pink": "vivid neon pink",
      white: "clean white with sufficient contrast",
      orange: "energetic orange",
    } as const;
    for (const [color, description] of Object.entries(descriptions)) {
      expect(composePrompt({ ...defaultMontageSettings, color: color as keyof typeof descriptions })).toContain(description);
    }
  });

  it("adds enabled editing instructions and only hooks the first segment", () => {
    const settings = { ...defaultMontageSettings, generateHook: true, soundEffects: true, mediaCards: true, emojiSubtitles: true, badges: true, cameraMotion: true };
    const first = composePrompt(settings, { segmentIndex: 1, segmentCount: 2 });
    const second = composePrompt(settings, { segmentIndex: 2, segmentCount: 2 });
    expect(first).toContain("source-based visual or text hook");
    expect(first).toContain("sound effects");
    expect(first).toContain("media cards");
    expect(first).toContain("emoji");
    expect(first).toContain("compact Glass cards");
    expect(first).toContain("digital push-ins");
    expect(second).not.toContain("source-based visual or text hook");
    expect(second).toContain("Continuation of the previous segment");
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
