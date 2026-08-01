import { notFound } from "next/navigation";
import { Supercut } from "@/components/Supercut";
import { playbackSrc, playableUrl } from "@/lib/blob";
import { getPhraseOccurrences, getWordOccurrences } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ word: string }>;
  searchParams: Promise<{ type?: string }>;
};

export default async function WordPage({ params, searchParams }: Props) {
  const { word: encoded } = await params;
  const { type } = await searchParams;
  const word = decodeURIComponent(encoded);
  const isPhrase = type === "phrase";

  const rows = isPhrase
    ? await getPhraseOccurrences(word)
    : await getWordOccurrences(word);

  // One memory per attachment — show the whole clip, don't scrub to a word.
  const seenMedia = new Set<string>();
  const clips = rows.flatMap((r) => {
    if (seenMedia.has(r.mediaId)) return [];
    seenMedia.add(r.mediaId);

    return [
      {
        id: "wordId" in r ? r.wordId : r.phraseId,
        mediaId: r.mediaId,
        blobUrl: playbackSrc({
          blobUrl: r.blobUrl,
          playbackUrl: r.playbackUrl,
        }),
        kind: r.kind as "video" | "audio" | "image",
        posterUrl: r.posterUrl ? playableUrl(r.posterUrl) : null,
        startMs: 0,
        endMs: 0,
        contributorId: r.contributorId,
        contributorName: r.contributorName,
        relationship: r.relationship,
        avatarUrl: r.avatarUrl,
        title: r.title,
        timedWords: "timedWords" in r ? r.timedWords : null,
      },
    ];
  });

  if (clips.length === 0) {
    notFound();
  }

  return (
    <main className="pt-8">
      <div className="mx-auto mb-10 max-w-2xl px-5 text-center">
        <h1 className="break-words font-[family-name:var(--font-display)] text-4xl text-[var(--gold-deep)] sm:text-6xl">
          {word}
        </h1>
      </div>
      <Supercut clips={clips} label={word} />
    </main>
  );
}
