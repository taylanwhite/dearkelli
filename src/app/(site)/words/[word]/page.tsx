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

  const clips = rows.map((r) => {
    // AI tags carry placeholder timestamps (nobody "said" them), so play the
    // whole clip instead of a fraction-of-a-second slice.
    const isTag = "source" in r && r.source === "tag";
    const isImage = r.kind === "image";
    const durationMs =
      "durationSeconds" in r && r.durationSeconds
        ? r.durationSeconds * 1000
        : null;
    const startMs = isTag || isImage ? 0 : r.startMs;
    const endMs = isTag || isImage ? (durationMs ?? 3_600_000) : r.endMs;

    return {
      id: "wordId" in r ? r.wordId : r.phraseId,
      blobUrl: playbackSrc({
        blobUrl: r.blobUrl,
        playbackUrl: r.playbackUrl,
      }),
      kind: r.kind as "video" | "audio" | "image",
      posterUrl: r.posterUrl ? playableUrl(r.posterUrl) : null,
      startMs,
      endMs,
      contributorId: r.contributorId,
      contributorName: r.contributorName,
      relationship: r.relationship,
      avatarUrl: r.avatarUrl,
      title: r.title,
    };
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
