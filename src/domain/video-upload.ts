export const MAX_VIDEO_UPLOAD_BYTES = 100 * 1024 * 1024;

const extensions = {
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/x-matroska": ".mkv",
  "video/webm": ".webm",
} as const;

export type VideoContentType = keyof typeof extensions;

export function videoUploadDetails(file: { name: string; type?: string | null }): { contentType: VideoContentType; extension: string } | undefined {
  const contentType = file.type?.split(";", 1)[0].trim().toLowerCase() as VideoContentType | undefined;
  if (contentType && Object.prototype.hasOwnProperty.call(extensions, contentType)) return { contentType, extension: extensions[contentType] };
  const extension = `.${file.name.split(".").pop()?.toLowerCase() || ""}`;
  const entry = (Object.entries(extensions) as [VideoContentType, string][]).find(([, value]) => value === extension);
  return entry && { contentType: entry[0], extension: entry[1] };
}
