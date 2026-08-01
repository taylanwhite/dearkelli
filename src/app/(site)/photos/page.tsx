import Link from "next/link";
import { PersonBubble } from "@/components/PersonBubble";
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

      <div className="-mx-5 mt-8 flex gap-4 overflow-x-auto px-5 pb-3">
        <Link
          href="/photos"
          className="group flex w-[4.5rem] shrink-0 flex-col items-center text-center touch-manipulation"
        >
          <span
            className={`flex h-14 w-14 items-center justify-center rounded-full font-[family-name:var(--font-display)] text-sm transition ${
              !from
                ? "bg-[var(--ink)] text-[var(--ground)] ring-[3px] ring-[var(--rose)]"
                : "bg-[var(--surface)] text-[var(--muted)] ring-2 ring-[var(--line)]"
            }`}
          >
            All
          </span>
          <span
            className={`mt-1.5 text-xs font-[family-name:var(--font-display)] ${
              !from ? "text-[var(--rose-deep)]" : "text-[var(--ink)]/75"
            }`}
          >
            Everyone
          </span>
        </Link>
        {people.map((person) => (
          <PersonBubble
            key={person.id}
            id={person.id}
            name={person.name}
            avatarUrl={person.avatarUrl}
            size="sm"
            href={`/photos?from=${person.id}`}
            selected={from === person.id}
            className="shrink-0"
          />
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
              <div className="mt-3">
                <PersonBubble
                  id={photo.contributorId}
                  name={photo.contributorName}
                  avatarUrl={photo.avatarUrl}
                  size="sm"
                  layout="row"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
