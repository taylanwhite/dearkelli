"use client";

import { useEffect, useRef, useState } from "react";
import { PersonBubble } from "@/components/PersonBubble";

export type SupercutClip = {
  id: string;
  blobUrl: string;
  kind: "video" | "audio" | "image";
  posterUrl: string | null;
  startMs: number;
  endMs: number;
  contributorId: string;
  contributorName: string;
  relationship: string | null;
  avatarUrl: string | null;
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
  const [playing, setPlaying] = useState(false);
  const [keepGoing, setKeepGoing] = useState(true);
  const [needsTap, setNeedsTap] = useState(true);

  const current = clips[index];

  useEffect(() => {
    setIndex(0);
    setPlaying(false);
    setNeedsTap(true);
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
        void el.play().catch(() => {
          setPlaying(false);
          setNeedsTap(true);
        });
      }
    };

    if (el.readyState >= 1) onMeta();
    else el.addEventListener("loadedmetadata", onMeta, { once: true });

    const onTime = () => {
      if (el.currentTime >= end) {
        el.pause();
        if (keepGoing && index < clips.length - 1) {
          setIndex((i) => i + 1);
          setPlaying(true);
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

  function startPlayback() {
    setNeedsTap(false);
    setPlaying(true);
    const el =
      current?.kind === "video" ? videoRef.current : audioRef.current;
    if (!el || !current) return;
    el.currentTime = Math.max(0, current.startMs / 1000 - 0.05);
    void el.play().catch(() => {
      setPlaying(false);
      setNeedsTap(true);
    });
  }

  if (!current) {
    return (
      <p className="px-5 text-center font-[family-name:var(--font-display)] text-xl text-[var(--muted)]">
        No one has said this yet.
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pb-[max(4rem,env(safe-area-inset-bottom))]">
      <div className="relative overflow-hidden rounded-2xl bg-[var(--surface)]">
        {current.kind === "video" && (
          <>
            <video
              key={current.id}
              ref={videoRef}
              src={current.blobUrl}
              poster={current.posterUrl ?? undefined}
              playsInline
              controls
              controlsList="nodownload"
              className="aspect-video w-full bg-[var(--sage-deep)] object-contain"
              onPlay={() => {
                setPlaying(true);
                setNeedsTap(false);
              }}
              onPause={() => setPlaying(false)}
            />
            {needsTap && !playing && (
              <button
                type="button"
                onClick={startPlayback}
                className="absolute inset-0 flex items-center justify-center bg-[rgba(58,53,50,0.28)] touch-manipulation"
              >
                <span className="rounded-full bg-[var(--ink)] px-7 py-3.5 font-[family-name:var(--font-display)] text-lg text-[var(--ground)] shadow-lg">
                  Tap to hear
                </span>
              </button>
            )}
          </>
        )}
        {current.kind === "audio" && (
          <div className="relative flex aspect-video flex-col items-center justify-center gap-6 bg-[radial-gradient(circle_at_center,_rgba(176,137,122,0.22),_transparent_60%),linear-gradient(180deg,_#efeceb,_#f7f5f3)] px-6">
            <p className="font-[family-name:var(--font-display)] text-3xl text-[var(--rose-deep)]">
              {label}
            </p>
            <audio
              key={current.id}
              ref={audioRef}
              src={current.blobUrl}
              controls
              className="w-full max-w-md"
              onPlay={() => {
                setPlaying(true);
                setNeedsTap(false);
              }}
              onPause={() => setPlaying(false)}
            />
            {needsTap && !playing && (
              <button
                type="button"
                onClick={startPlayback}
                className="rounded-full bg-[var(--ink)] px-7 py-3.5 font-[family-name:var(--font-display)] text-lg text-[var(--ground)] touch-manipulation"
              >
                Tap to hear
              </button>
            )}
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

      <div className="mt-8 flex justify-center">
        <PersonBubble
          id={current.contributorId}
          name={current.contributorName}
          relationship={current.relationship}
          avatarUrl={current.avatarUrl}
          size="lg"
          showRelationship
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={startPlayback}
          className="min-h-11 rounded-full bg-[var(--rose)] px-6 py-3 text-sm font-medium text-white touch-manipulation"
        >
          Hear that again
        </button>
        <button
          type="button"
          disabled={index === 0}
          onClick={() => {
            setPlaying(true);
            setNeedsTap(false);
            setIndex((i) => Math.max(0, i - 1));
          }}
          className="min-h-11 rounded-full border border-[var(--line)] px-6 py-3 text-sm text-[var(--sage)] touch-manipulation disabled:opacity-30"
        >
          Before
        </button>
        <button
          type="button"
          disabled={index >= clips.length - 1}
          onClick={() => {
            setPlaying(true);
            setNeedsTap(false);
            setIndex((i) => Math.min(clips.length - 1, i + 1));
          }}
          className="min-h-11 rounded-full border border-[var(--line)] px-6 py-3 text-sm text-[var(--sage)] touch-manipulation disabled:opacity-30"
        >
          Next voice
        </button>
      </div>

      <label className="mt-6 flex min-h-11 items-center justify-center gap-3 px-2 text-sm text-[var(--muted)] touch-manipulation">
        <input
          type="checkbox"
          checked={keepGoing}
          onChange={(e) => setKeepGoing(e.target.checked)}
          className="h-5 w-5 accent-[var(--rose)]"
        />
        Keep going through everyone
      </label>

      {clips.length > 1 && (
        <ul className="mt-12 flex flex-wrap justify-center gap-4">
          {clips.map((clip, i) => (
            <li key={clip.id}>
              <PersonBubble
                name={clip.contributorName}
                avatarUrl={clip.avatarUrl}
                size="sm"
                selected={i === index}
                onClick={() => {
                  setIndex(i);
                  setPlaying(true);
                  setNeedsTap(false);
                }}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
