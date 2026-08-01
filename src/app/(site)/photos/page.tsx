import Link from "next/link";
import { playableUrl } from "@/lib/blob";
import { getPeople, getPhotos } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ from?: string }> };

export default async function PhotosPage({ searchParams }: Props) {
  const { from } = await searchParams;
  const [photos, people] = await Promise.all([getPhotos(from), getPeople()]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--cream)] sm:text-4xl">
        Photos
      </h1>
      <p className="mt-2 text-[var(--cream)]/55">
        Moments they wanted her to see.
      </p>

      <div className="mt-6 flex gap-2 overflow-x-auto pb-2">
        <Link
          href="/photos"
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${
            !from
              ? "bg-[var(--gold)] text-[var(--ground)]"
              : "bg-[var(--surface)] text-[var(--cream)]/60"
          }`}
        >
          Everyone
        </Link>
        {people.map((person) => (
          <Link
            key={person.id}
            href={`/photos?from=${person.id}`}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${
              from === person.id
                ? "bg-[var(--gold)] text-[var(--ground)]"
                : "bg-[var(--surface)] text-[var(--cream)]/60"
            }`}
          >
            {person.name}
          </Link>
        ))}
      </div>

      {photos.length === 0 ? (
        <p className="mt-16 text-[var(--cream)]/50">
          No photos yet — the album is waiting.
        </p>
      ) : (
        <ul className="mt-8 columns-1 gap-4 sm:columns-2 md:columns-3">
          {photos.map((photo) => (
            <li key={photo.id} className="mb-4 break-inside-avoid">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={playableUrl(photo.posterUrl || photo.blobUrl)}
                alt={
                  photo.caption ||
                  photo.title ||
                  `From ${photo.contributorName}`
                }
                className="w-full rounded-xl object-cover"
              />
              <p className="mt-2 text-sm text-[var(--cream)]/50">
                {photo.contributorName}
                {photo.caption ? ` — ${photo.caption}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
