"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const LINKS: {
  href: string;
  label: string;
  icon?: ReactNode;
}[] = [
  { href: "/", label: "Affirmations" },
  { href: "/people", label: "Family" },
  { href: "/photos", label: "Memories" },
  {
    href: "/search",
    label: "Search",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-[1.15rem] w-[1.15rem]"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    ),
  },
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
                  aria-label={link.icon ? link.label : undefined}
                  title={link.icon ? link.label : undefined}
                  className={`flex min-h-11 min-w-11 items-center justify-center rounded-full text-sm transition touch-manipulation ${
                    link.icon ? "px-2.5 sm:px-3" : "px-3 sm:px-3.5"
                  } ${
                    active
                      ? "bg-[var(--ink)] text-[var(--ground)]"
                      : "text-[var(--muted)] active:text-[var(--ink)] hover:text-[var(--ink)]"
                  }`}
                >
                  {link.icon ?? link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
