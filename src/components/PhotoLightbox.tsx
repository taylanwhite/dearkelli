"use client";

import { useEffect, useState } from "react";
import { PersonBubble } from "@/components/PersonBubble";

export type LightboxPhoto = {
  id: string;
  src: string;
  alt: string;
  caption?: string | null;
  contributorId?: string;
  contributorName?: string;
  avatarUrl?: string | null;
};

type Props = {
  photos: LightboxPhoto[];
  /** masonry | grid */
  layout?: "masonry" | "grid";
  showAttribution?: boolean;
};

export function PhotoLightbox({
  photos,
  layout = "masonry",
  showAttribution = true,
}: Props) {
  const [index, setIndex] = useState<number | null>(null);
  const open = index != null ? photos[index] : null;

  useEffect(() => {
    if (index == null) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndex(null);
      if (e.key === "ArrowRight") {
        setIndex((i) =>
          i == null ? i : Math.min(photos.length - 1, i + 1),
        );
      }
      if (e.key === "ArrowLeft") {
        setIndex((i) => (i == null ? i : Math.max(0, i - 1)));
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [index, photos.length]);

  if (photos.length === 0) return null;

  return (
    <>
      <ul
        className={
          layout === "masonry"
            ? "columns-1 gap-5 sm:columns-2 md:columns-3"
            : "grid grid-cols-2 gap-3"
        }
      >
        {photos.map((photo, i) => (
          <li
            key={photo.id}
            className={
              layout === "masonry" ? "mb-5 break-inside-avoid" : undefined
            }
          >
            <button
              type="button"
              onClick={() => setIndex(i)}
              className="group block w-full overflow-hidden rounded-2xl text-left touch-manipulation"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.src}
                alt={photo.alt}
                className={
                  layout === "masonry"
                    ? "w-full object-cover transition group-active:opacity-90"
                    : "aspect-square w-full object-cover transition group-active:opacity-90"
                }
              />
            </button>
            {showAttribution && photo.contributorId && photo.contributorName ? (
              <div className="mt-3">
                <PersonBubble
                  id={photo.contributorId}
                  name={photo.contributorName}
                  avatarUrl={photo.avatarUrl}
                  size="sm"
                  layout="row"
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {open && index != null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={open.alt}
          className="fixed inset-0 z-50 flex flex-col bg-[rgba(28,24,22,0.92)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          onClick={() => setIndex(null)}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <button
              type="button"
              onClick={() => setIndex(null)}
              className="min-h-11 rounded-full px-4 text-sm text-[var(--ground)]/80 touch-manipulation"
            >
              Close
            </button>
            <p className="text-sm text-[var(--ground)]/50">
              {index + 1} / {photos.length}
            </p>
            <span className="w-16" />
          </div>

          <div
            className="relative flex min-h-0 flex-1 items-center justify-center px-3"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={open.src}
              alt={open.alt}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          <div
            className="space-y-3 px-5 py-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            {(open.caption || open.contributorName) && (
              <div>
                {open.caption ? (
                  <p className="font-[family-name:var(--font-display)] text-lg text-[var(--ground)]">
                    {open.caption}
                  </p>
                ) : null}
                {open.contributorName ? (
                  <p className="mt-1 text-sm text-[var(--ground)]/55">
                    From {open.contributorName}
                  </p>
                ) : null}
              </div>
            )}

            {photos.length > 1 && (
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => setIndex((i) => Math.max(0, (i ?? 0) - 1))}
                  className="min-h-11 rounded-full border border-[var(--ground)]/20 px-5 text-sm text-[var(--ground)] touch-manipulation disabled:opacity-30"
                >
                  Before
                </button>
                <button
                  type="button"
                  disabled={index >= photos.length - 1}
                  onClick={() =>
                    setIndex((i) =>
                      Math.min(photos.length - 1, (i ?? 0) + 1),
                    )
                  }
                  className="min-h-11 rounded-full border border-[var(--ground)]/20 px-5 text-sm text-[var(--ground)] touch-manipulation disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
