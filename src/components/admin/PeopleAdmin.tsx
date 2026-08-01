"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export type AdminPerson = {
  id: string;
  name: string;
  relationship: string | null;
  inviteToken: string;
  isTest: boolean;
  createdAt: string | Date;
  uploadCount: number;
  readyCount: number;
  pendingCount: number;
  failedCount: number;
};

type Props = { initialPeople: AdminPerson[] };

function sendPath(token: string) {
  return `/send/${token}`;
}

export function PeopleAdmin({ initialPeople }: Props) {
  const router = useRouter();
  const [people, setPeople] = useState(initialPeople);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRelationship, setEditRelationship] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function addPerson(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          relationship: relationship.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setName("");
      setRelationship("");
      router.refresh();
      setPeople((prev) => [
        {
          ...data,
          isTest: data.isTest ?? false,
          uploadCount: 0,
          readyCount: 0,
          pendingCount: 0,
          failedCount: 0,
        },
        ...prev,
      ]);
      await copyLink(data.inviteToken, data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add.");
    } finally {
      setSaving(false);
    }
  }

  async function copyLink(inviteToken: string, id: string) {
    const url = `${window.location.origin}${sendPath(inviteToken)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      window.prompt("Copy link:", url);
    }
  }

  async function saveEdit(id: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/people/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          relationship: editRelationship.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPeople((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                name: data.name,
                relationship: data.relationship,
              }
            : p,
        ),
      );
      setEditingId(null);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusyId(null);
    }
  }

  async function regenerate(id: string) {
    if (!confirm("Make a new invite link? The old one will stop working.")) {
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/people/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateToken: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setPeople((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, inviteToken: data.inviteToken } : p,
        ),
      );
      await copyLink(data.inviteToken, id);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't regenerate");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string, personName: string) {
    if (
      !confirm(
        `Remove ${personName}? Their uploads and words will be deleted too.`,
      )
    ) {
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/people/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      setPeople((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't delete");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8">
      <form
        onSubmit={addPerson}
        className="space-y-3 rounded-2xl border border-white/10 bg-[#231A33] p-5"
      >
        <p className="text-sm text-[#F6F0E8]/50">Add someone</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            required
            className="rounded-xl border border-white/10 bg-[#151021] px-4 py-3 text-[#F6F0E8] outline-none focus:ring-2 focus:ring-[#E8B14C]/40"
          />
          <input
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            placeholder="Relationship (optional)"
            className="rounded-xl border border-white/10 bg-[#151021] px-4 py-3 text-[#F6F0E8] outline-none focus:ring-2 focus:ring-[#E8B14C]/40"
          />
        </div>
        {error && <p className="text-sm text-[#E4899B]">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-[#E8B14C] px-5 py-2.5 text-sm font-medium text-[#151021] disabled:opacity-60"
        >
          {saving ? "Adding…" : "Add & copy link"}
        </button>
      </form>

      <ul className="space-y-3">
        {people.map((person) => (
          <li
            key={person.id}
            className="rounded-2xl border border-white/10 bg-[#231A33] px-4 py-4"
          >
            {editingId === person.id ? (
              <div className="space-y-3">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#151021] px-4 py-2 text-[#F6F0E8]"
                />
                <input
                  value={editRelationship}
                  onChange={(e) => setEditRelationship(e.target.value)}
                  placeholder="Relationship"
                  className="w-full rounded-xl border border-white/10 bg-[#151021] px-4 py-2 text-[#F6F0E8]"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === person.id}
                    onClick={() => saveEdit(person.id)}
                    className="rounded-full bg-[#E8B14C] px-4 py-2 text-sm text-[#151021]"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="rounded-full border border-white/15 px-4 py-2 text-sm text-[#F6F0E8]/70"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-lg text-[#F6F0E8]">
                    {person.name}
                    {person.isTest && (
                      <span className="rounded-full bg-[#E8B14C]/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#E8B14C]">
                        test
                      </span>
                    )}
                  </p>
                  {person.relationship && (
                    <p className="text-sm text-[#E4899B]/90">
                      {person.relationship}
                    </p>
                  )}
                  <p className="mt-1 truncate text-xs text-[#F6F0E8]/35">
                    {sendPath(person.inviteToken)}
                  </p>
                  <p className="mt-2 text-xs text-[#F6F0E8]/40">
                    {person.uploadCount} upload
                    {person.uploadCount === 1 ? "" : "s"}
                    {person.pendingCount > 0
                      ? ` · ${person.pendingCount} pending`
                      : ""}
                    {person.failedCount > 0
                      ? ` · ${person.failedCount} failed`
                      : ""}
                    {person.readyCount > 0
                      ? ` · ${person.readyCount} ready`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copyLink(person.inviteToken, person.id)}
                    className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-[#F6F0E8]/75"
                  >
                    {copiedId === person.id ? "Copied" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(person.id);
                      setEditName(person.name);
                      setEditRelationship(person.relationship ?? "");
                    }}
                    className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-[#F6F0E8]/75"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busyId === person.id}
                    onClick={() => regenerate(person.id)}
                    className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-[#F6F0E8]/75"
                  >
                    New link
                  </button>
                  <button
                    type="button"
                    disabled={busyId === person.id}
                    onClick={() => remove(person.id, person.name)}
                    className="rounded-full border border-[#E4899B]/40 px-3 py-1.5 text-xs text-[#E4899B]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
