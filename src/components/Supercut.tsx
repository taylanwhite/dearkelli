"use client";

import { useEffect, useRef, useState } from "react";

export type SupercutClip = {
  id: string;
  blobUrl: string;
  kind: "video" | "audio" | "image";
  posterUrl: string | null;
  startMs: number;
  endMs: number;
  contributorName: string;
  relationship: string | null;
  title: string | null;
};

type Props = {
  clips: SupercutClip[];
  label: string;
};

export function Supercut({ clips, label }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [keepGoing, setKeepGoing] = useState(true);

  const current = clips[index];

  useEffect(() => {
    setIndex(0);
  }, [label]);

  useEffect(() => {
    if (!current || current.kind === "image") return;

    const el =
      current.kind === "video" ? videoRef.current : audioRef.current;
    if (!el) return;

    const start = Math.max(0, current.startMs / 1000 - 0.05);
    const end = current.endMs / 1000 + 0.35;

    const onMeta = () => {
      el.currentTime = start;
      if (playing) {
        void el.play().catch(() => setPlaying(false));
      }
    };

    if (el.readyState >= 1) onMeta();
    else el.addEventListener("loadedmetadata", onMeta, { once: true });

    const onTime = () => {
      if (el.currentTime >= end) {
        el.pause();
        if (keepGoing && index < clips.length - 1) {
          setIndex((i) => i + 1);
        } else {
          setPlaying(false);
        }
      }
    };

    el.addEventListener("timeupdate", onTime);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.pause();
    };
  }, [current, index, clips.length, playing, keepGoing]);

  useEffect(() => {
    return () => {
      videoRef.current?.pause();
      audioRef.current?.pause();
    };
  }, []);

  if (!current) {
    return (
      <p className="px-5 text-center font-[family-name:var(--font-display)] text-xl text-[var(--cream)]/55">
        No one has said this yet.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pb-16">
      <div className="overflow-hidden rounded-2xl bg-[var(--surface)]">
        {current.kind === "video" && (
          <video
            key={current.id}
            ref={videoRef}
            src={current.blobUrl}
            poster={current.posterUrl ?? undefined}
            playsInline
            className="aspect-video w-full bg-[var(--forest-deep)] object-contain"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        )}
        {current.kind === "audio" && (
          <div className="flex aspect-video flex-col items-center justify-center gap-6 bg-[radial-gradient(circle_at_center,_rgba(201,162,39,0.28),_transparent_60%),linear-gradient(180deg,_#fff6e4,_#fffdf8)] px-6">
            <p className="font-[family-name:var(--font-display)] text-3xl text-[var(--gold-deep)]">
              {label}
            </p>
            <audio
              key={current.id}
              ref={audioRef}
              src={current.blobUrl}
              controls
              className="w-full max-w-md"
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
            />
          </div>
        )}
        {current.kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.posterUrl || current.blobUrl}
            alt={current.title || `From ${current.contributorName}`}
            className="aspect-video w-full object-contain"
          />
        )}
      </div>

      <div className="mt-6 text-center">
        <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--forest-deep)]">
          {current.contributorName}
        </p>
        {current.relationship && (
          <p className="mt-1 text-[var(--gold-deep)]">{current.relationship}</p>
        )}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            setPlaying(true);
            const el =
              current.kind === "video" ? videoRef.current : audioRef.current;
            if (el) {
              el.currentTime = Math.max(0, current.startMs / 1000 - 0.05);
              void el.play();
            }
          }}
          className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-medium text-white"
        >
          Hear that again
        </button>
        <button
          type="button"
          disabled={index === 0}
          onClick={() => {
            setPlaying(true);
            setIndex((i) => Math.max(0, i - 1));
          }}
          className="rounded-full border border-[var(--forest)]/15 px-5 py-2.5 text-sm text-[var(--forest)] disabled:opacity-30"
        >
          Before
        </button>
        <button
          type="button"
          disabled={index >= clips.length - 1}
          onClick={() => {
            setPlaying(true);
            setIndex((i) => Math.min(clips.length - 1, i + 1));
          }}
          className="rounded-full border border-[var(--forest)]/15 px-5 py-2.5 text-sm text-[var(--forest)] disabled:opacity-30"
        >
          Next voice
        </button>
      </div>

      <label className="mt-5 flex items-center justify-center gap-2 text-sm text-[var(--cream)]/45">
        <input
          type="checkbox"
          checked={keepGoing}
          onChange={(e) => setKeepGoing(e.target.checked)}
          className="accent-[var(--gold)]"
        />
        Keep going through everyone
      </label>

      {clips.length > 1 && (
        <ul className="mt-12 flex flex-wrap justify-center gap-x-5 gap-y-2">
          {clips.map((clip, i) => (
            <li key={clip.id}>
              <button
                type="button"
                onClick={() => {
                  setIndex(i);
                  setPlaying(true);
                }}
                className={`font-[family-name:var(--font-display)] text-lg transition ${
                  i === index
                    ? "text-[var(--gold-deep)] underline decoration-[var(--gold)] underline-offset-4"
                    : "text-[var(--forest)]/50 hover:text-[var(--forest)]"
                }`}
              >
                {clip.contributorName}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
