import { afterEach, test } from "vitest";
import { closeDatabase } from "@/src/server/database";
import { verifyLanguage } from "@/scripts/verify-language";
import { createTestDatabase } from "./helpers";

let remove: (() => void) | undefined;
afterEach(() => { closeDatabase(); remove?.(); remove = undefined; });

test("persists language and handles localized bot menus offline", async () => {
  const fixture = createTestDatabase();
  remove = fixture.remove;
  await verifyLanguage();
});
