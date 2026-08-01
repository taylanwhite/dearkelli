"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function PasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          next: searchParams.get("next") || "/",
        }),
      });
      const data = (await res.json()) as { error?: string; next?: string };
      if (!res.ok) {
        setError(data.error || "That isn't it.");
        return;
      }
      router.replace(data.next || "/");
      router.refresh();
    } catch {
      setError("Something went quiet. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-sm space-y-5">
      <label className="block">
        <span className="sr-only">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          placeholder="The word you were given"
          className="w-full rounded-xl border border-[var(--cream)]/15 bg-[var(--surface)] px-4 py-3 text-center text-[var(--cream)] outline-none ring-[var(--gold)]/40 placeholder:text-[var(--cream)]/30 focus:ring-2"
        />
      </label>
      {error && (
        <p className="text-center text-sm text-[var(--blush)]">{error}</p>
      )}
      <button
        type="submit"
        disabled={loading || !password}
        className="w-full rounded-full bg-[var(--gold)] px-6 py-3 text-sm font-medium text-[var(--ground)] transition hover:brightness-110 disabled:opacity-50"
      >
        {loading ? "Opening…" : "Come in"}
      </button>
    </form>
  );
}
