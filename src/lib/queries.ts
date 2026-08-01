import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  contributors,
  media,
  phrases,
  transcripts,
  words,
} from "@/db/schema";

export async function getWordStats() {
  return db
    .select({
      normalized: words.normalized,
      totalCount: sql<number>`count(*)::int`,
      contributorCount: sql<number>`count(distinct ${words.contributorId})::int`,
      mediaCount: sql<number>`count(distinct ${words.mediaId})::int`,
    })
    .from(words)
    .innerJoin(media, eq(words.mediaId, media.id))
    .where(eq(media.status, "ready"))
    .groupBy(words.normalized)
    .orderBy(desc(sql`count(*)`));
}

export async function getPhraseStats() {
  return db
    .select({
      text: phrases.text,
      totalCount: sql<number>`count(*)::int`,
    })
    .from(phrases)
    .innerJoin(media, eq(phrases.mediaId, media.id))
    .where(eq(media.status, "ready"))
    .groupBy(phrases.text)
    .orderBy(desc(sql`count(*)`));
}

export async function getWordOccurrences(normalized: string) {
  return db
    .select({
      wordId: words.id,
      raw: words.raw,
      startMs: words.startMs,
      endMs: words.endMs,
      mediaId: media.id,
      blobUrl: media.blobUrl,
      kind: media.kind,
      posterUrl: media.posterUrl,
      title: media.title,
      contributorId: contributors.id,
      contributorName: contributors.name,
      relationship: contributors.relationship,
      avatarUrl: contributors.avatarUrl,
    })
    .from(words)
    .innerJoin(media, eq(words.mediaId, media.id))
    .innerJoin(contributors, eq(words.contributorId, contributors.id))
    .where(and(eq(words.normalized, normalized), eq(media.status, "ready")))
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
      title: media.title,
      contributorId: contributors.id,
      contributorName: contributors.name,
      relationship: contributors.relationship,
      avatarUrl: contributors.avatarUrl,
    })
    .from(phrases)
    .innerJoin(media, eq(phrases.mediaId, media.id))
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
    .leftJoin(
      media,
      and(eq(media.contributorId, contributors.id), eq(media.status, "ready")),
    )
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

  const clips = await db
    .select()
    .from(media)
    .where(and(eq(media.contributorId, id), eq(media.status, "ready")))
    .orderBy(desc(media.createdAt));

  const topWords = await db
    .select({
      normalized: words.normalized,
      totalCount: sql<number>`count(*)::int`,
    })
    .from(words)
    .innerJoin(media, eq(words.mediaId, media.id))
    .where(and(eq(words.contributorId, id), eq(media.status, "ready")))
    .groupBy(words.normalized)
    .orderBy(desc(sql`count(*)`))
    .limit(24);

  return { person, clips, topWords };
}

export async function getPhotos(contributorId?: string) {
  const conditions = [eq(media.kind, "image"), eq(media.status, "ready")];
  if (contributorId) {
    conditions.push(eq(media.contributorId, contributorId));
  }

  return db
    .select({
      id: media.id,
      blobUrl: media.blobUrl,
      posterUrl: media.posterUrl,
      caption: media.caption,
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
            or(ilike(words.normalized, pattern), ilike(words.raw, pattern)),
          ),
        )
        .groupBy(words.normalized)
        .orderBy(desc(sql`count(*)`))
        .limit(20),
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
            eq(media.status, "ready"),
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
