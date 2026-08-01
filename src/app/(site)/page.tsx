import { WordCloud } from "@/components/WordCloud";
import { getPhraseStats, getWordStats } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [wordStats, phraseStats] = await Promise.all([
    getWordStats(),
    getPhraseStats(),
  ]);

  const cloudWords = [
    ...phraseStats
      .filter((p) => p.totalCount >= 1)
      .slice(0, 12)
      .map((p) => ({
        text: p.text,
        count: p.totalCount * 3,
        href: `/words/${encodeURIComponent(p.text)}?type=phrase`,
      })),
    ...wordStats.slice(0, 80).map((w) => ({
      text: w.normalized,
      count: w.totalCount,
      href: `/words/${encodeURIComponent(w.normalized)}`,
    })),
  ];

  // Prefer unique labels; phrases win over single words with same text.
  const seen = new Set<string>();
  const unique = cloudWords.filter((w) => {
    if (seen.has(w.text)) return false;
    seen.add(w.text);
    return true;
  });

  return (
    <main className="pb-10 pt-4">
      <WordCloud words={unique} />
    </main>
  );
}
