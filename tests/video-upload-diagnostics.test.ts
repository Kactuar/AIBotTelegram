import { afterEach, describe, expect, it, vi } from "vitest";

const requireUserId = vi.hoisted(() => vi.fn());
vi.mock("@/src/server/auth", () => ({ requireUserId }));

import { POST } from "@/app/api/diagnostics/video-upload/route";

afterEach(() => { vi.restoreAllMocks(); requireUserId.mockReset(); });

describe("video upload diagnostics route", () => {
  it("logs an authenticated allowlisted event without file names", async () => {
    requireUserId.mockResolvedValue("42");
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const response = await POST(new Request("http://verification.local/api/diagnostics/video-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ traceId: "trace-1", event: "metadata_loaded", details: { extension: "mp4", contentType: "video/mp4", size: 12, duration: 3, width: 1080, height: 1920, fileName: "private-video.mp4" } }),
    }));
    expect(response.status).toBe(204);
    expect(info).toHaveBeenCalledWith("[video-upload]", expect.stringContaining('"traceId":"trace-1"'));
    expect(info.mock.calls[0][1]).not.toContain("private-video.mp4");
  });

  it("rejects unauthenticated, unknown, and oversized events", async () => {
    requireUserId.mockRejectedValue(new Error("unauthorized"));
    expect((await POST(new Request("http://verification.local", { method: "POST" }))).status).toBe(401);

    requireUserId.mockResolvedValue("42");
    const unknown = await POST(new Request("http://verification.local", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ traceId: "trace-1", event: "anything_else" }) }));
    expect(unknown.status).toBe(400);
    const oversized = await POST(new Request("http://verification.local", { method: "POST", headers: { "Content-Length": "2049" }, body: "x" }));
    expect(oversized.status).toBe(413);
  });
});
