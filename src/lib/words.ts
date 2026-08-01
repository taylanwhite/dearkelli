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

/**
 * Curated vocabulary for the keepsake word cloud.
 * Spoken Whisper junk (smell, hurt, robot…) never appears unless listed here.
 */
const CLOUD_WORDS = new Set([
  // Love & belonging
  "love",
  "loved",
  "loving",
  "adore",
  "cherish",
  "treasure",
  "heart",
  "hearts",
  "soul",
  "dear",
  "dearest",
  "beloved",
  "sweetheart",
  "honey",
  "darling",
  "together",
  "us",
  "family",
  "home",
  "belong",
  "belonging",
  "embrace",
  "hug",
  "hugs",
  "kiss",
  "kisses",
  "warmth",
  "warm",
  "tender",
  "tenderness",
  "gentle",
  "soft",
  "sweet",
  "kind",
  "kindness",
  "care",
  "caring",
  "comfort",
  "safe",
  "safety",
  "peace",
  "peaceful",
  // Joy & celebration
  "joy",
  "joyful",
  "happy",
  "happiness",
  "glad",
  "delight",
  "delightful",
  "cheer",
  "cheerful",
  "smile",
  "smiles",
  "smiling",
  "laugh",
  "laughs",
  "laughter",
  "giggle",
  "fun",
  "funny",
  "playful",
  "play",
  "celebrate",
  "celebration",
  "birthday",
  "party",
  "yay",
  "hooray",
  "cheers",
  "sunshine",
  "sun",
  "light",
  "bright",
  "glow",
  "sparkle",
  "magic",
  "magical",
  "wonder",
  "wonderful",
  "amazing",
  "awesome",
  "beautiful",
  "beauty",
  "lovely",
  "gorgeous",
  "radiant",
  "bloom",
  "blossom",
  // Gratitude & praise
  "grateful",
  "gratitude",
  "thankful",
  "thanks",
  "thank",
  "blessed",
  "blessing",
  "blessings",
  "proud",
  "pride",
  "honor",
  "honour",
  "admire",
  "admiration",
  "appreciate",
  "appreciation",
  "gift",
  "gifts",
  "present",
  "lucky",
  "fortune",
  "grace",
  "gracious",
  // Strength & character
  "brave",
  "bravery",
  "courage",
  "courageous",
  "strong",
  "strength",
  "resilient",
  "resilience",
  "wise",
  "wisdom",
  "patient",
  "patience",
  "hope",
  "hopeful",
  "faith",
  "faithful",
  "loyal",
  "loyalty",
  "true",
  "truth",
  "honest",
  "honesty",
  "good",
  "goodness",
  "great",
  "best",
  "enough",
  "worthy",
  "special",
  "unique",
  "rare",
  "precious",
  "priceless",
  "incredible",
  "extraordinary",
  "remarkable",
  "inspiring",
  "inspire",
  "inspiration",
  "hero",
  "heroine",
  "champion",
  // Time & forever
  "always",
  "forever",
  "ever",
  "eternal",
  "eternity",
  "evermore",
  "memory",
  "memories",
  "remember",
  "moment",
  "moments",
  "today",
  "everyday",
  "lifetime",
  "years",
  "story",
  "stories",
  "chapter",
  // People & roles (warm only)
  "mom",
  "mama",
  "mommy",
  "mother",
  "mum",
  "wife",
  "sister",
  "sis",
  "daughter",
  "aunt",
  "auntie",
  "friend",
  "friends",
  "friendship",
  "partner",
  "neighbor",
  "neighbour",
  "kelli",
  "kelly",
  // Everyday affection words that still belong
  "miss",
  "wish",
  "wishes",
  "dream",
  "dreams",
  "song",
  "dance",
  "dancing",
  "sing",
  "singing",
  "music",
  "angel",
  "star",
  "stars",
  "heaven",
  "miracle",
  "everything",
  "whole",
  "world",
  "life",
  "alive",
  "living",
  "breath",
  "breathe",
  "presence",
  "support",
  "supporting",
  "listen",
  "listening",
  "understand",
  "understanding",
  "accept",
  "acceptance",
  "forgive",
  "forgiveness",
  "heal",
  "healing",
  "grow",
  "growing",
  "growth",
  "guide",
  "guiding",
  "teach",
  "teacher",
  "lesson",
  "lessons",
  "example",
  "role",
  "model",
  "queen",
  "princess",
  "shine",
  "shining",
  "glowing",
  "blooming",
  "flourishing",
  "thrive",
  "thriving",
  "bless",
  "hug",
  "cuddle",
  "snuggle",
  "cozy",
  "cosy",
  "nest",
  "root",
  "roots",
  "foundation",
  "anchor",
  "harbor",
  "harbour",
  "refuge",
  "sanctuary",
  "devotion",
  "devoted",
  "passion",
  "passionate",
  "romance",
  "romantic",
  "affection",
  "affectionate",
  "fond",
  "fondness",
  "dearly",
  "deeply",
  "truly",
  "sincere",
  "sincerely",
  "wholehearted",
  "wholeheartedly",
]);

