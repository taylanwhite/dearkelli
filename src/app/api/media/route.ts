import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { contributors } from "@/db/schema";
import { ensureMediaRecord } from "@/lib/ensure-media";
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
  asAvatar: z.boolean().optional(),
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

    const kind = kindFromMime(parsed.contentType, parsed.filename);

    // Profile portraits are circle-only; never add them to the album.
    if (parsed.asAvatar) {
      await db
        .update(contributors)
        .set({ avatarUrl: parsed.blobUrl })
        .where(eq(contributors.id, contributor.id));
      return NextResponse.json({ avatar: true });
    }

    const result = await ensureMediaRecord({
      contributorId: contributor.id,
      blobUrl: parsed.blobUrl,
      kind,
      originalFilename: parsed.filename,
      width: parsed.width,
      height: parsed.height,
      durationSeconds: parsed.durationSeconds,
    });

    return NextResponse.json({
      id: result.id,
      deduped: !result.created,
      processing: true,
    });
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
