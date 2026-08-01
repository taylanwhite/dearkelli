"use client";

import { useMemo, useState } from "react";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { TrackedAvPlayer } from "@/components/TrackedAvPlayer";

export type PersonMediaItem = {
  id: string;
  kind: "video" | "audio" | "image";
  src: string;
  poster?: string;
  title?: string | null;
  summary?: string | null;
  caption?: string | null;
  alt: string;
};

type Filter = "all" | "video" | "image" | "audio";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "video", label: "Video" },
  { id: "image", label: "Photos" },
  { id: "audio", label: "Audio" },
];

type Props = {
  personName: string;
  items: PersonMediaItem[];
};

export function PersonMedia({ personName, items }: Props) {
  const counts = useMemo(() => {
    const video = items.filter((i) => i.kind === "video").length;
    const image = items.filter((i) => i.kind === "image").length;
    const audio = items.filter((i) => i.kind === "audio").length;
    return { all: items.length, video, image, audio };
  }, [items]);

  const available = FILTERS.filter((f) => counts[f.id] > 0);
  const [filter, setFilter] = useState<Filter>("all");
  const active =
    available.some((f) => f.id === filter) ? filter : "all";

  const visible = useMemo(() => {
    if (active === "all") return items;
    return items.filter((item) => item.kind === active);
  }, [active, items]);

  const videos = visible.filter((i) => i.kind === "video");
  const audio = visible.filter((i) => i.kind === "audio");
  const photos = visible.filter((i) => i.kind === "image");

  if (items.length === 0) {
    return (
      <p className="mt-16 text-center font-[family-name:var(--font-display)] text-xl text-[var(--cream)]/50">
        Nothing from them yet.
      </p>
    );
  }

  return (
    <div className="mt-14">
      {available.length > 2 && (
        <div className="mb-10 flex flex-wrap justify-center gap-2">
          {available.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`min-h-10 rounded-full px-4 text-sm touch-manipulation transition ${
                active === f.id
                  ? "bg-[var(--ink)] text-[var(--ground)]"
                  : "border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-60">{counts[f.id]}</span>
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-center font-[family-name:var(--font-display)] text-lg text-[var(--muted)]">
          Nothing in this view.
        </p>
      ) : (
        <div className="space-y-14">
          {videos.length > 0 && (
            <section className="space-y-10">
              {active === "all" && (
                <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--forest-deep)]">
                  Video
                </h2>
              )}
              {videos.map((clip) => (
                <TrackedAvPlayer
                  key={clip.id}
                  id={clip.id}
                  kind="video"
                  src={clip.src}
                  poster={clip.poster}
                  title={clip.title}
                  summary={clip.summary}
                />
              ))}
            </section>
          )}

          {audio.length > 0 && (
            <section className="space-y-10">
              {active === "all" && (
                <h2 className="font-[family-name:var(--font-display)] text-lg text-[var(--forest-deep)]">
                  Audio
                </h2>
              )}
              {audio.map((clip) => (
                <TrackedAvPlayer
                  key={clip.id}
                  id={clip.id}
                  kind="audio"
                  src={clip.src}
                  title={clip.title}
                  summary={clip.summary}
                />
              ))}
            </section>
          )}

          {photos.length > 0 && (
            <section>
              {active === "all" && (
                <h2 className="mb-6 font-[family-name:var(--font-display)] text-lg text-[var(--forest-deep)]">
                  Photos
                </h2>
              )}
              <PhotoLightbox
                layout="grid"
                showAttribution={false}
                photos={photos.map((photo) => ({
                  id: photo.id,
                  src: photo.src,
                  alt: photo.alt,
                  caption: photo.caption || photo.title,
                  contributorName: personName,
                }))}
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
