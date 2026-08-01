import Link from "next/link";
import { playableUrl } from "@/lib/blob";
import { getPeople, getPhotos } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ from?: string }> };

export default async function PhotosPage({ searchParams }: Props) {
  const { from } = await searchParams;
  const [photos, people] = await Promise.all([getPhotos(from), getPeople()]);
  const fromPerson = people.find((p) => p.id === from);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--forest-deep)] sm:text-4xl">
        {fromPerson ? `From ${fromPerson.name}` : "Pictures they sent you"}
      </h1>

      <div className="mt-8 flex gap-3 overflow-x-auto pb-2">
        <Link
          href="/photos"
          className={`shrink-0 font-[family-name:var(--font-display)] text-lg transition ${
            !from
              ? "text-[var(--gold-deep)] underline decoration-[var(--gold)] underline-offset-4"
              : "text-[var(--forest)]/45 hover:text-[var(--forest)]"
          }`}
        >
          Everyone
        </Link>
        {people.map((person) => (
          <Link
            key={person.id}
            href={`/photos?from=${person.id}`}
            className={`shrink-0 font-[family-name:var(--font-display)] text-lg transition ${
              from === person.id
                ? "text-[var(--gold-deep)] underline decoration-[var(--gold)] underline-offset-4"
                : "text-[var(--forest)]/45 hover:text-[var(--forest)]"
            }`}
          >
            {person.name}
          </Link>
        ))}
      </div>

      {photos.length === 0 ? (
        <p className="mt-16 font-[family-name:var(--font-display)] text-xl text-[var(--cream)]/50">
          Nothing here yet. Give them a little time.
        </p>
      ) : (
        <ul className="mt-10 columns-1 gap-5 sm:columns-2 md:columns-3">
          {photos.map((photo) => (
            <li key={photo.id} className="mb-5 break-inside-avoid">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={playableUrl(photo.posterUrl || photo.blobUrl)}
                alt={
                  photo.caption ||
                  photo.title ||
                  `From ${photo.contributorName}`
                }
                className="w-full rounded-2xl object-cover"
              />
              <p className="mt-2 font-[family-name:var(--font-display)] text-sm text-[var(--forest)]/70">
                {photo.contributorName}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
