import Link from "next/link";
import { PersonBubble } from "@/components/PersonBubble";
import { PhotoLightbox } from "@/components/PhotoLightbox";
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

      <div className="-mx-5 mt-8 flex gap-4 overflow-x-auto px-5 pt-2 pb-3">
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
        <div className="mt-10">
          <PhotoLightbox
            layout="masonry"
            photos={photos.map((photo) => ({
              id: photo.id,
              src: playableUrl(photo.posterUrl || photo.blobUrl),
              alt:
                photo.summary ||
                photo.caption ||
                `From ${photo.contributorName}`,
              caption: photo.summary || photo.caption || undefined,
              contributorId: photo.contributorId,
              contributorName: photo.contributorName,
              avatarUrl: photo.avatarUrl,
            }))}
          />
        </div>
      )}
    </main>
  );
}
