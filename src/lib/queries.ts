import { and, desc, eq, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  contributors,
  media,
  phrases,
  transcripts,
  words,
} from "@/db/schema";
import { isCloudWorthyWord, canonicalizeKelliToken } from "@/lib/words";
import { correctKelliSpelling } from "@/lib/kelli-spelling";

export async function getWordStats() {
  const rows = await db
    .select({
      normalized: words.normalized,
      totalCount: sql<number>`count(*)::int`,
      contributorCount: sql<number>`count(distinct ${words.contributorId})::int`,
      mediaCount: sql<number>`count(distinct ${words.mediaId})::int`,
    })
    .from(words)
    .innerJoin(media, eq(words.mediaId, media.id))
    .where(
      and(
        eq(media.status, "ready"),
        // Spoken words + warm AI tags both belong on the cloud.
        inArray(words.source, ["speech", "tag"]),
      ),
    )
    .groupBy(words.normalized)
    .orderBy(desc(sql`count(*)`));

  // Merge the common "kelly" misspelling into canonical "kelli".
  const merged = new Map<
    string,
    {
      normalized: string;
      totalCount: number;
      contributorCount: number;
      mediaCount: number;
    }
  >();
  for (const row of rows) {
    const key = canonicalizeKelliToken(row.normalized);
    if (!isCloudWorthyWord(key)) continue;
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, { ...row, normalized: key });
    } else {
      prev.totalCount += row.totalCount;
      prev.contributorCount += row.contributorCount;
      prev.mediaCount += row.mediaCount;
    }
  }

  return Array.from(merged.values()).sort(
    (a, b) => b.totalCount - a.totalCount,
  );
}

export async function getPhraseStats() {
  const rows = await db
    .select({
      text: phrases.text,
      totalCount: sql<number>`count(*)::int`,
    })
    .from(phrases)
    .innerJoin(media, eq(phrases.mediaId, media.id))
    .where(eq(media.status, "ready"))
    .groupBy(phrases.text)
    .orderBy(desc(sql`count(*)`));

  const merged = new Map<string, { text: string; totalCount: number }>();
  for (const row of rows) {
    const text = correctKelliSpelling(row.text);
    const prev = merged.get(text);
    if (prev) prev.totalCount += row.totalCount;
    else merged.set(text, { text, totalCount: row.totalCount });
  }
  return Array.from(merged.values()).sort(
    (a, b) => b.totalCount - a.totalCount,
  );
}

export async function getWordOccurrences(normalized: string) {
  const key = canonicalizeKelliToken(normalized);
  const aliases = key === "kelli" ? ["kelli", "kelly"] : [key];

  return db
    .select({
      wordId: words.id,
      raw: words.raw,
      source: words.source,
      startMs: words.startMs,
      endMs: words.endMs,
      durationSeconds: media.durationSeconds,
      mediaId: media.id,
      blobUrl: media.blobUrl,
      kind: media.kind,
      posterUrl: media.posterUrl,
      playbackUrl: media.playbackUrl,
      title: media.title,
      timedWords: transcripts.timedWords,
      contributorId: contributors.id,
      contributorName: contributors.name,
      relationship: contributors.relationship,
      avatarUrl: contributors.avatarUrl,
    })
    .from(words)
    .innerJoin(media, eq(words.mediaId, media.id))
    .leftJoin(transcripts, eq(transcripts.mediaId, media.id))
    .innerJoin(contributors, eq(words.contributorId, contributors.id))
    .where(
      and(
        inArray(words.normalized, aliases),
        eq(media.status, "ready"),
        inArray(words.source, ["speech", "tag"]),
      ),
    )
    .orderBy(contributors.name, words.startMs);
}

export async function getPhraseOccurrences(text: string) {
  return db
    .select({
      phraseId: phrases.id,
      text: phrases.text,
      startMs: phrases.startMs,
      endMs: phrases.endMs,
      mediaId: media.id,
      blobUrl: media.blobUrl,
      kind: media.kind,
      posterUrl: media.posterUrl,
      playbackUrl: media.playbackUrl,
      title: media.title,
      timedWords: transcripts.timedWords,
      contributorId: contributors.id,
      contributorName: contributors.name,
      relationship: contributors.relationship,
      avatarUrl: contributors.avatarUrl,
    })
    .from(phrases)
    .innerJoin(media, eq(phrases.mediaId, media.id))
    .leftJoin(transcripts, eq(transcripts.mediaId, media.id))
    .innerJoin(contributors, eq(phrases.contributorId, contributors.id))
    .where(and(eq(phrases.text, text), eq(media.status, "ready")))
    .orderBy(contributors.name, phrases.startMs);
}

export async function getPeople() {
  return db
    .select({
      id: contributors.id,
      name: contributors.name,
      relationship: contributors.relationship,
      avatarUrl: contributors.avatarUrl,
      clipCount: sql<number>`count(${media.id})::int`,
    })
    .from(contributors)
    .leftJoin(media, eq(media.contributorId, contributors.id))
    .groupBy(contributors.id)
    .having(sql`count(${media.id}) > 0`)
    .orderBy(contributors.name);
}

