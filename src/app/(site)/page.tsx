import { WordCloud } from "@/components/WordCloud";
import { getPeople, getPhraseStats, getWordStats } from "@/lib/queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [wordStats, phraseStats, people] = await Promise.all([
    getWordStats(),
    getPhraseStats(),
    getPeople(),
  ]);

  const cloudWords = [
    ...phraseStats
      .filter((p) => p.totalCount >= 1)
      .slice(0, 12)
      .map((p) => ({
        text: p.text,
        count: p.totalCount * 3,
        href: `/words/${encodeURIComponent(p.text)}?type=phrase`,
        kind: "phrase" as const,
      })),
    ...wordStats.slice(0, 80).map((w) => ({
      text: w.normalized,
      count: w.totalCount,
      href: `/words/${encodeURIComponent(w.normalized)}`,
      kind: "word" as const,
    })),
  ];

  // Prefer unique labels; phrases win over single words with same text.
  const seen = new Set<string>();
  const unique = cloudWords.filter((w) => {
    if (seen.has(w.text)) return false;
    seen.add(w.text);
    return true;
  });

  const faces = people.map((p) => ({
    type: "person" as const,
    id: p.id,
    name: p.name,
    avatarUrl: p.avatarUrl,
    href: `/people/${p.id}`,
  }));

  return (
    <main className="pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-4">
      <WordCloud words={unique} people={faces} />
    </main>
  );
}
