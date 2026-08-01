"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Words" },
  { href: "/people", label: "People" },
  { href: "/photos", label: "Photos" },
  { href: "/search", label: "Find" },
];

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--ground)]/85 backdrop-blur-md pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 sm:px-5 sm:py-3">
        <Link
          href="/"
          className="flex min-h-11 items-center font-[family-name:var(--font-display)] text-xl tracking-tight text-[var(--ink)]"
        >
          Kelli
        </Link>
        <ul className="flex items-center gap-0.5 sm:gap-1">
          {LINKS.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-sm transition touch-manipulation sm:px-3.5 ${
                    active
                      ? "bg-[var(--ink)] text-[var(--ground)]"
                      : "text-[var(--muted)] active:text-[var(--ink)] hover:text-[var(--ink)]"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
