"use client";

import cloud from "d3-cloud";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { playableUrl } from "@/lib/blob";

export type CloudWord = {
  type?: "word";
  text: string;
  count: number;
  href: string;
  kind?: "word" | "phrase";
};

export type CloudPerson = {
  type: "person";
  id: string;
  name: string;
  avatarUrl: string | null;
  href: string;
};

export type CloudItem = CloudWord | CloudPerson;

type LayoutItem = {
  key: string;
  type: "word" | "person";
  text: string;
  href: string;
  x: number;
  y: number;
  size: number;
  weight: number;
  avatarUrl?: string | null;
  name?: string;
};

type Props = {
  words: CloudWord[];
  people?: CloudPerson[];
};

const FACE_SIZE = 52;

function weightForCount(count: number, min: number, max: number) {
  if (max === min) return 600;
  const t = (count - min) / (max - min);
  return Math.round(300 + t * 600);
}

function sizeForCount(count: number, min: number, max: number, width: number) {
  const base = Math.min(width / 16, 52);
  const floor = Math.max(17, width / 36);
  if (max === min) return base;
  const t = Math.sqrt((count - min) / (max - min));
  return floor + t * (base - floor);
}

function wordFill(index: number, active: boolean) {
  if (active) return "var(--rose-deep)";
  if (index % 5 === 0) return "var(--rose)";
  if (index % 3 === 0) return "var(--sage)";
  return "var(--ink)";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function hitBox(item: LayoutItem) {
  if (item.type === "person") {
    const s = FACE_SIZE + 8;
    return { width: s, height: s };
  }
  const height = Math.max(44, item.size * 1.55);
  const width = Math.max(48, item.text.length * item.size * 0.58);
  return { width, height };
}

export function WordCloud({ words, people = [] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 360, height: 480 });
  const [laidOut, setLaidOut] = useState<LayoutItem[]>([]);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [orderSeed] = useState(() => Math.random());

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
        height: Math.max(400, Math.floor(window.innerHeight * 0.68)),
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
    if (words.length === 0 && people.length === 0) {
      setLaidOut([]);
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);

    type CloudInput = {
      key: string;
      type: "word" | "person";
      text: string;
      href: string;
      size: number;
      weight: number;
      avatarUrl?: string | null;
      name?: string;
      count?: number;
      kind?: "word" | "phrase";
    };

    const wordInputs: CloudInput[] = words.map((w) => ({
      key: `word:${w.text}`,
      type: "word" as const,
      text: w.text,
      href: w.href,
      count: w.count,
      kind: w.kind,
      size: sizeForCount(w.count, counts.min, counts.max, size.width),
      weight: weightForCount(w.count, counts.min, counts.max),
    }));

    // Same-size faces; short placeholder text so d3 reserves a round footprint.
    const faceInputs: CloudInput[] = people.map((p) => ({
      key: `person:${p.id}`,
      type: "person" as const,
      text: "@@@@@",
      href: p.href,
      name: p.name,
      avatarUrl: p.avatarUrl,
      size: FACE_SIZE * 0.72,
      weight: 600,
    }));

    // Deterministic-ish shuffle from seed so layout is stable within a visit,
    // but faces are mixed through the words rather than clustered.
    const rng = (() => {
      let s = Math.floor(orderSeed * 1e9) || 1;
      return () => {
        s = (s * 1664525 + 1013904223) % 4294967296;
        return s / 4294967296;
      };
    })();
    const mixed = [...wordInputs, ...faceInputs];
    for (let i = mixed.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [mixed[i], mixed[j]] = [mixed[j], mixed[i]];
    }

    type CloudOutput = CloudInput & {
      x?: number;
      y?: number;
      rotate?: number;
    };

    cloud<CloudInput>()
      .size([size.width, size.height])
      .words(mixed)
      .padding(12)
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
            key: d.key,
            type: d.type,
            text: d.type === "person" ? d.name || d.text : d.text,
            href: d.href,
            avatarUrl: d.avatarUrl,
            name: d.name,
            x: d.x!,
            y: d.y!,
            size: d.type === "person" ? FACE_SIZE : d.size,
            weight: d.weight,
          }));
        setLaidOut(mapped);
        requestAnimationFrame(() => setReady(true));
      })
      .start();

    return () => {
      cancelled = true;
    };
  }, [words, people, size.width, size.height, counts.min, counts.max, orderSeed]);

  if (words.length === 0 && people.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6 text-center">
        <p className="max-w-sm font-[family-name:var(--font-display)] text-2xl text-[var(--muted)]">
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
        className="mx-auto block touch-manipulation"
        role="img"
        aria-label="Words and people who love you"
      >
        <defs>
          {laidOut
            .filter((item) => item.type === "person")
            .map((person) => (
              <clipPath key={`clip-${person.key}`} id={`clip-${person.key}`}>
                <circle cx={0} cy={0} r={FACE_SIZE / 2} />
              </clipPath>
            ))}
        </defs>
        <g transform={`translate(${size.width / 2}, ${size.height / 2})`}>
          {laidOut.map((item, index) => {
            const delay = reducedMotion ? 0 : (index % 24) * 0.04;
            const fromX = reducedMotion
              ? item.x
              : item.x + (item.x >= 0 ? 1 : -1) * (80 + (index % 5) * 24);
            const fromY = reducedMotion
              ? item.y
              : item.y + (item.y >= 0 ? 1 : -1) * (60 + (index % 7) * 18);
            const isActive = active === item.key;
            const box = hitBox(item);
            const src = item.avatarUrl ? playableUrl(item.avatarUrl) : null;

            return (
              <g key={item.key}>
                {item.type === "person" ? (
                  <Link
                    href={item.href}
                    aria-label={`See ${item.name || item.text}`}
                    onMouseEnter={() => setActive(item.key)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(item.key)}
                    onBlur={() => setActive(null)}
                  >
                    <g
                      style={{
                        opacity: ready
                          ? active && !isActive
                            ? 0.35
                            : 0.92
                          : 0,
                        transform: ready
                          ? `translate(${item.x}px, ${item.y}px) scale(${
                              isActive ? 1.06 : 1
                            })`
                          : `translate(${fromX}px, ${fromY}px) scale(0.92)`,
                        transition: reducedMotion
                          ? "opacity 0.6s ease"
                          : `transform 1.2s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s, opacity 0.8s ease ${delay}s`,
                      }}
                    >
                      <rect
                        x={-box.width / 2}
                        y={-box.height / 2}
                        width={box.width}
                        height={box.height}
                        fill="transparent"
                      />
                      <g style={{ pointerEvents: "none" }}>
                        <circle
                          r={FACE_SIZE / 2 + 2}
                          fill="var(--surface)"
                          stroke="var(--rose)"
                          strokeOpacity={isActive ? 0.9 : 0.45}
                          strokeWidth={2}
                        />
                        {src ? (
                          <image
                            href={src}
                            x={-FACE_SIZE / 2}
                            y={-FACE_SIZE / 2}
                            width={FACE_SIZE}
                            height={FACE_SIZE}
                            clipPath={`url(#clip-${item.key})`}
                            preserveAspectRatio="xMidYMid slice"
                          />
                        ) : (
                          <>
                            <circle r={FACE_SIZE / 2} fill="var(--sage)" />
                            <text
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fill="var(--ground)"
                              fontFamily="var(--font-display), Georgia, serif"
                              fontSize={18}
                            >
                              {initials(item.name || item.text)}
                            </text>
                          </>
                        )}
                      </g>
                    </g>
                  </Link>
                ) : (
                  <Link
                    href={item.href}
                    onMouseEnter={() => setActive(item.key)}
                    onMouseLeave={() => setActive(null)}
                    onFocus={() => setActive(item.key)}
                    onBlur={() => setActive(null)}
                  >
                    <g
                      style={{
                        opacity: ready
                          ? active && !isActive
                            ? 0.35
                            : 0.92
                          : 0,
                        transform: ready
                          ? `translate(${item.x}px, ${item.y}px) scale(${
                              isActive ? 1.06 : 1
                            })`
                          : `translate(${fromX}px, ${fromY}px) scale(0.92)`,
                        transition: reducedMotion
                          ? "opacity 0.6s ease"
                          : `transform 1.2s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s, opacity 0.8s ease ${delay}s`,
                      }}
                    >
                      <rect
                        x={-box.width / 2}
                        y={-box.height / 2}
                        width={box.width}
                        height={box.height}
                        fill="transparent"
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={wordFill(index, isActive)}
                        fontFamily="var(--font-display), Georgia, serif"
                        fontSize={item.size}
                        fontWeight={item.weight}
                        style={{
                          cursor: "pointer",
                          transition: "fill 0.2s ease",
                          pointerEvents: "none",
                        }}
                      >
                        {item.text}
                      </text>
                    </g>
                  </Link>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
