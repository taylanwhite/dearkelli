"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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
                ? "bg-[#E8B14C] text-[#151021]"
                : "border border-white/15 text-[#F6F0E8]/60"
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
        <p className="text-[#F6F0E8]/45">Nothing in this view.</p>
      ) : (
        <ul className="space-y-3">
          {visible.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-white/10 bg-[#231A33] px-4 py-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] uppercase tracking-wide text-[#F6F0E8]/50">
                      {item.kind}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] uppercase tracking-wide ${
                        item.status === "ready"
                          ? "bg-[#E8B14C]/20 text-[#E8B14C]"
                          : item.status === "failed"
                            ? "bg-[#E4899B]/20 text-[#E4899B]"
                            : "bg-white/10 text-[#F6F0E8]/60"
                      }`}
                    >
                      {item.status}
                    </span>
                    {item.isTest && (
                      <span className="rounded-full bg-[#E8B14C]/20 px-2 py-0.5 text-[11px] uppercase tracking-wide text-[#E8B14C]">
                        test
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[#F6F0E8]">
                    {item.title || item.originalFilename || "Untitled"}
                  </p>
                  <p className="text-sm text-[#F6F0E8]/45">
                    {item.contributorName}
                    {item.durationSeconds
                      ? ` · ${item.durationSeconds}s`
                      : ""}
                  </p>
                  {(item.summary || item.caption) && (
                    <p className="mt-2 line-clamp-2 text-sm text-[#F6F0E8]/40">
                      {item.summary || item.caption}
                    </p>
                  )}
                  <p className="mt-2 font-mono text-[11px] text-[#F6F0E8]/25">
                    {item.id}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <a
                    href={`/api/media/stream?url=${encodeURIComponent(item.blobUrl)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-[#F6F0E8]/75"
                  >
                    Open file
                  </a>
                  {(item.status === "failed" || item.status === "ready") && (
                    <button
                      type="button"
                      disabled={busyId === item.id}
                      onClick={() => requeue(item.id)}
                      className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-[#F6F0E8]/75"
                    >
                      Requeue process
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => remove(item.id)}
                    className="rounded-full border border-[#E4899B]/40 px-3 py-1.5 text-xs text-[#E4899B]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
