import Link from "next/link";
import { notFound } from "next/navigation";
import { PersonBubble } from "@/components/PersonBubble";
import { PersonMedia } from "@/components/PersonMedia";
import { playableUrl, playbackSrc } from "@/lib/blob";
import { getPerson } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export default async function PersonPage({ params }: Props) {
  const { id } = await params;
  const data = await getPerson(id);
  if (!data) notFound();

  const { person, clips, topWords } = data;
  const softWords = topWords.slice(0, 8);

  return (
    <main className="mx-auto max-w-2xl px-5 py-5 sm:py-8">
      <header className="flex flex-col items-center text-center">
        <PersonBubble
          name={person.name}
          relationship={person.relationship}
          avatarUrl={person.avatarUrl}
          size="lg"
          href={null}
          showRelationship
        />
      </header>

      {softWords.length > 0 && (
        <p className="mx-auto mt-4 max-w-md text-center font-[family-name:var(--font-display)] text-base leading-snug text-[var(--forest)]/80 sm:text-lg">
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

      <PersonMedia
        personName={person.name}
        items={clips.map((clip) => ({
          id: clip.id,
          kind: clip.kind,
          src:
            clip.kind === "image"
              ? playableUrl(clip.posterUrl || clip.blobUrl)
              : playbackSrc({
                  blobUrl: clip.blobUrl,
                  playbackUrl: clip.playbackUrl,
                }),
          poster: clip.posterUrl ? playableUrl(clip.posterUrl) : undefined,
          title: clip.title,
          summary: clip.summary,
          caption: clip.summary || clip.caption,
          alt: clip.summary || clip.caption || `From ${person.name}`,
        }))}
      />
    </main>
  );
}