export async function getPerson(id: string) {
  const [person] = await db
    .select()
    .from(contributors)
    .where(eq(contributors.id, id))
    .limit(1);

  if (!person) return null;

  // All attachments for this person — AI status never hides them.
  const clips = await db
    .select()
    .from(media)
    .where(eq(media.contributorId, id))
    .orderBy(desc(media.createdAt));

  // Profile portraits are for the circle only, not the album.
  const albumClips = clips.filter(
    (clip) =>
      !(
        clip.kind === "image" &&
        person.avatarUrl &&
        clip.blobUrl === person.avatarUrl
      ),
  );

  const transcriptRows =
    albumClips.length === 0
      ? []
      : await db
          .select({
            mediaId: transcripts.mediaId,
            timedWords: transcripts.timedWords,
          })
          .from(transcripts)
          .where(
            inArray(
              transcripts.mediaId,
              albumClips.map((c) => c.id),
            ),
          );
  const timedByMedia = new Map(
    transcriptRows.map((t) => [t.mediaId, t.timedWords ?? null]),
  );
  const albumWithCaptions = albumClips.map((clip) => ({
    ...clip,
    timedWords: timedByMedia.get(clip.id) ?? null,
  }));

  const topWordConditions = [
    eq(words.contributorId, id),
    eq(media.status, "ready"),
    inArray(words.source, ["speech", "tag"]),
    isNull(media.processingError),
  ];
  if (person.avatarUrl) {
    topWordConditions.push(
      or(ne(media.blobUrl, person.avatarUrl), ne(media.kind, "image"))!,
    );
  }

  const topWords = (
    await db
      .select({
        normalized: words.normalized,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(words)
      .innerJoin(media, eq(words.mediaId, media.id))
      .where(and(...topWordConditions))
      .groupBy(words.normalized)
      .orderBy(desc(sql`count(*)`))
      .limit(80)
  )
    .map((w) => ({
      ...w,
      normalized: canonicalizeKelliToken(w.normalized),
    }))
    .filter((w) => isCloudWorthyWord(w.normalized))
    .reduce(
      (acc, w) => {
        const prev = acc.get(w.normalized);
        if (prev) prev.totalCount += w.totalCount;
        else acc.set(w.normalized, { ...w });
        return acc;
      },
      new Map<string, { normalized: string; totalCount: number }>(),
    );

  return {
    person,
    clips: albumWithCaptions,
    topWords: Array.from(topWords.values())
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, 24),
  };
}

export async function getPhotos(contributorId?: string) {
  const conditions = [
    eq(media.kind, "image"),
    // Hide profile portraits from the album
    or(isNull(contributors.avatarUrl), ne(media.blobUrl, contributors.avatarUrl)),
  ];
  if (contributorId) {
    conditions.push(eq(media.contributorId, contributorId));
  }

  return db
    .select({
      id: media.id,
      blobUrl: media.blobUrl,
      posterUrl: media.posterUrl,
      caption: media.caption,
      summary: media.summary,
      title: media.title,
      contributorId: contributors.id,
      contributorName: contributors.name,
      avatarUrl: contributors.avatarUrl,
      createdAt: media.createdAt,
    })
    .from(media)
    .innerJoin(contributors, eq(media.contributorId, contributors.id))
    .where(and(...conditions))
    .orderBy(desc(media.createdAt));
}

export async function searchAll(query: string) {
  const q = query.trim();
  if (!q) {
    return { words: [], phrases: [], people: [], photos: [] };
  }

  const pattern = `%${q}%`;

  const [matchedWords, matchedPhrases, matchedPeople, matchedPhotos] =
    await Promise.all([
      db
        .select({
          normalized: words.normalized,
          totalCount: sql<number>`count(*)::int`,
        })
        .from(words)
        .innerJoin(media, eq(words.mediaId, media.id))
        .where(
          and(
            eq(media.status, "ready"),
            inArray(words.source, ["speech", "tag"]),
            or(ilike(words.normalized, pattern), ilike(words.raw, pattern)),
          ),
        )
        .groupBy(words.normalized)
        .orderBy(desc(sql`count(*)`))
        .limit(40)
        .then((rows) =>
          rows.filter((w) => isCloudWorthyWord(w.normalized)).slice(0, 20),
        ),
      db
        .select({
          text: phrases.text,
          totalCount: sql<number>`count(*)::int`,
        })
        .from(phrases)
        .innerJoin(media, eq(phrases.mediaId, media.id))
        .where(and(eq(media.status, "ready"), ilike(phrases.text, pattern)))
        .groupBy(phrases.text)
        .orderBy(desc(sql`count(*)`))
        .limit(12),
      db
        .select({
          id: contributors.id,
          name: contributors.name,
          relationship: contributors.relationship,
          avatarUrl: contributors.avatarUrl,
        })
        .from(contributors)
        .where(
          or(
            ilike(contributors.name, pattern),
            ilike(contributors.relationship, pattern),
          ),
        )
        .limit(12),
      db
        .select({
          id: media.id,
          blobUrl: media.blobUrl,
          posterUrl: media.posterUrl,
          caption: media.caption,
          title: media.title,
          contributorName: contributors.name,
        })
        .from(media)
        .innerJoin(contributors, eq(media.contributorId, contributors.id))
        .where(
          and(
            eq(media.kind, "image"),
            or(
              isNull(contributors.avatarUrl),
              ne(media.blobUrl, contributors.avatarUrl),
            ),
            or(
              ilike(media.caption, pattern),
              ilike(media.title, pattern),
              ilike(media.summary, pattern),
              sql`array_to_string(${media.themes}, ' ') ilike ${pattern}`,
            ),
          ),
        )
        .limit(24),
    ]);

  return {
    words: matchedWords,
    phrases: matchedPhrases,
    people: matchedPeople,
    photos: matchedPhotos,
  };
}

export async function getTranscriptPreview(mediaId: string) {
  const [row] = await db
    .select({ fullText: transcripts.fullText })
    .from(transcripts)
    .where(eq(transcripts.mediaId, mediaId))
    .limit(1);
  return row?.fullText ?? null;
}
