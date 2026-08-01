"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EnlargeableImage } from "@/components/EnlargeableImage";

export type AdminMediaItem = {
  id: string;
  kind: "video" | "audio" | "image";
  status: "uploaded" | "processing" | "ready" | "failed";
  title: string | null;
  summary: string | null;
  blobUrl: string;
  posterUrl: string | null;
  originalFilename: string | null;
  durationSeconds: number | null;
  themes: string[] | null;
  tags: string[] | null;
  caption: string | null;
  isTest: boolean;
  createdAt: string | Date;
  contributorId: string;
  contributorName: string;
};

type Props = { initialMedia: AdminMediaItem[] };

const FILTERS = ["all", "uploaded", "processing", "ready", "failed"] as const;

export function MediaAdmin({ initialMedia }: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialMedia);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = useMemo(
    () =>
      filter === "all" ? items : items.filter((item) => item.status === filter),
    [filter, items],
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
          item.id === id ? { ...item, status: "uploaded" } : item,
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
        {FILTERS.map((f) => (
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
            {f}
            {f !== "all"
              ? ` (${items.filter((i) => i.status === f).length})`
              : ` (${items.length})`}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-[var(--cream)]/45">Nothing in this view.</p>
      ) : (
        <ul className="space-y-4">
          {visible.map((item) => {
            const tags = item.tags || [];
            const themes = item.themes || [];
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
                  <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[var(--forest)]/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-[var(--cream)]/50">
                    {item.kind}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                      item.status === "ready"
                        ? "bg-[var(--gold)]/20 text-[var(--gold)]"
                        : item.status === "failed"
                          ? "bg-[var(--forest)]/20 text-[var(--forest)]"
                          : "bg-[var(--forest)]/10 text-[var(--cream)]/60"
                    }`}
                  >
                    {item.status}
                  </span>
                  {item.isTest && (
                    <span className="rounded-full bg-[var(--gold)]/20 px-2 py-0.5 text-[11px] uppercase tracking-wide text-[var(--gold)]">
                      test
                    </span>
                  )}
                </div>

                <p className="mt-3 text-[var(--cream)]">
                  {item.title || item.originalFilename || "Untitled"}
                </p>
                <p className="text-sm text-[var(--cream)]/45">
                  {item.contributorName}
                  {item.durationSeconds ? ` · ${item.durationSeconds}s` : ""}
                </p>

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

                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--forest)]/10 pt-4">
                  <a
                    href={`/api/media/stream?url=${encodeURIComponent(item.blobUrl)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-9 items-center rounded-full border border-[var(--forest)]/15 px-4 text-sm text-[var(--cream)]/75"
                  >
                    Open file
                  </a>
                  {(item.status === "failed" || item.status === "ready") && (
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
