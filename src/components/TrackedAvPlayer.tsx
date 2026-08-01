"use client";

import { useRef, useState } from "react";
import type { TimedCaptionWord } from "@/db/schema";
import {
  SyncedCaptions,
  useMediaCurrentTime,
} from "@/components/SyncedCaptions";
import { recordMediaView } from "@/lib/record-view";

type Props = {
  id: string;
  kind: "video" | "audio";
  src: string;
  poster?: string;
  title?: string | null;
  summary?: string | null;
  timedWords?: TimedCaptionWord[] | null;
};

export function TrackedAvPlayer({
  id,
  kind,
  src,
  poster,
  summary,
  timedWords,
}: Props) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [el, setEl] = useState<HTMLMediaElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const currentTime = useMediaCurrentTime(el, playing);
  const captions = timedWords?.length ? timedWords : null;

  function attach(node: HTMLVideoElement | HTMLAudioElement | null) {
    mediaRef.current = node;
    setEl(node);
  }

  return (
    <article>
      {kind === "video" ? (
        <video
          ref={attach}
          src={src}
          poster={poster}
          controls
          controlsList="nodownload noplaybackrate"
          disablePictureInPicture
          disableRemotePlayback
          playsInline
          className="aspect-video w-full rounded-2xl bg-[var(--forest-deep)] object-contain"
          preload="none"
          onPlay={() => {
            setPlaying(true);
            recordMediaView(id);
          }}
          onPause={() => setPlaying(false)}
        />
      ) : (
        <div className="rounded-2xl bg-[var(--surface)] px-4 py-5">
          <audio
            ref={attach}
            src={src}
            controls
            controlsList="nodownload noplaybackrate"
            preload="none"
            className="w-full"
            onPlay={() => {
              setPlaying(true);
              recordMediaView(id);
            }}
            onPause={() => setPlaying(false)}
          />
        </div>
      )}
      {captions && (
        <SyncedCaptions
          words={captions}
          currentTime={currentTime}
          className="mt-3 px-1"
        />
      )}
      {summary && (
        <p className="mt-2 font-[family-name:var(--font-display)] text-base leading-snug text-[var(--forest-deep)]">
          {summary}
        </p>
      )}
    </article>
  );
}
