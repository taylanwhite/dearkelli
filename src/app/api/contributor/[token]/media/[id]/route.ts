import { del } from "@vercel/blob";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { contributors, media } from "@/db/schema";
import { syncMediaTags } from "@/lib/sync-tags";

export const runtime = "nodejs";

type Params = { params: Promise<{ token: string; id: string }> };

const updateSchema = z
  .object({
    tags: z.array(z.string().trim().min(1).max(40)).max(24).optional(),
    /** Optional note from the contributor (photos/videos). Empty clears it. */
    summary: z.string().trim().max(280).nullable().optional(),
  })
  .refine(
    (body) => body.tags !== undefined || body.summary !== undefined,
    { message: "Nothing to update" },
  );

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
      .select({
        id: media.id,
        contributorId: media.contributorId,
        kind: media.kind,
      })
      .from(media)
      .where(and(eq(media.id, id), eq(media.contributorId, contributor.id)))
      .limit(1);

    if (!item) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const response: {
      id: string;
      tags?: string[];
      summary?: string | null;
    } = { id: item.id };

    if (body.summary !== undefined) {
      if (item.kind === "audio") {
        return NextResponse.json(
          { error: "Voice notes don't take a written summary" },
          { status: 400 },
        );
      }

      const note = body.summary?.trim() ? body.summary.trim().slice(0, 280) : null;
      await db
        .update(media)
        .set(
          item.kind === "image"
            ? { summary: note, caption: note }
            : { summary: note },
        )
        .where(eq(media.id, item.id));
      response.summary = note;
    }

    if (body.tags !== undefined) {
      const tags = await syncMediaTags({
        mediaId: item.id,
        contributorId: item.contributorId,
        tags: body.tags,
      });
      response.tags = tags;
    }

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Couldn't save that" },
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

  const urls = [item.blobUrl, item.posterUrl, item.playbackUrl].filter(
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
