import { describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/csp-report/route";

describe("CSP report endpoint", () => {
  it("accepts a bounded report without logging the source document URL", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(new Request("http://verification.local/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/csp-report" },
      body: JSON.stringify({ "csp-report": { "document-uri": "https://private.example/mini-app", "violated-directive": "script-src", "blocked-uri": "https://telegram.org/js/telegram-web-app.js" } }),
    }));
    expect(response.status).toBe(204);
    expect(info.mock.calls[0][1]).not.toContain("private.example");
  });
});
