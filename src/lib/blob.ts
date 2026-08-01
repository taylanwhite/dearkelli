/** Store is private; uploads and reads must use this access mode. */
export const BLOB_ACCESS = "private" as const;

/** Browser-playable URL that streams a private blob through our API. */
export function playableUrl(
  blobUrl: string | null | undefined,
  opts?: { token?: string | null },
): string {
  if (!blobUrl) return "";
  if (blobUrl.startsWith("/")) return blobUrl;
  const base = `/api/media/stream?url=${encodeURIComponent(blobUrl)}`;
  if (!opts?.token) return base;
  return `${base}&token=${encodeURIComponent(opts.token)}`;
}

/** Prefer the compressed web playback file when we have one. */
export function playbackSrc(opts: {
  blobUrl: string;
  playbackUrl?: string | null;
  token?: string | null;
}): string {
  return playableUrl(opts.playbackUrl || opts.blobUrl, { token: opts.token });
}
