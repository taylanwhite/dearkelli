import Link from "next/link";
import { notFound } from "next/navigation";
import { PersonBubble } from "@/components/PersonBubble";
import { playableUrl } from "@/lib/blob";
import { getPerson } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PersonPage({ params }: Props) {
  const { id } = await params;
  const data = await getPerson(id);
  if (!data) notFound();

  const { person, clips, topWords } = data;
  const photos = clips.filter((c) => c.kind === "image");
  const spoken = clips.filter((c) => c.kind !== "image");

  // A handful of words, no frequencies, just the flavor of their voice
  const softWords = topWords.slice(0, 8);

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link
        href="/people"
        className="text-sm text-[var(--cream)]/45 transition hover:text-[var(--forest)]"
      >
        ← Everyone
      </Link>

      <header className="mt-10 flex flex-col items-center text-center">
        <PersonBubble
          name={person.name}
          relationship={person.relationship}
          avatarUrl={person.avatarUrl}
          size="xl"
          href={null}
          showRelationship
        />
      </header>

      {softWords.length > 0 && (
        <p className="mx-auto mt-8 max-w-md text-center font-[family-name:var(--font-display)] text-xl leading-relaxed text-[var(--forest)]/80">
          {softWords.map((w, i) => (
            <span key={w.normalized}>
              {i > 0 && <span className="text-[var(--gold)]/50"> · </span>}
              <Link
                href={`/words/${encodeURIComponent(w.normalized)}`}
                className="underline decoration-[var(--gold)]/35 underline-offset-4 transition hover:text-[var(--gold-deep)] hover:decoration-[var(--gold)]"
              >
                {w.normalized}
              </Link>
            </span>
          ))}
        </p>
      )}

      {spoken.length > 0 && (
        <section className="mt-14 space-y-10">
          {spoken.map((clip) => (
            <article key={clip.id}>
              {clip.kind === "video" ? (
                <video
                  src={playableUrl(clip.blobUrl)}
                  poster={
                    clip.posterUrl ? playableUrl(clip.posterUrl) : undefined
                  }
                  controls
                  playsInline
                  className="aspect-video w-full rounded-2xl bg-[var(--forest-deep)] object-contain"
                />
              ) : (
                <div className="rounded-2xl bg-[var(--surface)] px-5 py-8">
                  <audio
                    src={playableUrl(clip.blobUrl)}
                    controls
                    className="w-full"
                  />
                </div>
              )}
              {(clip.title || clip.summary) && (
                <p className="mt-4 font-[family-name:var(--font-display)] text-lg leading-snug text-[var(--forest-deep)]">
                  {clip.summary || clip.title}
                </p>
              )}
            </article>
          ))}
        </section>
      )}

      {photos.length > 0 && (
        <section className="mt-16">
          <ul className="grid grid-cols-2 gap-3">
            {photos.map((photo) => (
              <li key={photo.id} className="overflow-hidden rounded-2xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={playableUrl(photo.posterUrl || photo.blobUrl)}
                  alt={photo.caption || `From ${person.name}`}
                  className="aspect-square w-full object-cover"
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
