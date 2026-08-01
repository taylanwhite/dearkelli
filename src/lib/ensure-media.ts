import { eq } from "drizzle-orm";
import { db } from "@/db";
import { media } from "@/db/schema";
import { scheduleMediaProcessing } from "@/lib/enqueue-process";

type CreateMediaInput = {
  contributorId: string;
  blobUrl: string;
  kind: "video" | "audio" | "image";
  originalFilename?: string | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
};

/**
 * Create a media row for a blob, or reuse one if the webhook and client
 * both race to register the same upload.
 */
export async function ensureMediaRecord(input: CreateMediaInput) {
  const existing = await db
    .select({ id: media.id, status: media.status })
    .from(media)
    .where(eq(media.blobUrl, input.blobUrl))
    .limit(1);

  if (existing[0]) {
    if (
      existing[0].status === "uploaded" ||
      existing[0].status === "failed"
    ) {
      scheduleMediaProcessing(existing[0].id);
    }
    return { id: existing[0].id, created: false };
  }

  try {
    const [row] = await db
      .insert(media)
      .values({
        contributorId: input.contributorId,
        blobUrl: input.blobUrl,
        kind: input.kind,
        status: "uploaded",
        originalFilename: input.originalFilename ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        durationSeconds:
          input.durationSeconds != null
            ? Math.round(input.durationSeconds)
            : null,
      })
      .onConflictDoNothing({ target: media.blobUrl })
      .returning({ id: media.id });

    if (row) {
      scheduleMediaProcessing(row.id);
      return { id: row.id, created: true };
    }
  } catch (error) {
    // Unique races that slip past onConflict still fall through to select.
    console.error("ensureMediaRecord insert race", error);
  }

  const [fallback] = await db
    .select({ id: media.id, status: media.status })
    .from(media)
    .where(eq(media.blobUrl, input.blobUrl))
    .limit(1);

  if (!fallback) {
    throw new Error("Couldn't save that upload");
  }

  if (fallback.status === "uploaded" || fallback.status === "failed") {
    scheduleMediaProcessing(fallback.id);
  }

  return { id: fallback.id, created: false };
}
