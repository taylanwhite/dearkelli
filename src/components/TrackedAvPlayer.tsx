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
  summary,
}: Props) {
  return (
    <article>
      {kind === "video" ? (
        <video
          src={src}
          poster={poster}
          controls
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          disableRemotePlayback
          playsInline
          className="aspect-video w-full rounded-2xl bg-[var(--forest-deep)] object-contain"
          preload="none"
          onPlay={() => recordMediaView(id)}
        />
      ) : (
        <div className="rounded-2xl bg-[var(--surface)] px-4 py-5">
          <audio
            src={src}
            controls
            controlsList="nodownload noplaybackrate"
            preload="none"
            className="w-full"
            onPlay={() => recordMediaView(id)}
          />
        </div>
      )}
      {(summary) && (
        <p className="mt-2 font-[family-name:var(--font-display)] text-base leading-snug text-[var(--forest-deep)]">
          {summary}
        </p>
      )}
    </article>
  );
}
