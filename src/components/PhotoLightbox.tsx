"use client";

import { useState } from "react";
import { PersonBubble } from "@/components/PersonBubble";
import {
  LightboxOverlay,
  type LightboxPhoto,
} from "@/components/LightboxOverlay";

export type { LightboxPhoto };

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
            {showAttribution &&
            photo.contributorId &&
            photo.contributorName ? (
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

      <LightboxOverlay
        photos={photos}
        index={index}
        onClose={() => setIndex(null)}
        onChangeIndex={setIndex}
      />
    </>
  );
}
