export type MediaKind = "video" | "audio" | "image";

const VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/3gpp",
];

const AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "audio/aac",
];

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
];

export const ALLOWED_CONTENT_TYPES = [
  ...VIDEO_TYPES,
  ...AUDIO_TYPES,
  ...IMAGE_TYPES,
];

export function kindFromMime(mime: string, filename?: string): MediaKind {
  const lower = mime.toLowerCase();
  if (VIDEO_TYPES.includes(lower) || lower.startsWith("video/")) return "video";
  if (AUDIO_TYPES.includes(lower) || lower.startsWith("audio/")) return "audio";
  if (IMAGE_TYPES.includes(lower) || lower.startsWith("image/")) return "image";

  const ext = filename?.split(".").pop()?.toLowerCase();
  if (ext && ["mp4", "mov", "webm", "m4v", "3gp"].includes(ext)) return "video";
  if (ext && ["mp3", "m4a", "wav", "aac", "ogg"].includes(ext)) return "audio";
  if (ext && ["jpg", "jpeg", "png", "webp", "heic", "heif", "gif"].includes(ext))
    return "image";

  throw new Error(`Unsupported file type: ${mime || filename}`);
}

export function isAllowedContentType(mime: string): boolean {
  const lower = mime.toLowerCase();
  return (
    ALLOWED_CONTENT_TYPES.includes(lower) ||
    lower.startsWith("video/") ||
    lower.startsWith("audio/") ||
    lower.startsWith("image/")
  );
}
