import assert from "node:assert/strict";
import { tariffs, mockVideos } from "../src/bot/mock/data";
import { tariffsKeyboard } from "../src/bot/keyboards/balance";
import { videoListKeyboard } from "../src/bot/keyboards/videos";
assert.ok(mockVideos.length > 0, "At least one mock video is required");
assert.equal(videoListKeyboard(mockVideos).inline_keyboard.length, mockVideos.length);
assert.equal(tariffsKeyboard(tariffs).inline_keyboard.length, tariffs.length + 1);
assert.ok(tariffs.every((tariff) => tariff.tokens > 0 && tariff.priceRubles > 0));
console.info("Mock data and dynamic keyboards verified.");
