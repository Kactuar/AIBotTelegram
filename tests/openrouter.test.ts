import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadOpenRouterOutput, MAX_OPENROUTER_OUTPUT_BYTES, openRouterTask, OpenRouterError, startOpenRouterEdit } from "@/src/server/openrouter";

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.OPENROUTER_API;
  delete process.env.APP_URL;
  delete process.env.BOT_TOKEN;
  delete process.env.SESSION_SECRET;
});

describe("OpenRouter video adapter", () => {
  it("submits the selected model and signed video reference, polls and downloads", async () => {
    process.env.OPENROUTER_API = "test-openrouter-key";
    process.env.APP_URL = "http://verification.local";
    process.env.BOT_TOKEN = "test-bot-token";
    process.env.SESSION_SECRET = "test-session-secret";
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "job-1", status: "pending" }), { status: 202 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "job-1", status: "completed" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(Buffer.from("video-bytes"), { status: 200 }));
    const jobId = await startOpenRouterEdit("https://verification.local/source?signature=x", "edit prompt");
    expect(jobId).toBe("job-1");
    expect(await openRouterTask(jobId)).toMatchObject({ id: "job-1", status: "completed" });
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "openrouter-test-"));
    const target = path.join(root, "result.mp4");
    await downloadOpenRouterOutput(jobId, target);
    expect(await fs.readFile(target, "utf8")).toBe("video-bytes");
    const submit = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(submit).toMatchObject({ model: "black-forest-labs/flux-video-edit", prompt: "edit prompt", input_references: [{ type: "video_url", video_url: { url: "https://verification.local/source?signature=x" } }] });
    for (const call of fetchMock.mock.calls) {
      expect((call[1]?.headers as Record<string, string>).Authorization).toBe("Bearer test-openrouter-key");
      expect(call[1]?.signal).toBeInstanceOf(AbortSignal);
    }
    await fs.rm(root, { recursive: true, force: true });
  });

  it("marks rate limits as retryable and configuration failures as permanent", async () => {
    process.env.OPENROUTER_API = "test-openrouter-key";
    process.env.APP_URL = "http://verification.local";
    process.env.BOT_TOKEN = "test-bot-token";
    process.env.SESSION_SECRET = "test-session-secret";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("busy", { status: 429, headers: { "Retry-After": "7" } }));
    await expect(startOpenRouterEdit("https://verification.local/source", "prompt")).rejects.toMatchObject({ retryable: true, retryAfterMs: 7000, statusCode: 429 });
    delete process.env.OPENROUTER_API;
    await expect(startOpenRouterEdit("https://verification.local/source", "prompt")).rejects.toMatchObject({ retryable: false, message: "openrouter_not_configured" });
    expect(new OpenRouterError("x", true)).toBeInstanceOf(Error);
  });

  it("rejects an output declared above the disk safety limit", async () => {
    process.env.OPENROUTER_API = "test-openrouter-key";
    process.env.APP_URL = "http://verification.local";
    process.env.BOT_TOKEN = "test-bot-token";
    process.env.SESSION_SECRET = "test-session-secret";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("small", { status: 200, headers: { "Content-Length": String(MAX_OPENROUTER_OUTPUT_BYTES + 1) } }));
    await expect(downloadOpenRouterOutput("job-1", path.join(os.tmpdir(), "output.mp4"))).rejects.toMatchObject({ message: "openrouter_output_too_large", retryable: false });
  });
});
