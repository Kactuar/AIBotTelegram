import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("production deploy script", () => {
  it("builds an isolated release, backs up before migration, and rolls back by switching the current link", () => {
    const script = fs.readFileSync(path.resolve("deploy/deploy-prod.sh"), "utf8");
    expect(script).toContain("git -C \"$repository_root\" worktree add --detach");
    expect(script).toContain("npm run db:backup");
    expect(script).toContain("npm run db:migrate");
    expect(script).toContain("mv -Tf \"$candidate_link\" \"$current_link\"");
    expect(script).toContain("switch_current \"$previous_release\"");
    expect(script).not.toContain("reset --hard");
    expect(script).not.toContain("git clean");
  });
});
