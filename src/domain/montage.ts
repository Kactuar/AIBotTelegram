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

export interface MontagePromptContext {
  segmentIndex?: 1 | 2;
  segmentCount?: 1 | 2;
}

const palette: Record<MontageSettings["color"], string> = {
  amber: "Accent color: warm amber and golden-yellow.",
  azure: "Accent color: clean azure-blue.",
  lime: "Accent color: fresh lime-green.",
  crimson: "Accent color: deep crimson-red.",
};

export function composePrompt(settings: MontageSettings, context: MontagePromptContext = {}): string {
  const blocks = [
    "Edit and modernize the uploaded video into a stylish, youth-oriented Instagram/Reels cut. Keep the source footage as the base: enhance it and add elements to it; do not replace it or generate a different video.",
    "Preserve the original people, actions, speech meaning, language, lip sync, key visuals and audio. Improve pacing, cuts, transitions and framing. Support portrait, landscape and square sources while keeping the main subject visible.",
    "Add modern synchronized animated subtitles in the source language. Keep them readable, inside safe margins and off faces; use the selected color for subtitles, highlights and graphics.",
    "Use current creator-style kinetic type and subtle Glass elements. Add only elements that support the source; no logos, watermarks, invented facts or unrelated objects.",
    palette[settings.color],
  ];
  if (settings.trimVideo) blocks.push("Tighten pauses, repetitions and filler without changing meaning; preserve the overall duration.");
  if (settings.generateHook && context.segmentIndex !== 2) blocks.push("Add a short source-based visual or text hook in the first two seconds; invent no claims.");
  if (settings.soundEffects) blocks.push("Add subtle sound effects at key transitions; keep speech clear and add no music.");
  if (settings.mediaCards) blocks.push("Add minimal source-relevant media cards; invent no facts, brands or numbers.");
  if (settings.emojiSubtitles) blocks.push("Add sparse relevant emoji to subtitles without changing their text or meaning.");
  if (settings.badges) blocks.push("Show already-spoken key phrases and numbers in compact Glass cards; invent nothing.");
  if (settings.cameraMotion) blocks.push("Add gentle digital push-ins and pans without face distortion, harsh crops or abrupt motion.");
  if (context.segmentIndex === 2 && context.segmentCount === 2) blocks.push("Continuation of the previous segment: keep the same style and color; no new hook, intro or narrative restart.");
  return blocks.join("\n\n");
}
