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
  runwayTaskId: string | null;
  status: ProjectStatus;
  errorCode: string | null;
  reservedTokens: number;
  createdAt: string;
  updatedAt: string;
  resultExpiresAt: string | null;
}
