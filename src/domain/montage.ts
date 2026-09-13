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
  amber: "Warm amber and golden-yellow accents.",
  azure: "Clean azure-blue accents.",
  lime: "Fresh lime-green accents.",
  crimson: "Deep crimson-red accents.",
};

export function composePrompt(settings: MontageSettings, context: MontagePromptContext = {}): string {
  const blocks = [
    "Edit this vertical social video as a single continuous production. Preserve the speaker, framing, spoken meaning, original language, lip sync, natural motion and existing audio.",
    "Do not add brands, logos, watermarks, unsupported facts or unrelated objects. Keep the source aspect ratio and maintain visual continuity across cuts.",
    "Apply a premium Glass Reels visual style: clean modern typography, soft contrast and restrained editorial composition.",
    palette[settings.color],
  ];
  if (settings.trimVideo) blocks.push("Remove pauses, repetitions and speech filler where possible while preserving meaning and natural pacing; this is best effort and the output duration remains the source duration.");
  if (settings.generateHook && context.segmentIndex !== 2) blocks.push("Add a short compelling visual hook or text hook during the first two seconds, derived only from the source content and without inventing facts or changing the speaker's meaning.");
  if (settings.soundEffects) blocks.push("Add short, subtle sound effects at meaningful transitions without covering speech or adding background music.");
  if (settings.mediaCards) blocks.push("Add minimal illustrative media cards only where they explain the spoken content; do not invent facts, brands or numbers.");
  if (settings.emojiSubtitles) blocks.push("Add synchronized subtitles in the source language with sparse, semantically appropriate emoji, without changing the spoken text or meaning.");
  if (settings.badges) blocks.push("Highlight already-spoken key phrases and numbers with compact glass badges and cards; do not create new information.");
  if (settings.cameraMotion) blocks.push("Add gentle digital push-ins and pans without warping the face, aggressive cropping or abrupt motion.");
  if (context.segmentIndex === 2 && context.segmentCount === 2) blocks.push("This is the continuation of the previous segment. Do not create a new hook or introduction, restart the narrative, or change the established Glass style and color.");
  return blocks.join("\n\n");
}
