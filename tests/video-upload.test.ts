import { describe, expect, it } from "vitest";
import { videoUploadDetails } from "@/src/domain/video-upload";

describe("video upload type detection", () => {
  it.each([
    [{ name: "clip.mp4", type: "video/mp4" }, { contentType: "video/mp4", extension: ".mp4" }],
    [{ name: "clip.mp4", type: "" }, { contentType: "video/mp4", extension: ".mp4" }],
    [{ name: "clip.mp4", type: "application/octet-stream" }, { contentType: "video/mp4", extension: ".mp4" }],
    [{ name: "CLIP.MP4", type: "" }, { contentType: "video/mp4", extension: ".mp4" }],
  ])("accepts %o", (file, expected) => {
    expect(videoUploadDetails(file)).toEqual(expected);
  });

  it("rejects an unsupported file", () => {
    expect(videoUploadDetails({ name: "clip.avi", type: "video/x-msvideo" })).toBeUndefined();
  });
});
