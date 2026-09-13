export type MontageColor = "amber" | "azure" | "lime" | "crimson";

export interface MontageSettings {
  style: "glass";
  color: MontageColor;
  trimVideo: boolean;
  generateHook: boolean;
  soundEffects: boolean;
  mediaCards: boolean;
  emojiSubtitles: boolean;
  badges: boolean;
  cameraMotion: boolean;
}

export const defaultMontageSettings: MontageSettings = {
  style: "glass",
  color: "azure",
  trimVideo: true,
  generateHook: false,
  soundEffects: false,
  mediaCards: false,
  emojiSubtitles: false,
  badges: false,
  cameraMotion: false,
};

export type ProjectStatus = "draft" | "uploading" | "uploaded" | "queued" | "processing" | "completed" | "failed";

export interface ProjectRecord {
  id: string;
  userId: string;
  settings: MontageSettings;
  prompt: string | null;
  inputPath: string | null;
  resultPath: string | null;
  watermarkedResultPath: string | null;
  isTrial: boolean;
  trialUnlockedAt: string | null;
  runwayTaskId: string | null;
  status: ProjectStatus;
  errorCode: string | null;
  reservedTokens: number;
  createdAt: string;
  updatedAt: string;
  resultExpiresAt: string | null;
}

const palette: Record<MontageSettings["color"], string> = {
  amber: "Warm amber and golden-yellow accents.",
  azure: "Clean azure-blue accents.",
  lime: "Fresh lime-green accents.",
  crimson: "Deep crimson-red accents.",
};

export function composePrompt(settings: MontageSettings): string {
  const blocks = [
    "Preserve the speaker, framing, spoken content and natural motion of the source video.",
    "Apply a premium Glass Reels visual style: clean modern typography, soft contrast and restrained editorial composition.",
    palette[settings.color],
  ];
  if (settings.trimVideo) blocks.push("Trim pauses and weak moments into a concise engaging vertical reel.");
  if (settings.generateHook) blocks.push("Add a short compelling visual hook at the beginning, without inventing facts.");
  if (settings.soundEffects) blocks.push("Add subtle, unobtrusive sound design where it improves transitions.");
  if (settings.mediaCards) blocks.push("Add minimal supporting media cards only when they help explain the spoken content.");
  if (settings.emojiSubtitles) blocks.push("Use a few tasteful emoji accents in on-screen captions.");
  if (settings.badges) blocks.push("Use compact glass badges and cards for important points.");
  if (settings.cameraMotion) blocks.push("Add gentle virtual camera motion while keeping the speaker natural.");
  return blocks.join("\n\n");
}
