"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/media", label: "Uploads" },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <header className="border-b border-[var(--forest)]/10 bg-[var(--ground)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
        <div className="flex items-center gap-6">
          <Link
            href="/admin"
            className="text-sm font-semibold text-[var(--gold-deep)]"
          >
            Admin
          </Link>
          <nav className="flex gap-1">
            {LINKS.map((link) => {
              const active =
                link.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-1.5 text-sm ${
                    active
                      ? "bg-[var(--forest)] text-[var(--ground)]"
                      : "text-[var(--cream)]/50 hover:text-[var(--forest)]"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <button
          type="button"
          onClick={async () => {
            await fetch("/api/admin/logout", { method: "POST" });
            router.replace("/admin/login");
            router.refresh();
          }}
          className="text-sm text-[var(--cream)]/40 hover:text-[var(--cream)]/70"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
