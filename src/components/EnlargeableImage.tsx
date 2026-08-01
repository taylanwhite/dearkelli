"use client";

import { useState } from "react";
import {
  LightboxOverlay,
  type LightboxPhoto,
} from "@/components/LightboxOverlay";

type Props = {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  caption?: string | null;
  /** Extra photos for before/next when opening from a set */
  gallery?: LightboxPhoto[];
  galleryIndex?: number;
  rounded?: string;
};

export function EnlargeableImage({
  src,
  alt,
  className = "",
  imgClassName = "h-full w-full object-cover",
  caption,
  gallery,
  galleryIndex = 0,
  rounded = "rounded-2xl",
}: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const photos: LightboxPhoto[] =
    gallery && gallery.length > 0
      ? gallery
      : [{ id: src, src, alt, caption }];

  const startIndex =
    gallery && gallery.length > 0
      ? Math.min(galleryIndex, gallery.length - 1)
      : 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpenIndex(startIndex)}
        className={`group block overflow-hidden text-left touch-manipulation ${rounded} ${className}`}
        aria-label={`Enlarge ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={imgClassName} />
      </button>
      <LightboxOverlay
        photos={photos}
        index={openIndex}
        onClose={() => setOpenIndex(null)}
        onChangeIndex={setOpenIndex}
      />
    </>
  );
}
