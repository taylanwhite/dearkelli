"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EnlargeableImage } from "@/components/EnlargeableImage";
import { playableUrl, playbackSrc } from "@/lib/blob";

export type AdminMediaItem = {
  id: string;
  kind: "video" | "audio" | "image";
  status: "uploaded" | "processing" | "ready" | "failed";
  title: string | null;
  summary: string | null;
  blobUrl: string;
  posterUrl: string | null;
  playbackUrl: string | null;
  originalFilename: string | null;
  durationSeconds: number | null;
  themes: string[] | null;
  tags: string[] | null;
  caption: string | null;
  isTest: boolean;
  createdAt: string | Date;
  viewCount: number;
  lastViewedAt: string | Date | null;
  processingError: string | null;
  contributorId: string;
  contributorName: string;
  contributorAvatarUrl: string | null;
};

type Props = { initialMedia: AdminMediaItem[] };

const FILTERS = [
  "all",
  "uploaded",
  "processing",
  "ready",
  "failed",
  "ai issue",
  "viewed",
  "unviewed",
] as const;

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatViews(count: number) {
  if (count === 1) return "1 view";
  return `${count} views`;
}

export function MediaAdmin({ initialMedia }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialMedia);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const visible = useMemo(() => {
    let list = items;
    if (filter === "viewed") {
      list = items.filter((item) => item.viewCount > 0);
    } else if (filter === "unviewed") {
      list = items.filter((item) => item.viewCount === 0);
    } else if (filter === "ai issue") {
      list = items.filter((item) => Boolean(item.processingError));
    } else if (filter !== "all") {
      list = items.filter((item) => item.status === filter);
    }

    if (filter === "viewed" || filter === "ai issue") {
      return [...list].sort(
        (a, b) =>
          b.viewCount - a.viewCount ||
          String(b.lastViewedAt ?? "").localeCompare(
            String(a.lastViewedAt ?? ""),
          ),
      );
    }
    return list;
  }, [filter, items]);

  const viewedCount = useMemo(
    () => items.filter((i) => i.viewCount > 0).length,
    [items],
  );
  const unviewedCount = useMemo(
    () => items.filter((i) => i.viewCount === 0).length,
    [items],
  );
  const aiIssueCount = useMemo(
    () => items.filter((i) => Boolean(i.processingError)).length,
    [items],
  );

  async function requeue(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/media/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requeue: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? { ...item, status: "uploaded", processingError: null }
            : item,
        ),
      );
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't requeue");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this upload permanently?")) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/media/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      setItems((prev) => prev.filter((item) => item.id !== id));
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't delete");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count =
            f === "all"
              ? items.length
              : f === "viewed"
                ? viewedCount
                : f === "unviewed"
                  ? unviewedCount
                  : f === "ai issue"
                    ? aiIssueCount
                    : items.filter((i) => i.status === f).length;
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1.5 text-xs capitalize ${
                filter === f
                  ? "bg-[var(--gold)] text-[var(--ground)]"
                  : "border border-[var(--forest)]/15 text-[var(--cream)]/60"
              }`}
            >
              {f} ({count})
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="text-[var(--cream)]/45">Nothing in this view.</p>
      ) : (
        <ul className="space-y-4">
          {visible.map((item) => {
            const tags = item.tags || [];
            const themes = item.themes || [];
            const avatarSrc = item.contributorAvatarUrl
              ? playableUrl(item.contributorAvatarUrl)
              : null;
            return (
              <li
                key={item.id}
                className="rounded-2xl border border-[var(--forest)]/10 bg-[var(--surface)] p-4"
              >
                <div className="flex gap-4">
                  {item.kind === "image" && (
                    <EnlargeableImage
                      src={`/api/media/stream?url=${encodeURIComponent(item.posterUrl || item.blobUrl)}`}
                      alt={item.title || item.originalFilename || "Photo"}
                      className="h-20 w-20 shrink-0"
                      imgClassName="h-20 w-20 object-cover"
                      rounded="rounded-xl"
                      caption={item.title || item.caption}
                      gallery={[
                        {
                          id: item.id,
                          src: `/api/media/stream?url=${encodeURIComponent(item.blobUrl)}`,
                          alt: item.title || item.originalFilename || "Photo",
                          caption: item.summary || item.caption || item.title,
                          contributorName: item.contributorName,
                        },
                      ]}
                    />
                  )}
                  {(item.kind === "video" || item.kind === "audio") && (
                    <button
                      type="button"
                      onClick={() =>
                        setPlayingId((id) => (id === item.id ? null : item.id))
                      }
                      className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--forest)]/15"
                      aria-label={
                        playingId === item.id ? "Hide player" : "Play"
                      }
                    >
                      {item.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/media/stream?url=${encodeURIComponent(item.posterUrl)}`}
                          alt=""
                          className="h-full w-full object-cover opacity-80"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs uppercase tracking-wide text-[var(--cream)]/50">
                          {item.kind}
                        </span>
                      )}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white">
                        {playingId === item.id ? "Hide" : "Play"}
                      </span>
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--forest)]/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-[var(--cream)]/50">
                    {item.kind}
                  </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                          item.status === "ready" && !item.processingError
                            ? "bg-[var(--gold)]/20 text-[var(--gold)]"
                            : item.processingError || item.status === "failed"
                              ? "bg-[var(--forest)]/20 text-[var(--forest)]"
                              : "bg-[var(--forest)]/10 text-[var(--cream)]/60"
                        }`}
                      >
                        {item.processingError ? "ready · ai issue" : item.status}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] tracking-wide ${
                          item.viewCount > 0
                            ? "bg-[var(--blush)]/15 text-[var(--blush)]"
                            : "bg-[var(--forest)]/8 text-[var(--cream)]/40"
                        }`}
                      >
                        {formatViews(item.viewCount)}
                      </span>
                      {item.kind === "video" && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                            item.playbackUrl
                              ? "bg-[var(--sage)]/25 text-[var(--cream)]/70"
                              : "bg-[var(--forest)]/20 text-[var(--forest)]"
                          }`}
                          title={
                            item.playbackUrl
                              ? "Playing the compressed web MP4"
                              : "No playback file — streaming the original upload. Requeue to encode."
                          }
                        >
                          {item.playbackUrl ? "web play" : "original only"}
                        </span>
                      )}
                      {item.isTest && (
                    <span className="rounded-full bg-[var(--gold)]/20 px-2 py-0.5 text-[11px] uppercase tracking-wide text-[var(--gold)]">
                      test
                    </span>
                  )}
                </div>

                    <p className="mt-3 text-[var(--cream)]">
                      {item.title || item.originalFilename || "Untitled"}
                    </p>

                    {item.processingError ? (
                      <div className="mt-3 rounded-xl border border-[var(--forest)]/25 bg-[var(--forest)]/10 px-3 py-2.5">
                        <p className="text-[11px] uppercase tracking-wide text-[var(--forest)]">
                          AI couldn&apos;t finish
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-[var(--cream)]/75">
                          {item.processingError}
                        </p>
                        <p className="mt-1.5 text-xs text-[var(--cream)]/45">
                          Still shown on their profile. Requeue to try AI again.
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/people/${item.contributorId}`}
                    className="group inline-flex items-center gap-2.5"
                    title={`Open ${item.contributorName}'s profile`}
                  >
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--sage)] font-[family-name:var(--font-display)] text-sm text-[var(--ground)] ring-2 ring-[var(--rose)]/30 transition group-hover:ring-[var(--rose)]/60">
                      {avatarSrc ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={avatarSrc}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        initials(item.contributorName)
                      )}
                    </span>
                    <span className="text-sm text-[var(--cream)]/70 transition group-hover:text-[var(--cream)]">
                      {item.contributorName}
                    </span>
                  </Link>
                  {item.durationSeconds ? (
                    <span className="text-sm text-[var(--cream)]/40">
                      {item.durationSeconds}s
                    </span>
                  ) : null}
                </div>
                {item.lastViewedAt ? (
                  <p className="mt-1 text-xs text-[var(--cream)]/35">
                    Last opened{" "}
                    {new Date(item.lastViewedAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                ) : null}

                {(item.summary || item.caption) && (
                  <p className="mt-2 text-sm leading-relaxed text-[var(--cream)]/55">
                    {item.summary || item.caption}
                  </p>
                )}

                {themes.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--cream)]/35">
                      Themes
                    </p>
                    <p className="mt-1 text-sm text-[var(--cream)]/60">
                      {themes.join(" · ")}
                    </p>
                  </div>
                )}

                {tags.length > 0 && (
                  <div className="mt-3">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--cream)]/35">
                      Word tags
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {tags.map((tag) => (
                        <li
                          key={tag}
                          className="rounded-full bg-[var(--forest)]/8 px-2.5 py-1 text-xs text-[var(--cream)]/70"
                        >
                          {tag}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="mt-3 font-mono text-[11px] text-[var(--cream)]/25">
                  {item.id}
                </p>

                {playingId === item.id &&
                  (item.kind === "video" || item.kind === "audio") && (
                    <div className="mt-3 overflow-hidden rounded-xl bg-black/40">
                      {item.kind === "video" ? (
                        <video
                          key={item.id}
                          src={playbackSrc({
                            playbackUrl: item.playbackUrl,
                            blobUrl: item.blobUrl,
                          })}
                          poster={
                            item.posterUrl
                              ? playableUrl(item.posterUrl)
                              : undefined
                          }
                          controls
                          playsInline
                          autoPlay
                          className="max-h-[70vh] w-full bg-black"
                        />
                      ) : (
                        <audio
                          key={item.id}
                          src={playableUrl(item.blobUrl)}
                          controls
                          autoPlay
                          className="w-full px-3 py-4"
                        />
                      )}
                    </div>
                  )}

                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--forest)]/10 pt-4">
                  {(item.kind === "video" || item.kind === "audio") && (
                    <button
                      type="button"
                      onClick={() =>
                        setPlayingId((id) =>
                          id === item.id ? null : item.id,
                        )
                      }
                      className="inline-flex min-h-9 items-center rounded-full border border-[var(--forest)]/15 px-4 text-sm text-[var(--cream)]/75"
                    >
                      {playingId === item.id ? "Hide player" : "Watch"}
                    </button>
                  )}
                  <a
                    href={
                      item.kind === "video"
                        ? playbackSrc({
                            playbackUrl: item.playbackUrl,
                            blobUrl: item.blobUrl,
                          })
                        : playableUrl(item.blobUrl)
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 items-center rounded-full border border-[var(--forest)]/15 px-4 text-sm text-[var(--cream)]/75"
                  >
                    Open file
                  </a>
                  {(item.status === "failed" ||
                    item.status === "ready" ||
                    item.status === "uploaded" ||
                    Boolean(item.processingError)) && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => requeue(item.id)}
                      className="inline-flex min-h-9 items-center rounded-full border border-[var(--forest)]/15 px-4 text-sm text-[var(--cream)]/75 disabled:opacity-50"
                    >
                      Requeue
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => remove(item.id)}
                    className="inline-flex min-h-9 items-center rounded-full border border-[var(--forest)]/35 px-4 text-sm text-[var(--forest)] disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
