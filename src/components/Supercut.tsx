"use client";

import { useEffect, useRef, useState } from "react";
import { EnlargeableImage } from "@/components/EnlargeableImage";
import { PersonBubble } from "@/components/PersonBubble";
import { SyncedCaptions } from "@/components/SyncedCaptions";
import type { TimedCaptionWord } from "@/db/schema";
import { pauseOtherMedia } from "@/lib/sole-media";
import { recordMediaView } from "@/lib/record-view";

export type SupercutClip = {
  /** Unique occurrence id (word/phrase row) — for React keys, not view tracking. */
  id: string;
  /** The media attachment id — used for view counting. */
  mediaId: string;
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
  timedWords?: TimedCaptionWord[] | null;
};

type Props = {
  clips: SupercutClip[];
  label: string;
};

export function Supercut({ clips, label }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  /** When true, the next clip mount should autoplay (Next / keep-going). */
  const autoplayRef = useRef(false);
  const keepGoingRef = useRef(true);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [keepGoing, setKeepGoing] = useState(true);
  const [needsTap, setNeedsTap] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);

  keepGoingRef.current = keepGoing;
  const current = clips[index];

  useEffect(() => {
    if (current?.mediaId) recordMediaView(current.mediaId);
  }, [current?.mediaId]);

  useEffect(() => {
    setIndex(0);
    setPlaying(false);
    setNeedsTap(true);
    setCurrentTime(0);
    autoplayRef.current = false;
  }, [label]);

  // Bind listeners + optional autoplay when the clip changes.
  // Intentionally does NOT depend on `playing` — that caused a play/pause loop
  // (effect cleanup paused → onPause → setPlaying(false) → effect re-ran → play…).
  useEffect(() => {
    if (!current || current.kind === "image") return;

    const el =
      current.kind === "video" ? videoRef.current : audioRef.current;
    if (!el) return;

    const onTime = () => setCurrentTime(el.currentTime);
    const onEnded = () => {
      if (keepGoingRef.current && index < clips.length - 1) {
        autoplayRef.current = true;
        setNeedsTap(false);
        setIndex((i) => i + 1);
      } else {
        autoplayRef.current = false;
        setPlaying(false);
      }
    };

    el.addEventListener("timeupdate", onTime);
    el.addEventListener("ended", onEnded);

    el.currentTime = 0;
    setCurrentTime(0);

    if (autoplayRef.current) {
      autoplayRef.current = false;
      pauseOtherMedia(el);
      void el.play().catch(() => {
        setPlaying(false);
        setNeedsTap(true);
      });
    }

    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("ended", onEnded);
      el.pause();
    };
  }, [current, index, clips.length]);

  useEffect(() => {
    return () => {
      videoRef.current?.pause();
      audioRef.current?.pause();
    };
  }, []);

  function mediaEl() {
    return current?.kind === "video" ? videoRef.current : audioRef.current;
  }

  function startPlayback() {
    const el = mediaEl();
    if (!el || !current) return;
    setNeedsTap(false);
    el.currentTime = 0;
    setCurrentTime(0);
    pauseOtherMedia(el);
    void el.play().catch(() => {
      setPlaying(false);
      setNeedsTap(true);
    });
  }

  function goTo(next: number) {
    autoplayRef.current = true;
    setNeedsTap(false);
    setIndex(next);
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
              controlsList="nodownload noplaybackrate"
              disablePictureInPicture
              disableRemotePlayback
              preload="none"
              className="aspect-video w-full bg-[var(--sage-deep)] object-contain"
              onPlay={(e) => {
                pauseOtherMedia(e.currentTarget);
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
              controlsList="nodownload noplaybackrate"
              preload="none"
              className="w-full max-w-md"
              onPlay={(e) => {
                pauseOtherMedia(e.currentTarget);
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
          <EnlargeableImage
            src={current.posterUrl || current.blobUrl}
            alt={current.title || `From ${current.contributorName}`}
            className="aspect-video w-full bg-[var(--sage-deep)]"
            imgClassName="aspect-video w-full object-contain"
            caption={current.title}
            gallery={clips
              .filter((c) => c.kind === "image")
              .map((c) => ({
                id: c.id,
                src: c.posterUrl || c.blobUrl,
                alt: c.title || `From ${c.contributorName}`,
                caption: c.title,
                contributorName: c.contributorName,
              }))}
            galleryIndex={Math.max(
              0,
              clips
                .filter((c) => c.kind === "image")
                .findIndex((c) => c.id === current.id),
            )}
          />
        )}
      </div>

      {current.kind !== "image" &&
        current.timedWords &&
        current.timedWords.length > 0 && (
          <SyncedCaptions
            words={current.timedWords}
            currentTime={currentTime}
            emphasize={label}
            className="mt-5 text-center"
          />
        )}

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
          onClick={() => goTo(Math.max(0, index - 1))}
          className="min-h-11 rounded-full border border-[var(--line)] px-6 py-3 text-sm text-[var(--sage)] touch-manipulation disabled:opacity-30"
        >
          Before
        </button>
        <button
          type="button"
          disabled={index >= clips.length - 1}
          onClick={() => goTo(Math.min(clips.length - 1, index + 1))}
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
                onClick={() => goTo(i)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
