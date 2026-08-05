/**
 * Whisper and GPT often spell her name "Kelly". Always prefer "Kelli".
 * Preserves ALL-CAPS / Title / lower casing of the match.
 */
export function correctKelliSpelling(text: string): string {
  return text
    .replace(/\bKelly\b/g, "Kelli")
    .replace(/\bKELLY\b/g, "KELLI")
    .replace(/\bkelly\b/g, "kelli");
}

/** Map the common misspelling onto the canonical cloud token. */
export function canonicalizeKelliToken(word: string): string {
  return word.toLowerCase() === "kelly" ? "kelli" : word;
}
