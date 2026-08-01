import Link from "next/link";
import { PersonBubble } from "@/components/PersonBubble";
import { SearchBox } from "@/components/SearchBox";
import { playableUrl } from "@/lib/blob";
import { getPeople, searchAll } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const [results, allPeople] = await Promise.all([
    q ? searchAll(q) : Promise.resolve(null),
    getPeople(),
  ]);

  const peopleBubbles = results?.people ?? (!q ? allPeople : []);

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--forest-deep)] sm:text-4xl">
        Looking for something?
      </h1>
      <div className="mt-8">
        <SearchBox initialQuery={q} />
      </div>

      {!q && (
        <p className="mt-10 font-[family-name:var(--font-display)] text-lg text-[var(--cream)]/45">
          A word you love. Someone&apos;s face.
        </p>
      )}

      {peopleBubbles.length > 0 && (
        <section className="mt-12">
          <ul className="flex flex-wrap items-start justify-center gap-x-4 gap-y-8 sm:gap-x-6">
            {peopleBubbles.map((p, i) => (
              <li
                key={p.id}
                className={i % 5 === 1 || i % 5 === 3 ? "mt-6 sm:mt-10" : ""}
              >
                <PersonBubble
                  id={p.id}
                  name={p.name}
                  relationship={p.relationship}
                  avatarUrl={p.avatarUrl}
                  size={i % 4 === 0 ? "lg" : "md"}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {results && (
        <div className="mt-14 space-y-12">
          {results.words.length === 0 &&
            results.phrases.length === 0 &&
            results.people.length === 0 &&
            results.photos.length === 0 && (
              <p className="font-[family-name:var(--font-display)] text-lg text-[var(--cream)]/50">
                Nothing with that yet. Try another word.
              </p>
            )}

          {(results.phrases.length > 0 || results.words.length > 0) && (
            <section>
              <ul className="flex flex-wrap justify-center gap-x-5 gap-y-3">
                {results.phrases.map((p) => (
                  <li key={p.text}>
                    <Link
                      href={`/words/${encodeURIComponent(p.text)}?type=phrase`}
                      className="font-[family-name:var(--font-display)] text-2xl text-[var(--gold-deep)]"
                    >
                      {p.text}
                    </Link>
                  </li>
                ))}
                {results.words.map((w) => (
                  <li key={w.normalized}>
                    <Link
                      href={`/words/${encodeURIComponent(w.normalized)}`}
                      className="font-[family-name:var(--font-display)] text-2xl text-[var(--forest)]"
                    >
                      {w.normalized}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.photos.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {results.photos.map((photo) => (
                <li key={photo.id} className="overflow-hidden rounded-2xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={playableUrl(photo.posterUrl || photo.blobUrl)}
                    alt={
                      photo.caption ||
                      photo.title ||
                      `From ${photo.contributorName}`
                    }
                    className="aspect-square w-full object-cover"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
