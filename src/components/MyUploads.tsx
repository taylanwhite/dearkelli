"use client";

import { useCallback, useEffect, useState } from "react";

export type UploadItem = {
  id: string;
  kind: "video" | "audio" | "image";
  status: string;
  previewUrl: string;
  originalFilename: string | null;
  title: string | null;
  caption: string | null;
  tags: string[];
  isAvatar: boolean;
};

type Props = {
  token: string;
  refreshKey?: number;
  onAvatarCleared?: () => void;
};

function labelFor(item: UploadItem) {
  if (item.kind === "image") return item.isAvatar ? "Your photo" : "Photo";
  if (item.kind === "video") return "Video";
  return "Voice memo";
}

function TagEditor({
  token,
  item,
  onChange,
}: {
  token: string;
  item: UploadItem;
  onChange: (tags: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: string[]) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/contributor/${token}/media/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: next }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Couldn't save those words");
      }
      const data = (await res.json()) as { tags: string[] };
      onChange(data.tags);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save those words");
    } finally {
      setSaving(false);
    }
  }

  function addTag(e: React.FormEvent) {
    e.preventDefault();
    const parts = draft
      .toLowerCase()
      .split(/[,\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...item.tags];
    for (const part of parts) {
      if (!next.includes(part)) next.push(part);
    }
    setDraft("");
    void save(next.slice(0, 24));
  }

  function removeTag(tag: string) {
    void save(item.tags.filter((t) => t !== tag));
  }

  return (
    <div className="space-y-2 border-t border-[var(--cream)]/10 px-3 py-3">
      <p className="text-xs text-[var(--cream)]/45">
        Words for her cloud
        {item.status !== "ready" ? " (more may appear after we listen)" : ""}
      </p>
      {item.tags.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <li key={tag}>
              <button
                type="button"
                onClick={() => removeTag(tag)}
                disabled={saving}
                className="rounded-full bg-[var(--forest)]/15 px-2.5 py-1 text-xs text-[var(--cream)]/80 disabled:opacity-50"
                title="Remove"
              >
                {tag} ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-[var(--cream)]/35">
          No words yet. Add a few she should see.
        </p>
      )}
      <form onSubmit={addTag} className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="love, home, laughter…"
          className="min-w-0 flex-1 rounded-lg border border-[var(--cream)]/15 bg-[var(--ground)]/40 px-3 py-2 text-sm text-[var(--cream)] outline-none ring-[var(--gold)]/40 placeholder:text-[var(--cream)]/30 focus:ring-1"
        />
        <button
          type="submit"
          disabled={saving || !draft.trim()}
          className="shrink-0 rounded-lg bg-[var(--gold)]/90 px-3 py-2 text-sm text-[var(--ground)] disabled:opacity-50"
        >
          Add
        </button>
      </form>
      {error && <p className="text-xs text-[var(--blush)]">{error}</p>}
    </div>
  );
}

export function MyUploads({ token, refreshKey = 0, onAvatarCleared }: Props) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/contributor/${token}/media`);
      if (!res.ok) {
        throw new Error("Couldn't load what you've sent");
      }
      const data = (await res.json()) as { media: UploadItem[] };
      setItems(
        data.media.map((row) => ({
          ...row,
          tags: row.tags || [],
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load that");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load, refreshKey]);

  async function remove(item: UploadItem) {
    if (removingId) return;
    setRemovingId(item.id);
    setError(null);
    try {
      const res = await fetch(`/api/contributor/${token}/media/${item.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Couldn't remove that");
      }
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      if (item.isAvatar) onAvatarCleared?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that");
    } finally {
      setRemovingId(null);
    }
  }

  if (loading && items.length === 0) {
    return (
      <p className="text-center text-sm text-[var(--cream)]/40">
        Looking at what you&apos;ve already sent…
      </p>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="text-center">
        <p className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
          What you&apos;ve sent
        </p>
        <p className="mt-1 text-sm text-[var(--cream)]/45">
          Add words she should see, or remove something that doesn&apos;t belong.
        </p>
      </div>

      {error && (
        <p className="text-center text-sm text-[var(--blush)]">{error}</p>
      )}

      <ul className="space-y-4">
        {items.map((item) => (
          <li
            key={item.id}
            className="overflow-hidden rounded-2xl bg-[var(--surface)]"
          >
            <div className="flex gap-3 p-3">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[var(--forest)]/20">
                {item.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.previewUrl}
                    alt={item.title || item.originalFilename || "Photo"}
                    className="h-full w-full object-cover"
                  />
                ) : item.kind === "video" ? (
                  <video
                    src={item.previewUrl}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-2 text-center">
                    <span className="font-[family-name:var(--font-display)] text-sm text-[var(--gold)]">
                      Voice
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[var(--cream)]/85">
                      {item.title || item.originalFilename || labelFor(item)}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--cream)]/40">
                      {labelFor(item)}
                      {item.status !== "ready" ? ` · ${item.status}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void remove(item)}
                    disabled={removingId === item.id}
                    className="shrink-0 text-xs text-[var(--cream)]/45 underline-offset-2 hover:text-[var(--blush)] hover:underline disabled:opacity-50"
                  >
                    {removingId === item.id ? "Removing…" : "Remove"}
                  </button>
                </div>
              </div>
            </div>
            <TagEditor
              token={token}
              item={item}
              onChange={(tags) =>
                setItems((prev) =>
                  prev.map((row) =>
                    row.id === item.id ? { ...row, tags } : row,
                  ),
                )
              }
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
