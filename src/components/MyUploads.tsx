"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LightboxOverlay,
  type LightboxPhoto,
} from "@/components/LightboxOverlay";

export type UploadItem = {
  id: string;
  kind: "video" | "audio" | "image";
  status: string;
  previewUrl: string;
  originalFilename: string | null;
  title: string | null;
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
          alt: item.title || item.originalFilename || "Photo",
          caption: item.title,
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
          Tap a photo to see it bigger.
        </p>
      </div>

      {error && (
        <p className="text-center text-sm text-[var(--blush)]">{error}</p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => {
          const galleryIndex = imageGallery.findIndex((p) => p.id === item.id);
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
                      alt={item.title || item.originalFilename || "Photo"}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : item.kind === "video" ? (
                  <video
                    src={item.previewUrl}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                    controls
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[var(--surface)] px-3 text-center">
                    <audio
                      src={item.previewUrl}
                      controls
                      className="w-full max-w-[90%]"
                    />
                  </div>
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
