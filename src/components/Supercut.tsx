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
  const [autoAdvance, setAutoAdvance] = useState(true);

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
        if (autoAdvance && index < clips.length - 1) {
          setIndex((i) => i + 1);
        } else {
          setPlaying(false);
        }
      }
    };

    el.addEventListener("timeupdate", onTime);
    return () => {
      el.removeEventListener("timeupdate", onTime);
    };
  }, [current, index, clips.length, playing, autoAdvance]);

  if (!current) {
    return (
      <p className="text-center text-[var(--cream)]/60">
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
            className="aspect-video w-full bg-black object-contain"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        )}
        {current.kind === "audio" && (
          <div className="flex aspect-video flex-col items-center justify-center gap-6 bg-[radial-gradient(circle_at_center,_rgba(232,177,76,0.18),_transparent_60%)] px-6">
            <p className="font-[family-name:var(--font-display)] text-3xl text-[var(--gold)]">
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

      <div className="mt-5 flex items-start justify-between gap-4">
        <div>
          <p className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
            {current.contributorName}
          </p>
          {current.relationship && (
            <p className="text-sm text-[var(--blush)]/90">
              {current.relationship}
            </p>
          )}
          {current.title && (
            <p className="mt-1 text-sm text-[var(--cream)]/50">
              {current.title}
            </p>
          )}
        </div>
        <p className="shrink-0 text-sm text-[var(--cream)]/40">
          {index + 1} of {clips.length}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
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
          className="rounded-full bg-[var(--gold)] px-5 py-2.5 text-sm font-medium text-[var(--ground)]"
        >
          Replay this one
        </button>
        <button
          type="button"
          disabled={index === 0}
          onClick={() => {
            setPlaying(true);
            setIndex((i) => Math.max(0, i - 1));
          }}
          className="rounded-full border border-[var(--cream)]/15 px-5 py-2.5 text-sm text-[var(--cream)]/80 disabled:opacity-30"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={index >= clips.length - 1}
          onClick={() => {
            setPlaying(true);
            setIndex((i) => Math.min(clips.length - 1, i + 1));
          }}
          className="rounded-full border border-[var(--cream)]/15 px-5 py-2.5 text-sm text-[var(--cream)]/80 disabled:opacity-30"
        >
          Next
        </button>
        <label className="ml-auto flex items-center gap-2 text-sm text-[var(--cream)]/50">
          <input
            type="checkbox"
            checked={autoAdvance}
            onChange={(e) => setAutoAdvance(e.target.checked)}
            className="accent-[var(--gold)]"
          />
          Play through
        </label>
      </div>

      <ol className="mt-10 space-y-2">
        {clips.map((clip, i) => (
          <li key={clip.id}>
            <button
              type="button"
              onClick={() => {
                setIndex(i);
                setPlaying(true);
              }}
              className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition ${
                i === index
                  ? "bg-[var(--surface)] text-[var(--cream)]"
                  : "text-[var(--cream)]/55 hover:bg-[var(--surface)]/50 hover:text-[var(--cream)]/80"
              }`}
            >
              <span>{clip.contributorName}</span>
              <span className="text-xs text-[var(--cream)]/35">
                {(clip.startMs / 1000).toFixed(1)}s
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
