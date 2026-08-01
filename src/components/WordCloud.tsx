"use client";

import cloud from "d3-cloud";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  trackOrphanAudio,
  untrackOrphanAudio,
} from "@/lib/media-playback";

export type CloudWord = {
  text: string;
  count: number;
  href: string;
};

type LayoutWord = CloudWord & {
  x: number;
  y: number;
  size: number;
  rotate: number;
  weight: number;
};

type Props = {
  words: CloudWord[];
};

function weightForCount(count: number, min: number, max: number) {
  if (max === min) return 600;
  const t = (count - min) / (max - min);
  return Math.round(300 + t * 600);
}

function sizeForCount(count: number, min: number, max: number, width: number) {
  const base = Math.min(width / 18, 56);
  const floor = Math.max(14, width / 48);
  if (max === min) return base;
  const t = Math.sqrt((count - min) / (max - min));
  return floor + t * (base - floor);
}

export function WordCloud({ words }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [size, setSize] = useState({ width: 800, height: 560 });
  const [laidOut, setLaidOut] = useState<LayoutWord[]>([]);
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const counts = useMemo(() => {
    const values = words.map((w) => w.count);
    return {
      min: Math.min(...values, 1),
      max: Math.max(...values, 1),
    };
  }, [words]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observe = () => {
      const rect = el.getBoundingClientRect();
      setSize({
        width: Math.max(320, Math.floor(rect.width)),
        height: Math.max(420, Math.floor(window.innerHeight * 0.72)),
      });
    };

    observe();
    const ro = new ResizeObserver(observe);
    ro.observe(el);
    window.addEventListener("resize", observe);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", observe);
    };
  }, []);

  useEffect(() => {
    if (words.length === 0) {
      setLaidOut([]);
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);

    const input = words.map((w) => ({
      ...w,
      size: sizeForCount(w.count, counts.min, counts.max, size.width),
      weight: weightForCount(w.count, counts.min, counts.max),
    }));

    type CloudInput = CloudWord & { size: number; weight: number };
    type CloudOutput = CloudInput & {
      x?: number;
      y?: number;
      rotate?: number;
    };

    cloud<CloudInput>()
      .size([size.width, size.height])
      .words(input)
      .padding(6)
      .rotate(() => 0)
      .font("Fraunces, Georgia, serif")
      .fontSize((d) => d.size)
      .fontWeight((d) => String(d.weight))
      .spiral("archimedean")
      .on("end", (output: CloudOutput[]) => {
        if (cancelled) return;
        const mapped = output
          .filter((d) => d.x != null && d.y != null)
          .map((d) => ({
            text: d.text,
            count: d.count,
            href: d.href,
            x: d.x!,
            y: d.y!,
            size: d.size,
            rotate: d.rotate ?? 0,
            weight: d.weight,
          }));
        setLaidOut(mapped);
        requestAnimationFrame(() => setReady(true));
      })
      .start();

    return () => {
      cancelled = true;
    };
  }, [words, size.width, size.height, counts.min, counts.max]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        untrackOrphanAudio(audioRef.current);
        audioRef.current.src = "";
        audioRef.current = null;
      }
    };
  }, []);

  async function playSnippet(word: string) {
    try {
      const res = await fetch(`/api/snippet?word=${encodeURIComponent(word)}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        blobUrl: string;
        startMs: number;
        endMs: number;
      };

      if (audioRef.current) {
        audioRef.current.pause();
        untrackOrphanAudio(audioRef.current);
        audioRef.current.src = "";
        audioRef.current = null;
      }

      const audio = new Audio(data.blobUrl);
      audioRef.current = audio;
      trackOrphanAudio(audio);
      const start = Math.max(0, data.startMs / 1000 - 0.05);
      const end = data.endMs / 1000 + 0.15;

      audio.currentTime = start;
      await audio.play();

      const stop = () => {
        if (audio.currentTime >= end) {
          audio.pause();
          untrackOrphanAudio(audio);
          audio.removeEventListener("timeupdate", stop);
        }
      };
      audio.addEventListener("timeupdate", stop);
    } catch {
      // Snippet playback is optional atmosphere; ignore failures.
    }
  }

  if (words.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 text-center">
        <p className="max-w-sm font-[family-name:var(--font-display)] text-2xl text-[var(--cream)]/70">
          Your people are still finding their words.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden">
      <svg
        width={size.width}
        height={size.height}
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="mx-auto block"
        role="img"
        aria-label="Words people have said about you"
      >
        <g transform={`translate(${size.width / 2}, ${size.height / 2})`}>
          {laidOut.map((word, index) => {
            const delay = reducedMotion ? 0 : (index % 24) * 0.04;
            const fromX = reducedMotion
              ? word.x
              : word.x + (word.x >= 0 ? 1 : -1) * (80 + (index % 5) * 24);
            const fromY = reducedMotion
              ? word.y
              : word.y + (word.y >= 0 ? 1 : -1) * (60 + (index % 7) * 18);

            return (
              <g key={word.text}>
                <Link
                  href={word.href}
                  onMouseEnter={() => {
                    setHovered(word.text);
                    void playSnippet(word.text);
                  }}
                  onMouseLeave={() => {
                    setHovered(null);
                    if (audioRef.current) {
                      audioRef.current.pause();
                      audioRef.current = null;
                    }
                  }}
                  onFocus={() => setHovered(word.text)}
                  onBlur={() => setHovered(null)}
                >
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={
                      hovered === word.text
                        ? "var(--gold-deep)"
                        : index % 4 === 0
                          ? "var(--gold)"
                          : index % 3 === 0
                            ? "var(--forest)"
                            : "var(--forest-deep)"
                    }
                    fontFamily="var(--font-display), Georgia, serif"
                    fontSize={word.size}
                    fontWeight={word.weight}
                    style={{
                      cursor: "pointer",
                      opacity: ready ? (hovered && hovered !== word.text ? 0.45 : 0.92) : 0,
                      transform: ready
                        ? `translate(${word.x}px, ${word.y}px) scale(${
                            hovered === word.text ? 1.08 : 1
                          })`
                        : `translate(${fromX}px, ${fromY}px) scale(0.92)`,
                      transition: reducedMotion
                        ? "opacity 0.6s ease"
                        : `transform 1.2s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s, opacity 0.8s ease ${delay}s, fill 0.2s ease`,
                    }}
                  >
                    {word.text}
                  </text>
                </Link>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
