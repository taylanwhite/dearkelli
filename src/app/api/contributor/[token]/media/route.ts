import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { contributors, media } from "@/db/schema";
import { playableUrl } from "@/lib/blob";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;

  const [contributor] = await db
    .select({
      id: contributors.id,
      avatarUrl: contributors.avatarUrl,
    })
    .from(contributors)
    .where(eq(contributors.inviteToken, token))
    .limit(1);

  if (!contributor) {
    return NextResponse.json(
      { error: "This invite link isn't recognized" },
      { status: 404 },
    );
  }

  const rows = await db
    .select({
      id: media.id,
      kind: media.kind,
      status: media.status,
      blobUrl: media.blobUrl,
      posterUrl: media.posterUrl,
      playbackUrl: media.playbackUrl,
      originalFilename: media.originalFilename,
      title: media.title,
      caption: media.caption,
      summary: media.summary,
      tags: media.tags,
      themes: media.themes,
      createdAt: media.createdAt,
    })
    .from(media)
    .where(eq(media.contributorId, contributor.id))
    .orderBy(desc(media.createdAt));

  return NextResponse.json({
    avatarUrl: contributor.avatarUrl,
    media: rows.map((row) => {
      const previewSource =
        row.kind === "image"
          ? row.posterUrl || row.blobUrl
          : row.kind === "video"
            ? row.playbackUrl || row.blobUrl
            : row.blobUrl;

      return {
        ...row,
        tags: row.tags || [],
        themes: row.themes || [],
        previewUrl: playableUrl(previewSource, { token }),
        posterPreviewUrl: row.posterUrl
          ? playableUrl(row.posterUrl, { token })
          : null,
        isAvatar: Boolean(
          contributor.avatarUrl && contributor.avatarUrl === row.blobUrl,
        ),
      };
    }),
  });
}
