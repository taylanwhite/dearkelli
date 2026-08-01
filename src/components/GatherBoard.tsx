"use client";

import { useMemo, useState } from "react";

type Person = {
  id: string;
  name: string;
  relationship: string | null;
  inviteToken: string;
  createdAt: string | Date;
  uploadCount: number;
};

type Props = {
  token: string;
  initialPeople: Person[];
};

function sendUrl(inviteToken: string) {
  if (typeof window === "undefined") return `/send/${inviteToken}`;
  return `${window.location.origin}/send/${inviteToken}`;
}

export function GatherBoard({ token, initialPeople }: Props) {
  const [people, setPeople] = useState(initialPeople);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...people].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [people],
  );

  async function addPerson(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Add their name so the link knows who it's for.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/gather/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          relationship: relationship.trim() || null,
        }),
      });
      const data = (await res.json()) as Person & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Couldn't add them just yet.");
      }

      setPeople((prev) => [data, ...prev]);
      setJustAddedId(data.id);
      setName("");
      setRelationship("");

      const url = sendUrl(data.inviteToken);
      await navigator.clipboard.writeText(url).catch(() => undefined);
      setCopiedId(data.id);
      window.setTimeout(() => setCopiedId(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add them.");
    } finally {
      setSaving(false);
    }
  }

  async function copyLink(person: Person) {
    const url = sendUrl(person.inviteToken);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(person.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-10 sm:py-14">
      <header className="mb-10">
        <p className="font-[family-name:var(--font-display)] text-3xl text-[var(--cream)] sm:text-4xl">
          Gathering voices
        </p>
        <p className="mt-3 max-w-md text-[var(--cream)]/65">
          Add each person, copy their link, and send it. When they finish,
          you&apos;ll see it here.
        </p>
      </header>

      <form
        onSubmit={addPerson}
        className="space-y-4 rounded-2xl bg-[var(--surface)] p-5"
      >
        <label className="block">
          <span className="mb-2 block text-sm text-[var(--cream)]/55">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aunt Lisa"
            className="w-full rounded-xl border border-[var(--cream)]/12 bg-[var(--ground)] px-4 py-3 text-[var(--cream)] outline-none ring-[var(--gold)]/40 placeholder:text-[var(--cream)]/30 focus:ring-2"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-[var(--cream)]/55">
            How they know her{" "}
            <span className="text-[var(--cream)]/30">(optional)</span>
          </span>
          <input
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder="Aunt, college friend…"
            className="w-full rounded-xl border border-[var(--cream)]/12 bg-[var(--ground)] px-4 py-3 text-[var(--cream)] outline-none ring-[var(--gold)]/40 placeholder:text-[var(--cream)]/30 focus:ring-2"
          />
        </label>
        {error && <p className="text-sm text-[var(--blush)]">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-medium text-[var(--ground)] transition hover:brightness-110 disabled:opacity-60"
        >
          {saving ? "Making their link…" : "Add & copy link"}
        </button>
      </form>

      <section className="mt-10">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-sm uppercase tracking-[0.18em] text-[var(--cream)]/40">
            People
          </h2>
          <p className="text-sm text-[var(--cream)]/35">
            {people.length === 0
              ? "None yet"
              : people.length === 1
                ? "1 person"
                : `${people.length} people`}
          </p>
        </div>

        {sorted.length === 0 ? (
          <p className="text-[var(--cream)]/50">
            Start with someone close — Mom, a sister, an old friend.
          </p>
        ) : (
          <ul className="space-y-3">
            {sorted.map((person) => (
              <li
                key={person.id}
                className={`rounded-2xl bg-[var(--surface)] px-4 py-4 ${
                  justAddedId === person.id ? "ring-1 ring-[var(--gold)]/40" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-[family-name:var(--font-display)] text-lg text-[var(--cream)]">
                      {person.name}
                    </p>
                    {person.relationship && (
                      <p className="text-sm text-[var(--blush)]/90">
                        {person.relationship}
                      </p>
                    )}
                    <p className="mt-1 truncate text-xs text-[var(--cream)]/35">
                      /send/{person.inviteToken}
                    </p>
                    <p className="mt-2 text-xs text-[var(--cream)]/40">
                      {person.uploadCount === 0
                        ? "Nothing sent yet"
                        : person.uploadCount === 1
                          ? "1 thing sent"
                          : `${person.uploadCount} things sent`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyLink(person)}
                    className="shrink-0 rounded-full border border-[var(--cream)]/15 px-4 py-2 text-sm text-[var(--cream)]/80 transition hover:border-[var(--gold)]/50 hover:text-[var(--gold)]"
                  >
                    {copiedId === person.id ? "Copied" : "Copy link"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
