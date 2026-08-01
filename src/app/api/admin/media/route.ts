import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { contributors, media } from "@/db/schema";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const rows = await db
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
      caption: media.caption,
      createdAt: media.createdAt,
      contributorId: contributors.id,
      contributorName: contributors.name,
      contributorAvatarUrl: contributors.avatarUrl,
    })
    .from(media)
    .innerJoin(contributors, eq(media.contributorId, contributors.id))
    .orderBy(desc(media.createdAt));

  const filtered =
    status && status !== "all"
      ? rows.filter((r) => r.status === status)
      : rows;

  return NextResponse.json({ media: filtered });
}
