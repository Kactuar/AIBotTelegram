import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";
import { inspectVideo } from "./video-processing";

const executable = process.env.FFMPEG_PATH || ffmpegPath;
const glyphs: Record<string, string[]> = {
  B: ["1110", "1001", "1001", "1110", "1001", "1001", "1110"], R: ["1110", "1001", "1001", "1110", "1010", "1001", "1001"], A: ["0110", "1001", "1001", "1111", "1001", "1001", "1001"], N: ["1001", "1101", "1101", "1011", "1011", "1001", "1001"], D: ["1110", "1001", "1001", "1001", "1001", "1001", "1110"], L: ["1000", "1000", "1000", "1000", "1000", "1000", "1111"], Y: ["1001", "1001", "0110", "0010", "0010", "0010", "0010"],
};

function writeWatermarkLayer(filename: string, width: number, height: number) {
  const pixels = Buffer.alloc(width * height * 3);
  const draw = (text: string, x: number, y: number) => text.split("").forEach((letter, letterIndex) => glyphs[letter].forEach((row, rowIndex) => [...row].forEach((pixel, pixelIndex) => {
    if (pixel !== "1") return;
    for (let dy = 0; dy < 5; dy++) for (let dx = 0; dx < 5; dx++) {
      const px = x + letterIndex * 28 + pixelIndex * 5 + dx; const py = y + rowIndex * 5 + dy;
      if (px < width && py < height) pixels[(py * width + px) * 3] = pixels[(py * width + px) * 3 + 1] = pixels[(py * width + px) * 3 + 2] = 255;
    }
  })));
  [[18, 72], [136, 235], [36, 398], [154, 561]].forEach(([x, y]) => draw("BRANDLY", x, y));
  fs.writeFileSync(filename, Buffer.concat([Buffer.from(`P6\n${width} ${height}\n255\n`), pixels]));
}

export async function createWatermark(input: string, output: string) {
  if (!executable) throw new Error("ffmpeg_not_configured");
  const layer = path.join(path.dirname(output), `.brandly-watermark-${crypto.randomUUID()}.ppm`);
  const { width, height } = await inspectVideo(input, false);
  writeWatermarkLayer(layer, width, height);
  const source = layer.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
  const filter = `movie='${source}',format=rgba,colorkey=0x000000:0.01:0.0,colorchannelmixer=aa=0.38[watermark];[0:v][watermark]overlay=0:0:eof_action=repeat[out]`;
  try {
    await new Promise<void>((resolve, reject) => {
      const process = spawn(executable, ["-y", "-i", input, "-filter_complex", filter, "-map", "[out]", "-map", "0:a?", "-c:v", "libx264", "-c:a", "copy", output], { stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      process.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
      process.on("error", reject);
      process.on("close", (code) => code === 0 ? resolve() : reject(new Error(`watermark_failed: ${stderr.trim().slice(-1000)}`)));
    });
  } finally { fs.rmSync(layer, { force: true }); }
}
