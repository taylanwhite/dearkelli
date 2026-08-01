"use client";

import { recordMediaView } from "@/lib/record-view";

type Props = {
  id: string;
  kind: "video" | "audio";
  src: string;
  poster?: string;
  title?: string | null;
  summary?: string | null;
};

export function TrackedAvPlayer({
  id,
  kind,
  src,
  poster,
  title,
  summary,
}: Props) {
  return (
    <article>
      {kind === "video" ? (
        <video
          src={src}
          poster={poster}
          controls
          playsInline
          className="aspect-video w-full rounded-2xl bg-[var(--forest-deep)] object-contain"
          onPlay={() => recordMediaView(id)}
        />
      ) : (
        <div className="rounded-2xl bg-[var(--surface)] px-5 py-8">
          <audio
            src={src}
            controls
            className="w-full"
            onPlay={() => recordMediaView(id)}
          />
        </div>
      )}
      {(title || summary) && (
        <p className="mt-4 font-[family-name:var(--font-display)] text-lg leading-snug text-[var(--forest-deep)]">
          {summary || title}
        </p>
      )}
    </article>
  );
}
