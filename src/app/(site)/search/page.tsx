import Link from "next/link";
import { SearchBox } from "@/components/SearchBox";
import { playableUrl } from "@/lib/blob";
import { searchAll } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q = "" } = await searchParams;
  const results = q ? await searchAll(q) : null;

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--cream)] sm:text-4xl">
        Search
      </h1>
      <div className="mt-6">
        <SearchBox initialQuery={q} />
      </div>

      {!q && (
        <p className="mt-10 text-[var(--cream)]/50">
          Try a word she loves, or someone&apos;s name.
        </p>
      )}

      {results && (
        <div className="mt-10 space-y-10">
          {results.words.length === 0 &&
            results.phrases.length === 0 &&
            results.people.length === 0 &&
            results.photos.length === 0 && (
              <p className="text-[var(--cream)]/50">
                Nothing with that yet — try another word.
              </p>
            )}

          {results.phrases.length > 0 && (
            <section>
              <h2 className="text-sm uppercase tracking-[0.18em] text-[var(--cream)]/40">
                Phrases
              </h2>
              <ul className="mt-3 space-y-2">
                {results.phrases.map((p) => (
                  <li key={p.text}>
                    <Link
                      href={`/words/${encodeURIComponent(p.text)}?type=phrase`}
                      className="font-[family-name:var(--font-display)] text-xl text-[var(--gold)]"
                    >
                      {p.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.words.length > 0 && (
            <section>
              <h2 className="text-sm uppercase tracking-[0.18em] text-[var(--cream)]/40">
                Words
              </h2>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {results.words.map((w) => (
                  <li key={w.normalized}>
                    <Link
                      href={`/words/${encodeURIComponent(w.normalized)}`}
                      className="font-[family-name:var(--font-display)] text-lg text-[var(--cream)]"
                    >
                      {w.normalized}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.people.length > 0 && (
            <section>
              <h2 className="text-sm uppercase tracking-[0.18em] text-[var(--cream)]/40">
                People
              </h2>
              <ul className="mt-3 space-y-2">
                {results.people.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/people/${p.id}`}
                      className="text-[var(--cream)]"
                    >
                      {p.name}
                      {p.relationship ? (
                        <span className="text-[var(--cream)]/40">
                          {" "}
                          — {p.relationship}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {results.photos.length > 0 && (
            <section>
              <h2 className="text-sm uppercase tracking-[0.18em] text-[var(--cream)]/40">
                Photos
              </h2>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {results.photos.map((photo) => (
                  <li key={photo.id} className="overflow-hidden rounded-xl">
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
            </section>
          )}
        </div>
      )}
    </main>
  );
}
