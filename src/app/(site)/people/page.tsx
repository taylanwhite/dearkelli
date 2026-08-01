import Link from "next/link";
import { getPeople } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function PeoplePage() {
  const people = await getPeople();

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--cream)] sm:text-4xl">
        Her people
      </h1>
      <p className="mt-2 max-w-lg text-[var(--cream)]/55">
        Everyone who showed up with something to say.
      </p>

      {people.length === 0 ? (
        <p className="mt-16 text-[var(--cream)]/50">
          No one has arrived yet — but they will.
        </p>
      ) : (
        <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {people.map((person) => (
            <li key={person.id}>
              <Link
                href={`/people/${person.id}`}
                className="group flex flex-col items-center rounded-2xl px-3 py-6 text-center transition hover:bg-[var(--surface)]/70"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface)] font-[family-name:var(--font-display)] text-xl text-[var(--gold)] ring-1 ring-[var(--cream)]/10 transition group-hover:ring-[var(--gold)]/40">
                  {initials(person.name)}
                </span>
                <span className="mt-4 font-[family-name:var(--font-display)] text-lg text-[var(--cream)]">
                  {person.name}
                </span>
                {person.relationship && (
                  <span className="mt-1 text-sm text-[var(--blush)]/85">
                    {person.relationship}
                  </span>
                )}
                <span className="mt-2 text-xs text-[var(--cream)]/40">
                  {person.clipCount === 1
                    ? "1 thing"
                    : `${person.clipCount} things`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
