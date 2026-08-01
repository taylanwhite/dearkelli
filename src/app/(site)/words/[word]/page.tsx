import Link from "next/link";
import { Supercut } from "@/components/Supercut";
import { playableUrl } from "@/lib/blob";
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

  const clips = rows
    .filter((r) => r.kind !== "image")
    .map((r) => ({
      id: "wordId" in r ? r.wordId : r.phraseId,
      blobUrl: playableUrl(r.blobUrl),
      kind: r.kind as "video" | "audio" | "image",
      posterUrl: r.posterUrl ? playableUrl(r.posterUrl) : null,
      startMs: r.startMs,
      endMs: r.endMs,
      contributorName: r.contributorName,
      relationship: r.relationship,
      title: r.title,
    }));

  return (
    <main className="pt-8">
      <div className="mx-auto mb-10 max-w-2xl px-5 text-center">
        <Link
          href="/"
          className="text-sm text-[var(--cream)]/45 transition hover:text-[var(--forest)]"
        >
          ← All the words
        </Link>
        <h1 className="mt-6 break-words font-[family-name:var(--font-display)] text-4xl text-[var(--gold-deep)] sm:text-6xl">
          {word}
        </h1>
      </div>
      <Supercut clips={clips} label={word} />
    </main>
  );
}
