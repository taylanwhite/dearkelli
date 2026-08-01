import { del } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { contributors, media } from "@/db/schema";
import { syncMediaTags } from "@/lib/sync-tags";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string; id: string }> };

const updateSchema = z.object({
  tags: z.array(z.string().trim().min(1).max(40)).max(24),
});

export async function PATCH(request: Request, { params }: Params) {
  const { token, id } = await params;

  try {
    const body = updateSchema.parse(await request.json());

    const [contributor] = await db
      .select({ id: contributors.id })
      .from(contributors)
      .where(eq(contributors.inviteToken, token))
      .limit(1);

    if (!contributor) {
      return NextResponse.json(
        { error: "This invite link isn't recognized" },
        { status: 404 },
      );
    }

    const [item] = await db
      .select({ id: media.id, contributorId: media.contributorId })
      .from(media)
      .where(and(eq(media.id, id), eq(media.contributorId, contributor.id)))
      .limit(1);

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const tags = await syncMediaTags({
      mediaId: item.id,
      contributorId: item.contributorId,
      tags: body.tags,
    });

    return NextResponse.json({ id: item.id, tags });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid tags" }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Couldn't save those words" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { token, id } = await params;

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

  const [item] = await db
    .select()
    .from(media)
    .where(and(eq(media.id, id), eq(media.contributorId, contributor.id)))
    .limit(1);

  if (!item) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const urls = [item.blobUrl, item.posterUrl].filter(
    (url): url is string => Boolean(url),
  );

  await db.delete(media).where(eq(media.id, id));

  if (contributor.avatarUrl && contributor.avatarUrl === item.blobUrl) {
    await db
      .update(contributors)
      .set({ avatarUrl: null })
      .where(eq(contributors.id, contributor.id));
  }

  try {
    if (urls.length > 0) {
      await del(urls);
    }
  } catch (error) {
    console.error("Blob delete failed", error);
  }

  return NextResponse.json({ ok: true });
}
