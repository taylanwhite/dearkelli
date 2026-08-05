import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { media, phrases, transcripts, words } from "@/db/schema";
import { scheduleMediaProcessing } from "@/lib/enqueue-process";
import { correctKelliSpelling } from "@/lib/words";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  status: z.enum(["uploaded", "processing", "ready", "failed"]).optional(),
  title: z.string().trim().max(120).nullable().optional(),
  summary: z.string().trim().max(800).nullable().optional(),
  requeue: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;

  try {
    const body = updateSchema.parse(await request.json());

    const [existing] = await db
      .select()
      .from(media)
      .where(eq(media.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (body.requeue) {
      await db.delete(words).where(eq(words.mediaId, id));
      await db.delete(phrases).where(eq(phrases.mediaId, id));
      await db.delete(transcripts).where(eq(transcripts.mediaId, id));
    }

    const [updated] = await db
      .update(media)
      .set({
        status: body.requeue
          ? "uploaded"
          : (body.status ?? existing.status),
        processingError: body.requeue
          ? null
          : existing.processingError,
        title:
          body.title === undefined
            ? existing.title
            : body.title === null
              ? null
              : correctKelliSpelling(body.title),
        summary:
          body.summary === undefined
            ? existing.summary
            : body.summary === null
              ? null
              : correctKelliSpelling(body.summary),
      })
      .where(eq(media.id, id))
      .returning();

    if (body.requeue) {
      scheduleMediaProcessing(id);
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    return NextResponse.json({ error: "Couldn't update." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;

  const [existing] = await db
    .select({ id: media.id })
    .from(media)
    .where(eq(media.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.delete(media).where(eq(media.id, id));
  return NextResponse.json({ ok: true });
}
