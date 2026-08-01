"use client";

import { useEffect, useState } from "react";
import type { TimedCaptionWord } from "@/db/schema";

type Props = {
  words: TimedCaptionWord[];
  /** Current media time in seconds. */
  currentTime: number;
  /** Soft highlight for a specific word (e.g. the cloud word that brought you here). */
  emphasize?: string | null;
  className?: string;
};

function activeIndex(words: TimedCaptionWord[], timeMs: number): number {
  if (!words.length) return -1;
  // Prefer the word whose window contains now.
  for (let i = 0; i < words.length; i++) {
    if (timeMs >= words[i].startMs && timeMs < words[i].endMs) return i;
  }
  // Between words / seeking: nearest upcoming, else last spoken.
  for (let i = 0; i < words.length; i++) {
    if (timeMs < words[i].startMs) return Math.max(0, i - 1);
  }
  return words.length - 1;
}

/**
 * Karaoke-style captions driven by Whisper timings saved on upload.
 * No live AI — just highlight the word that matches current playback time.
 */
export function SyncedCaptions({
  words,
  currentTime,
  emphasize,
  className = "",
}: Props) {
  const timeMs = Math.max(0, currentTime * 1000);
  const idx = activeIndex(words, timeMs);
  const emphasizeNorm = emphasize?.toLowerCase().trim() || null;

  if (!words.length) return null;

  return (
    <p
      className={`font-[family-name:var(--font-display)] text-lg leading-relaxed text-[var(--forest)]/55 sm:text-xl ${className}`}
      aria-live="polite"
    >
      {words.map((w, i) => {
        const isActive = i === idx;
        const isEmphasized =
          !!emphasizeNorm &&
          w.raw.toLowerCase().replace(/[^\p{L}\p{N}']+/gu, "") ===
            emphasizeNorm;
        return (
          <span key={`${w.startMs}-${i}`}>
            {i > 0 ? " " : ""}
            <span
              className={
                isActive
                  ? "text-[var(--ink)] transition-colors duration-150"
                  : isEmphasized
                    ? "text-[var(--rose-deep)]/80"
                    : undefined
              }
            >
              {w.raw}
            </span>
          </span>
        );
      })}
    </p>
  );
}

/** Hook helper: wire an audio/video element's timeupdate into state. */
export function useMediaCurrentTime(
  el: HTMLMediaElement | null,
  playingHint?: boolean,
): number {
  const [t, setT] = useState(0);

  useEffect(() => {
    if (!el) return;
    const onTime = () => setT(el.currentTime);
    const onSeek = () => setT(el.currentTime);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("seeked", onSeek);
    setT(el.currentTime);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("seeked", onSeek);
    };
  }, [el, playingHint]);

  return t;
}
