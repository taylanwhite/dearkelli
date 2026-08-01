import { count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  contributors,
  media,
  phrases,
  transcripts,
  words,
} from "@/db/schema";

export async function getAdminOverview() {
  const [
    [peopleRow],
    [uploadsRow],
    statusRows,
    [wordsRow],
    [uniqueWordsRow],
    [phrasesRow],
    [transcriptsRow],
    topWords,
    recentUploads,
  ] = await Promise.all([
    db.select({ value: count() }).from(contributors),
    db.select({ value: count() }).from(media),
    db
      .select({ status: media.status, value: count() })
      .from(media)
      .groupBy(media.status),
    db.select({ value: count() }).from(words),
    db
      .select({ value: sql<number>`count(distinct ${words.normalized})::int` })
      .from(words),
    db.select({ value: count() }).from(phrases),
    db.select({ value: count() }).from(transcripts),
    db
      .select({
        normalized: words.normalized,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(words)
      .groupBy(words.normalized)
      .orderBy(desc(sql`count(*)`))
      .limit(20),
    db
      .select({
        id: media.id,
        kind: media.kind,
        status: media.status,
        title: media.title,
        originalFilename: media.originalFilename,
        createdAt: media.createdAt,
        contributorName: contributors.name,
      })
      .from(media)
      .innerJoin(contributors, eq(media.contributorId, contributors.id))
      .orderBy(desc(media.createdAt))
      .limit(12),
  ]);

  const byStatus = Object.fromEntries(
    statusRows.map((r) => [r.status, r.value]),
  ) as Record<string, number>;

  return {
    counts: {
      people: peopleRow?.value ?? 0,
      uploads: uploadsRow?.value ?? 0,
      uploaded: byStatus.uploaded ?? 0,
      processing: byStatus.processing ?? 0,
      ready: byStatus.ready ?? 0,
      failed: byStatus.failed ?? 0,
      words: wordsRow?.value ?? 0,
      uniqueWords: uniqueWordsRow?.value ?? 0,
      phrases: phrasesRow?.value ?? 0,
      transcripts: transcriptsRow?.value ?? 0,
    },
    topWords,
    recentUploads,
  };
}

export async function getAdminPeople() {
  return db
    .select({
      id: contributors.id,
      name: contributors.name,
      relationship: contributors.relationship,
      inviteToken: contributors.inviteToken,
      isTest: contributors.isTest,
      createdAt: contributors.createdAt,
      uploadCount: sql<number>`count(${media.id})::int`,
      readyCount: sql<number>`count(*) filter (where ${media.status} = 'ready')::int`,
      pendingCount: sql<number>`count(*) filter (where ${media.status} in ('uploaded', 'processing'))::int`,
      failedCount: sql<number>`count(*) filter (where ${media.status} = 'failed')::int`,
    })
    .from(contributors)
    .leftJoin(media, eq(media.contributorId, contributors.id))
    .groupBy(contributors.id)
    .orderBy(contributors.name);
}

export async function getAdminMedia() {
  return db
    .select({
      id: media.id,
      kind: media.kind,
      status: media.status,
      title: media.title,
      summary: media.summary,
      blobUrl: media.blobUrl,
      posterUrl: media.posterUrl,
      originalFilename: media.originalFilename,
      durationSeconds: media.durationSeconds,
      themes: media.themes,
      tags: media.tags,
      caption: media.caption,
      isTest: media.isTest,
      createdAt: media.createdAt,
      contributorId: contributors.id,
      contributorName: contributors.name,
    })
    .from(media)
    .innerJoin(contributors, eq(media.contributorId, contributors.id))
    .orderBy(desc(media.createdAt));
}
