import lemmatizer from "wink-lemmatizer";

/** Stopwords we drop; keep the emotional ones via ALLOWLIST. */
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "of",
  "and",
  "or",
  "to",
  "in",
  "on",
  "at",
  "for",
  "with",
  "from",
  "by",
  "as",
  "is",
  "was",
  "are",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "can",
  "may",
  "might",
  "shall",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "i",
  "me",
  "my",
  "myself",
  "he",
  "him",
  "his",
  "they",
  "them",
  "their",
  "there",
  "then",
  "than",
  "but",
  "if",
  "when",
  "what",
  "which",
  "who",
  "whom",
  "how",
  "where",
  "why",
  "um",
  "uh",
  "ah",
  "oh",
  "hmm",
  "like",
  "just",
  "kind",
  "sort",
  "really",
  "very",
  "quite",
  "also",
  "too",
  "into",
  "about",
  "over",
  "after",
  "before",
  "up",
  "down",
  "out",
  "off",
  "again",
  "further",
  "once",
  "here",
  "all",
  "any",
  "both",
  "each",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "than",
  "too",
  "very",
  "s",
  "t",
  "don",
  "now",
  "ve",
  "re",
  "ll",
  "d",
  "m",
]);

/** Words standard stop lists kill that we must keep. */
const ALLOWLIST = new Set([
  "you",
  "your",
  "she",
  "her",
  "mom",
  "mama",
  "love",
  "always",
  "never",
  "still",
  "so",
  "us",
  "we",
  "together",
  "everything",
  "kelli",
  "kelly",
]);

export const THEME_TAGS = [
  "funny",
  "tender",
  "childhood",
  "motherhood",
  "advice",
  "gratitude",
  "inside joke",
] as const;

export type ThemeTag = (typeof THEME_TAGS)[number];

export const PHRASE_PATTERNS: string[][] = [
  ["i", "love", "you"],
  ["love", "you"],
  ["love", "you", "so", "much"],
  ["proud", "of", "you"],
  ["i", "m", "proud", "of", "you"],
  ["happy", "birthday"],
  ["happy", "birthday", "kelli"],
  ["thank", "you"],
  ["i", "miss", "you"],
  ["you", "are", "enough"],
];

export function stripPunctuation(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^\p{L}\p{N}']+/gu, "")
    .replace(/^'+|'+$/g, "");
}

export function lemmatizeWord(word: string): string {
  if (!word) return word;
  const asVerb = lemmatizer.verb(word);
  if (asVerb !== word) return asVerb;
  const asNoun = lemmatizer.noun(word);
  if (asNoun !== word) return asNoun;
  const asAdj = lemmatizer.adjective(word);
  if (asAdj !== word) return asAdj;
  return word;
}

export function normalizeWord(raw: string): string | null {
  const cleaned = stripPunctuation(raw);
  if (!cleaned || cleaned.length < 2) return null;

  const lemma = lemmatizeWord(cleaned);

  if (ALLOWLIST.has(lemma) || ALLOWLIST.has(cleaned)) return lemma;
  if (STOPWORDS.has(lemma) || STOPWORDS.has(cleaned)) return null;

  return lemma;
}

export type TimedWord = {
  raw: string;
  normalized: string | null;
  startMs: number;
  endMs: number;
};

export function detectPhrases(
  timed: TimedWord[],
): { text: string; startMs: number; endMs: number }[] {
  const cleaned = timed.map((w) => stripPunctuation(w.raw));
  const found: { text: string; startMs: number; endMs: number }[] = [];
  const sorted = [...PHRASE_PATTERNS].sort((a, b) => b.length - a.length);

  let i = 0;
  while (i < cleaned.length) {
    let matched = false;
    for (const pattern of sorted) {
      const slice = cleaned.slice(i, i + pattern.length);
      if (
        slice.length === pattern.length &&
        slice.every((w, idx) => w === pattern[idx])
      ) {
        found.push({
          text: pattern.join(" "),
          startMs: timed[i].startMs,
          endMs: timed[i + pattern.length - 1].endMs,
        });
        i += pattern.length;
        matched = true;
        break;
      }
    }
    if (!matched) i += 1;
  }

  return found;
}
