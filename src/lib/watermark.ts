import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

const executable = process.env.FFMPEG_PATH || ffmpegPath;

export function watermarkResultPath(result: string) { return path.join(path.dirname(result), "trial-watermarked.mp4"); }

export async function createWatermark(input: string, output: string) {
  if (!executable) throw new Error("ffmpeg_not_configured");
  const fontFile = [process.env.FFMPEG_FONT_FILE, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"].find((candidate) => candidate && fs.existsSync(candidate));
  const font = fontFile ? `fontfile='${fontFile.replace(/'/g, "\\'")}':` : "";
  const marks = ["20:70", "300:250", "80:430", "360:610"].map((position) => `drawtext=${font}text='Brandly':x=${position.split(":")[0]}:y=${position.split(":")[1]}:fontsize=34:fontcolor=white@0.38:shadowcolor=black@0.3:shadowx=2:shadowy=2`).join(",");
  await new Promise<void>((resolve, reject) => {
    const process = spawn(executable, ["-y", "-i", input, "-map", "0:v:0", "-map", "0:a?", "-vf", marks, "-c:v", "libx264", "-c:a", "copy", output], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    process.stderr?.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    process.on("error", reject);
    process.on("close", (code) => code === 0 ? resolve() : reject(new Error(`watermark_failed: ${stderr.trim().slice(-1000)}`)));
  });
}
