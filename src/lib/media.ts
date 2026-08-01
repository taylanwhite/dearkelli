export type MediaKind = "video" | "audio" | "image";

const VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime", // .mov (iPhone)
  "video/webm",
  "video/x-m4v",
  "video/3gpp",
  "video/3gpp2",
  "video/mpeg",
  "video/x-msvideo", // .avi
];

const AUDIO_TYPES = [
  "audio/mpeg", // .mp3
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a", // iPhone voice memos
  "audio/aac",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
  "audio/x-caf", // older iOS voice memos
  "audio/amr",
  "audio/3gpp",
];

const IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/gif",
  "image/bmp",
  "image/tiff",
];

export const ALLOWED_CONTENT_TYPES = [
  ...VIDEO_TYPES,
  ...AUDIO_TYPES,
  ...IMAGE_TYPES,
];

/** Hard cap for contributor uploads (Blob token + client checks). */
export const MAX_UPLOAD_BYTES = 1024 * 1024 * 1024; // 1 GB

export const MAX_UPLOAD_LABEL = "1 GB";

export function isOverUploadLimit(size: number) {
  return size > MAX_UPLOAD_BYTES;
}

export function uploadLimitMessage(filename?: string) {
  const name = filename?.trim();
  return name
    ? `${name} is too large. The maximum is ${MAX_UPLOAD_LABEL}.`
    : `That file is too large. The maximum is ${MAX_UPLOAD_LABEL}.`;
}

const VIDEO_EXTS = ["mp4", "mov", "webm", "m4v", "3gp", "3g2", "avi", "mpeg", "mpg"];
const AUDIO_EXTS = [
  "mp3",
  "m4a",
  "wav",
  "aac",
  "ogg",
  "flac",
  "caf",
  "amr",
  "opus",
];
const IMAGE_EXTS = [
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "gif",
  "bmp",
  "tif",
  "tiff",
];

export function kindFromMime(mime: string, filename?: string): MediaKind {
  const lower = (mime || "").toLowerCase();
  if (VIDEO_TYPES.includes(lower) || lower.startsWith("video/")) return "video";
  if (AUDIO_TYPES.includes(lower) || lower.startsWith("audio/")) return "audio";
  if (IMAGE_TYPES.includes(lower) || lower.startsWith("image/")) return "image";

  const ext = filename?.split(".").pop()?.toLowerCase();
  if (ext && VIDEO_EXTS.includes(ext)) return "video";
  if (ext && AUDIO_EXTS.includes(ext)) return "audio";
  if (ext && IMAGE_EXTS.includes(ext)) return "image";

  throw new Error(`Unsupported file type: ${mime || filename}`);
}

export function isAllowedContentType(mime: string, filename?: string): boolean {
  try {
    kindFromMime(mime, filename);
    return true;
  } catch {
    return false;
  }
}

/** True when this image needs HEIC/HEIF conversion before sharp/vision. */
export function isHeicLike(filename?: string | null, blobUrl?: string | null, mime?: string | null) {
  const hay = `${filename || ""} ${blobUrl || ""} ${mime || ""}`.toLowerCase();
  return (
    hay.includes(".heic") ||
    hay.includes(".heif") ||
    hay.includes("image/heic") ||
    hay.includes("image/heif")
  );
}
