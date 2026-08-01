/** Client-side: count when Kelli opens or plays a memory — once per session. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORAGE_KEY = "kelli-viewed-media";

function alreadyViewedThisSession(mediaId: string): boolean {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const ids = JSON.parse(raw) as string[];
    return Array.isArray(ids) && ids.includes(mediaId);
  } catch {
    return false;
  }
}

function markViewedThisSession(mediaId: string) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const ids = raw ? (JSON.parse(raw) as string[]) : [];
    const next = Array.isArray(ids) ? ids : [];
    if (!next.includes(mediaId)) {
      next.push(mediaId);
      // Keep the list from growing forever in a long tab.
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(next.slice(-500)),
      );
    }
  } catch {
    /* private mode / blocked storage — in-memory still helps below */
  }
}

const remembered = new Set<string>();

export function recordMediaView(mediaId: string | null | undefined) {
  if (!mediaId || !UUID_RE.test(mediaId)) return;
  if (remembered.has(mediaId) || alreadyViewedThisSession(mediaId)) return;

  remembered.add(mediaId);
  markViewedThisSession(mediaId);

  void fetch(`/api/site/media/${mediaId}/view`, {
    method: "POST",
    keepalive: true,
  }).catch(() => {
    /* ignore; offline / auth shouldn't break playback */
  });
}
