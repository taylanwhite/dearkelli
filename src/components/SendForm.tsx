"use client";

import { useState } from "react";
import { UploadZone } from "./UploadZone";

type Contributor = {
  id: string;
  name: string;
  relationship: string | null;
  inviteToken: string;
};

type Props = {
  contributor: Contributor;
  isGeneric: boolean;
};

export function SendForm({ contributor, isGeneric }: Props) {
  const [name, setName] = useState(
    isGeneric && contributor.name === "Someone who loves Kelli"
      ? ""
      : contributor.name,
  );
  const [relationship, setRelationship] = useState(
    contributor.relationship ?? "",
  );
  const [ready, setReady] = useState(!isGeneric);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Tell us your name so she knows who this is from.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/contributor/${contributor.inviteToken}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          relationship: relationship.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error || "Couldn't save that");
      }
      setReady(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg px-5 py-10 sm:py-16">
      <header className="mb-10 text-center">
        <p className="font-[family-name:var(--font-display)] text-3xl tracking-tight text-[var(--cream)] sm:text-4xl">
          For Kelli
        </p>
        <p className="mt-3 text-[var(--cream)]/65">
          A memory, a voice memo, a photo — whatever you want her to hear.
        </p>
      </header>

      {!ready ? (
        <form onSubmit={saveDetails} className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-sm text-[var(--cream)]/60">
              Your name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-xl border border-[var(--cream)]/15 bg-[var(--surface)] px-4 py-3 text-[var(--cream)] outline-none ring-[var(--gold)]/40 placeholder:text-[var(--cream)]/30 focus:ring-2"
              placeholder="Who you are to her"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm text-[var(--cream)]/60">
              How you know her{" "}
              <span className="text-[var(--cream)]/35">(optional)</span>
            </span>
            <input
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="w-full rounded-xl border border-[var(--cream)]/15 bg-[var(--surface)] px-4 py-3 text-[var(--cream)] outline-none ring-[var(--gold)]/40 placeholder:text-[var(--cream)]/30 focus:ring-2"
              placeholder="Sister, college roommate, neighbor…"
            />
          </label>
          {error && <p className="text-sm text-[var(--blush)]">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-medium text-[var(--ground)] transition hover:brightness-110 disabled:opacity-60"
          >
            {saving ? "One moment…" : "Continue"}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm text-[var(--cream)]/50">From</p>
              <p className="font-[family-name:var(--font-display)] text-xl text-[var(--cream)]">
                {name || contributor.name}
              </p>
              {(relationship || contributor.relationship) && (
                <p className="text-sm text-[var(--blush)]/90">
                  {relationship || contributor.relationship}
                </p>
              )}
            </div>
            {isGeneric && (
              <button
                type="button"
                onClick={() => setReady(false)}
                className="text-sm text-[var(--cream)]/45 underline-offset-2 hover:text-[var(--cream)]/70 hover:underline"
              >
                Edit
              </button>
            )}
          </div>

          {!isGeneric && (
            <label className="block">
              <span className="mb-2 block text-sm text-[var(--cream)]/60">
                How you know her{" "}
                <span className="text-[var(--cream)]/35">(optional)</span>
              </span>
              <input
                value={relationship}
                onChange={async (e) => {
                  const value = e.target.value;
                  setRelationship(value);
                  await fetch(`/api/contributor/${contributor.inviteToken}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      relationship: value.trim() || null,
                    }),
                  });
                }}
                className="w-full rounded-xl border border-[var(--cream)]/15 bg-[var(--surface)] px-4 py-3 text-[var(--cream)] outline-none ring-[var(--gold)]/40 placeholder:text-[var(--cream)]/30 focus:ring-2"
                placeholder="Sister, college roommate, neighbor…"
              />
            </label>
          )}

          <UploadZone token={contributor.inviteToken} />
        </div>
      )}
    </div>
  );
}
