"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function AdminLoginForm() {
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
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          next: searchParams.get("next") || "/admin",
        }),
      });
      const data = (await res.json()) as { error?: string; next?: string };
      if (!res.ok) {
        setError(data.error || "That isn't it.");
        return;
      }
      router.replace(data.next || "/admin");
      router.refresh();
    } catch {
      setError("Couldn't sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full max-w-sm space-y-4">
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        placeholder="Admin password"
        className="w-full rounded-xl border border-white/10 bg-[#231A33] px-4 py-3 text-center text-[#F6F0E8] outline-none ring-[#E8B14C]/40 placeholder:text-[#F6F0E8]/30 focus:ring-2"
      />
      {error && <p className="text-center text-sm text-[#E4899B]">{error}</p>}
      <button
        type="submit"
        disabled={loading || !password}
        className="w-full rounded-full bg-[#E8B14C] px-6 py-3 text-sm font-medium text-[#151021] disabled:opacity-50"
      >
        {loading ? "Checking…" : "Enter admin"}
      </button>
    </form>
  );
}
