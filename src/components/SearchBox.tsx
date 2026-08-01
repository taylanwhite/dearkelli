"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = { initialQuery?: string };

export function SearchBox({ initialQuery = "" }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = query.trim();
        startTransition(() => {
          router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
        });
      }}
      className="relative"
    >
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="A word, a name, a memory…"
        className="w-full rounded-2xl border border-[var(--cream)]/12 bg-[var(--surface)] px-5 py-4 text-[var(--cream)] outline-none ring-[var(--gold)]/40 placeholder:text-[var(--cream)]/30 focus:ring-2"
      />
      <button
        type="submit"
        disabled={pending}
        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-[var(--gold)] px-4 py-2 text-sm font-medium text-[var(--ground)] disabled:opacity-60"
      >
        {pending ? "…" : "Search"}
      </button>
    </form>
  );
}
