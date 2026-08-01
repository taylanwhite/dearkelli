import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { media, transcripts, words } from "@/db/schema";
import { filterWarmAiTags } from "@/lib/words";

/** Replace tag-sourced cloud words for a media item and persist media.tags. */
export async function syncMediaTags(opts: {
  mediaId: string;
  contributorId: string;
  tags: string[];
}) {
  const cleaned = filterWarmAiTags(opts.tags);

  await db
    .update(media)
    .set({ tags: cleaned.length ? cleaned : null })
    .where(eq(media.id, opts.mediaId));

  await db
    .delete(words)
    .where(and(eq(words.mediaId, opts.mediaId), eq(words.source, "tag")));

  if (cleaned.length === 0) {
    return cleaned;
  }

  const [transcript] = await db
    .select({ id: transcripts.id })
    .from(transcripts)
    .where(eq(transcripts.mediaId, opts.mediaId))
    .limit(1);

  if (!transcript) {
    // Still processing; tags are saved on media and applied when ready.
    return cleaned;
  }

  // Skip tags already present as spoken words so we don't double-count.
  const spoken = await db
    .select({ normalized: words.normalized })
    .from(words)
    .where(
      and(eq(words.mediaId, opts.mediaId), eq(words.source, "speech")),
    );
  const spokenSet = new Set(spoken.map((w) => w.normalized));
  const extra = cleaned.filter((t) => !spokenSet.has(t));

  if (extra.length > 0) {
    await db.insert(words).values(
      extra.map((tag, i) => ({
        transcriptId: transcript.id,
        mediaId: opts.mediaId,
        contributorId: opts.contributorId,
        raw: tag,
        normalized: tag,
        startMs: i * 10,
        endMs: i * 10 + 5,
        source: "tag",
      })),
    );
  }

  return cleaned;
}
