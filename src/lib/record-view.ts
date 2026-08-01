/** Client-side: count when Kelli opens or plays a memory. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const recent: Record<string, number> = {};

export function recordMediaView(mediaId: string | null | undefined) {
  if (!mediaId || !UUID_RE.test(mediaId)) return;
  const now = Date.now();
  // Avoid double-counts from Strict Mode / rapid next-prev wobble.
  if (recent[mediaId] && now - recent[mediaId] < 4000) return;
  recent[mediaId] = now;

  void fetch(`/api/site/media/${mediaId}/view`, {
    method: "POST",
    keepalive: true,
  }).catch(() => {
    /* ignore; offline / auth shouldn't break playback */
  });
}
