import { PersonBubble } from "@/components/PersonBubble";
import { getPeople } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PeoplePage() {
  const people = await getPeople();

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--forest-deep)] sm:text-4xl">
        Everyone who loves you
      </h1>

      {people.length === 0 ? (
        <p className="mt-16 font-[family-name:var(--font-display)] text-xl text-[var(--cream)]/50">
          They&apos;re still on their way.
        </p>
      ) : (
        <ul className="mt-12 flex flex-wrap items-start justify-center gap-x-4 gap-y-10 sm:gap-x-8">
          {people.map((person, i) => (
            <li
              key={person.id}
              className={i % 5 === 1 || i % 5 === 3 ? "mt-6 sm:mt-10" : ""}
            >
              <PersonBubble
                id={person.id}
                name={person.name}
                relationship={person.relationship}
                avatarUrl={person.avatarUrl}
                size={i % 4 === 0 ? "lg" : "md"}
                showRelationship
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