/** Explicit rejects even if a future prompt slips (defense in depth). */
const CLOUD_BLOCKLIST = new Set([
  "smell",
  "smells",
  "smelly",
  "baby",
  "babies",
  "hurt",
  "hurts",
  "hurting",
  "robot",
  "crazy",
  "mad",
  "weird",
  "stupid",
  "dumb",
  "hate",
  "hated",
  "kill",
  "dead",
  "death",
  "die",
  "dying",
  "sad",
  "cry",
  "crying",
  "tears",
  "pain",
  "sick",
  "ill",
  "funeral",
  "grief",
  "afraid",
  "scared",
  "fear",
  "anxious",
  "anxiety",
  "worried",
  "alone",
  "lonely",
  "broken",
  "fight",
  "fighting",
  "car",
  "phone",
  "video",
  "audio",
  "clip",
  "file",
  "photo",
  "picture",
  "image",
  "shirt",
  "table",
  "wall",
  "floor",
  "outdoor",
  "indoor",
  "person",
  "people",
  "guy",
  "dude",
  "thing",
  "stuff",
  "hey",
  "yeah",
  "yep",
  "nah",
  "okay",
  "ok",
  "umm",
  "uhh",
  "hoo",
  "kel",
  "ready",
  "go",
  "going",
  "went",
  "come",
  "came",
  "get",
  "got",
  "make",
  "made",
  "know",
  "knew",
  "think",
  "thought",
  "say",
  "said",
  "tell",
  "told",
  "look",
  "looking",
  "see",
  "saw",
  "watch",
  "watching",
  "run",
  "running",
  "walk",
  "walking",
  "until",
  "thats",
  "that's",
  "hes",
  "he's",
  "shes",
  "she's",
  "much",
  "still",
  "also",
  "just",
  "really",
  "very",
  "quite",
]);

/** Whether a normalized token belongs on the public word cloud. */
export function isCloudWorthyWord(normalized: string | null | undefined): boolean {
  if (!normalized) return false;
  const w = normalized.toLowerCase().trim();
  if (w.length < 3 || w.length > 18) return false;
  if (CLOUD_BLOCKLIST.has(w)) return false;
  return CLOUD_WORDS.has(w);
}

/**
 * Keep only tags that belong on her cloud: happy, loving, thoughtful.
 * Used for AI tags and any curated word lists.
 */
export function filterWarmAiTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const raw of tags) {
    const cleaned = raw
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "");
    if (!cleaned) continue;

    const normalized = normalizeWord(cleaned) || cleaned;
    if (!isCloudWorthyWord(normalized) && !isCloudWorthyWord(cleaned)) {
      continue;
    }
    const finalWord = isCloudWorthyWord(normalized) ? normalized : cleaned;
    if (seen.has(finalWord)) continue;

    seen.add(finalWord);
    out.push(finalWord);
    if (out.length >= 12) break;
  }

  return out;
}

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
