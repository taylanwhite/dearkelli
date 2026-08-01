"use client";

import { useEffect } from "react";
import { recordMediaView } from "@/lib/record-view";

export type LightboxPhoto = {
  id: string;
  src: string;
  alt: string;
  caption?: string | null;
  contributorName?: string | null;
  contributorId?: string;
  avatarUrl?: string | null;
  footerHref?: string | null;
  footerLabel?: string | null;
};

type Props = {
  photos: LightboxPhoto[];
  index: number | null;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
};

export function LightboxOverlay({
  photos,
  index,
  onClose,
  onChangeIndex,
}: Props) {
  const open = index != null ? photos[index] : null;
  const openId = open?.id;

  useEffect(() => {
    if (openId) recordMediaView(openId);
  }, [openId]);

  useEffect(() => {
    if (index == null) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") {
        onChangeIndex(Math.min(photos.length - 1, index + 1));
      }
      if (e.key === "ArrowLeft") {
        onChangeIndex(Math.max(0, index - 1));
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [index, photos.length, onClose, onChangeIndex]);

  if (!open || index == null) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={open.alt}
      className="fixed inset-0 z-[80] flex flex-col bg-[rgba(28,24,22,0.94)] pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 rounded-full px-4 text-sm text-white/80 touch-manipulation"
        >
          Close
        </button>
        {photos.length > 1 ? (
          <p className="text-sm text-white/50">
            {index + 1} / {photos.length}
          </p>
        ) : (
          <span />
        )}
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
              <p className="font-[family-name:var(--font-display)] text-lg text-white">
                {open.caption}
              </p>
            ) : null}
            {open.contributorName ? (
              <p className="mt-1 text-sm text-white/55">
                From {open.contributorName}
              </p>
            ) : null}
          </div>
        )}

        {open.footerHref && open.footerLabel ? (
          <a
            href={open.footerHref}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-white/15 px-5 text-sm text-white"
          >
            {open.footerLabel}
          </a>
        ) : null}

        {photos.length > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onChangeIndex(Math.max(0, index - 1))}
              className="min-h-11 rounded-full border border-white/20 px-5 text-sm text-white touch-manipulation disabled:opacity-30"
            >
              Before
            </button>
            <button
              type="button"
              disabled={index >= photos.length - 1}
              onClick={() =>
                onChangeIndex(Math.min(photos.length - 1, index + 1))
              }
              className="min-h-11 rounded-full border border-white/20 px-5 text-sm text-white touch-manipulation disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
