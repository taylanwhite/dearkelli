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
      originalFilename: media.originalFilename,
      title: media.title,
      createdAt: media.createdAt,
    })
    .from(media)
    .where(eq(media.contributorId, contributor.id))
    .orderBy(desc(media.createdAt));

  return NextResponse.json({
    avatarUrl: contributor.avatarUrl,
    media: rows.map((row) => ({
      ...row,
      previewUrl: playableUrl(row.posterUrl || row.blobUrl),
      isAvatar: Boolean(
        contributor.avatarUrl && contributor.avatarUrl === row.blobUrl,
      ),
    })),
  });
}
