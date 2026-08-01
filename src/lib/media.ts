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

/** Hard caps for contributor uploads (Blob token + client checks). */
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // 25 MB
export const MAX_AUDIO_BYTES = 40 * 1024 * 1024; // 40 MB
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB — compressed after upload

/** Largest allowed upload (used where kind isn't known yet). */
export const MAX_UPLOAD_BYTES = MAX_VIDEO_BYTES;

export const MAX_UPLOAD_LABEL = "200 MB for video · 25 MB for photos";

export function maxUploadBytesForKind(
  kind: "image" | "video" | "audio" | "other" | string,
): number {
  if (kind === "image") return MAX_IMAGE_BYTES;
  if (kind === "audio") return MAX_AUDIO_BYTES;
  if (kind === "video") return MAX_VIDEO_BYTES;
  return MAX_UPLOAD_BYTES;
}

export function uploadLimitLabelForKind(
  kind: "image" | "video" | "audio" | "other" | string,
): string {
  if (kind === "image") return "25 MB";
  if (kind === "audio") return "40 MB";
  if (kind === "video") return "200 MB";
  return MAX_UPLOAD_LABEL;
}

export function isOverUploadLimit(
  size: number,
  kind?: "image" | "video" | "audio" | "other" | string,
) {
  const max = kind ? maxUploadBytesForKind(kind) : MAX_UPLOAD_BYTES;
  return size > max;
}

export function uploadLimitMessage(
  filename?: string,
  kind?: "image" | "video" | "audio" | "other" | string,
) {
  const name = filename?.trim();
  if (kind === "image") {
    return name
      ? `${name} is too large to send. Try a smaller photo.`
      : "That photo is too large to send. Try a smaller one.";
  }
  if (kind === "video") {
    return name
      ? `${name} is too large to send. Try a shorter clip.`
      : "That video is too large to send. Try a shorter clip.";
  }
  if (kind === "audio") {
    return name
      ? `${name} is too large to send.`
      : "That recording is too large to send.";
  }
  return name
    ? `${name} is too large to send.`
    : "That file is too large to send.";
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
