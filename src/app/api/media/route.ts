import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { contributors, media } from "@/db/schema";
import { kindFromMime } from "@/lib/media";

export const runtime = "nodejs";

const createSchema = z.object({
  token: z.string().min(1),
  blobUrl: z.string().url(),
  contentType: z.string().min(1),
  filename: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationSeconds: z.number().positive().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = createSchema.parse(json);

    const [contributor] = await db
      .select()
      .from(contributors)
      .where(eq(contributors.inviteToken, parsed.token))
      .limit(1);

    if (!contributor) {
      return NextResponse.json(
        { error: "This invite link isn't recognized" },
        { status: 404 },
      );
    }

    const existing = await db
      .select({ id: media.id })
      .from(media)
      .where(eq(media.blobUrl, parsed.blobUrl))
      .limit(1);

    if (existing[0]) {
      return NextResponse.json({ id: existing[0].id, deduped: true });
    }

    const kind = kindFromMime(parsed.contentType, parsed.filename);

    const [row] = await db
      .insert(media)
      .values({
        contributorId: contributor.id,
        blobUrl: parsed.blobUrl,
        kind,
        status: "uploaded",
        originalFilename: parsed.filename,
        width: parsed.width,
        height: parsed.height,
        durationSeconds: parsed.durationSeconds
          ? Math.round(parsed.durationSeconds)
          : null,
      })
      .returning({ id: media.id });

    return NextResponse.json({ id: row.id, deduped: false });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json(
      { error: "Couldn't save that just yet" },
      { status: 500 },
    );
  }
}
