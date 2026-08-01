/** Store is private; uploads and reads must use this access mode. */
export const BLOB_ACCESS = "private" as const;

/** Browser-playable URL that streams a private blob through our API. */
export function playableUrl(blobUrl: string | null | undefined): string {
  if (!blobUrl) return "";
  if (blobUrl.startsWith("/")) return blobUrl;
  return `/api/media/stream?url=${encodeURIComponent(blobUrl)}`;
}

/** Prefer the compressed web playback file when we have one. */
export function playbackSrc(opts: {
  blobUrl: string;
  playbackUrl?: string | null;
}): string {
  return playableUrl(opts.playbackUrl || opts.blobUrl);
}
