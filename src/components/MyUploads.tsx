"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LightboxOverlay,
  type LightboxPhoto,
} from "@/components/LightboxOverlay";
import { pauseOtherMedia } from "@/lib/sole-media";

export type UploadItem = {
  id: string;
  kind: "video" | "audio" | "image";
  status: string;
  previewUrl: string;
  posterPreviewUrl?: string | null;
  originalFilename: string | null;
  title: string | null;
  summary: string | null;
  isAvatar: boolean;
};

type Props = {
  token: string;
  refreshKey?: number;
  onAvatarCleared?: () => void;
};

function labelFor(item: UploadItem) {
  if (item.kind === "image") return item.isAvatar ? "Your photo" : "Photo";
  if (item.kind === "video") return "Video";
  return "Voice";
}

function AttachmentNote({
  token,
  item,
  onSaved,
}: {
  token: string;
  item: UploadItem;
  onSaved: (id: string, summary: string | null) => void;
}) {
  const [draft, setDraft] = useState(item.summary ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(item.summary ?? "");
  }, [item.id, item.summary]);

  const dirty = draft.trim() !== (item.summary ?? "").trim();

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    const next = draft.trim() ? draft.trim().slice(0, 280) : null;
    try {
      const res = await fetch(`/api/contributor/${token}/media/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: next }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Couldn't save that note");
      }
      onSaved(item.id, next);
      setDraft(next ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that note");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-t border-[var(--cream)]/10 bg-[var(--surface)] px-3 py-2.5">
      <label className="block">
        <span className="text-[11px] uppercase tracking-wide text-[var(--cream)]/45">
          Note (optional)
        </span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 280))}
          onBlur={() => void save()}
          rows={2}
          maxLength={280}
          placeholder="A quick note about this memory"
          className="mt-1.5 w-full resize-none rounded-xl border border-[var(--cream)]/15 bg-[var(--ground)] px-2.5 py-2 text-sm leading-snug text-[var(--cream)] placeholder:text-[var(--cream)]/35 focus:border-[var(--cream)]/35 focus:outline-none"
        />
      </label>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="text-[11px] text-[var(--cream)]/35">
          {draft.length}/280
        </span>
        {dirty ? (
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="text-[11px] font-medium text-[var(--gold)] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        ) : item.summary ? (
          <span className="text-[11px] text-[var(--cream)]/40">Saved</span>
        ) : null}
      </div>
      {error ? (
        <p className="mt-1 text-[11px] text-[var(--blush)]">{error}</p>
      ) : null}
    </div>
  );
}

export function MyUploads({ token, refreshKey = 0, onAvatarCleared }: Props) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/contributor/${token}/media`);
      if (!res.ok) {
        throw new Error("Couldn't load what you've sent");
      }
      const data = (await res.json()) as { media: UploadItem[] };
      setItems(data.media);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load that");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, refreshKey]);

  const imageGallery: LightboxPhoto[] = useMemo(
    () =>
      items
        .filter((item) => item.kind === "image")
        .map((item) => ({
          id: item.id,
          src: item.previewUrl,
          alt: item.summary || item.originalFilename || "Photo",
          caption: item.summary,
        })),
    [items],
  );

  async function remove(item: UploadItem) {
    if (removingId) return;
    setRemovingId(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/contributor/${token}/media/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Couldn't remove that");
      }
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      if (item.isAvatar) onAvatarCleared?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that");
    } finally {
      setRemovingId(null);
    }
  }

  if (loading && items.length === 0) {
    return (
      <p className="text-center text-sm text-[var(--cream)]/50">
        Looking at what you&apos;ve already sent…
      </p>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
          What you&apos;ve sent
        </p>
        <p className="mt-1 text-sm text-[var(--cream)]/55">
          Add an optional note on photos and videos.
        </p>
      </div>

      {error && (
        <p className="text-center text-sm text-[var(--blush)]">{error}</p>
      )}

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const galleryIndex = imageGallery.findIndex((p) => p.id === item.id);

          if (item.kind === "audio") {
            return (
              <li
                key={item.id}
                className="overflow-hidden rounded-2xl border border-[var(--cream)]/20 bg-[var(--surface)] shadow-[0_4px_16px_rgba(58,53,50,0.12)] sm:col-span-2"
              >
                <div className="flex items-center justify-between gap-2 px-3 pt-3">
                  <span className="text-xs font-medium text-[var(--cream)]/80">
                    Voice
                  </span>
                  <button
                    type="button"
                    onClick={() => void remove(item)}
                    disabled={removingId === item.id}
                    className="shrink-0 text-xs font-medium text-[var(--rose-deep)] underline-offset-2 hover:underline disabled:opacity-50"
                  >
                    {removingId === item.id ? "…" : "Remove"}
                  </button>
                </div>
                <div className="px-3 pb-3 pt-2">
                  <audio
                    src={item.previewUrl}
                    preload="none"
                    controls
                    controlsList="nodownload noplaybackrate"
                    className="w-full"
                    onPlay={(e) => pauseOtherMedia(e.currentTarget)}
                  />
                </div>
              </li>
            );
          }

          return (
            <li
              key={item.id}
              className="overflow-hidden rounded-2xl border border-[var(--cream)]/20 bg-[var(--ground)] shadow-[0_4px_16px_rgba(58,53,50,0.12)]"
            >
              <div className="relative aspect-square bg-[var(--sage-deep)]">
                {item.kind === "image" ? (
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex(galleryIndex >= 0 ? galleryIndex : 0)
                    }
                    className="h-full w-full touch-manipulation"
                    aria-label="Enlarge photo"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.previewUrl}
                      alt={item.summary || item.originalFilename || "Photo"}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <video
                    src={item.previewUrl}
                    poster={item.posterPreviewUrl || undefined}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    preload="none"
                    controls
                    controlsList="nodownload noplaybackrate"
                    disablePictureInPicture
                    disableRemotePlayback
                    onPlay={(e) => pauseOtherMedia(e.currentTarget)}
                  />
                )}
              </div>
              <div className="flex items-center justify-between gap-2 bg-[var(--surface)] px-3 py-2.5">
                <span className="truncate text-xs font-medium text-[var(--cream)]/80">
                  {labelFor(item)}
                </span>
                <button
                  type="button"
                  onClick={() => void remove(item)}
                  disabled={removingId === item.id}
                  className="shrink-0 text-xs font-medium text-[var(--rose-deep)] underline-offset-2 hover:underline disabled:opacity-50"
                >
                  {removingId === item.id ? "…" : "Remove"}
                </button>
              </div>
              <AttachmentNote
                token={token}
                item={item}
                onSaved={(id, summary) =>
                  setItems((prev) =>
                    prev.map((row) =>
                      row.id === id ? { ...row, summary } : row,
                    ),
                  )
                }
              />
            </li>
          );
        })}
      </ul>

      <LightboxOverlay
        photos={imageGallery}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onChangeIndex={setLightboxIndex}
      />
    </div>
  );
}
