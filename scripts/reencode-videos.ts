/**
 * Rebuild the H.264 web-playback file for videos that don't have one.
 *
 * iPhone videos upload as HEVC (H.265) .mov. Safari plays HEVC, but Chrome
 * (and most Android browsers) cannot decode it — you get a poster frame and a
 * dead play button. Our pipeline transcodes each video to a compact H.264 mp4
 * (`playbackUrl`) that every browser can play. Any video missing that file
 * falls back to the raw HEVC original and won't play for most people.
 *
 * This reruns the transcode locally (ffmpeg on your machine — no serverless
 * time limits) for every video that has no playbackUrl.
 *
 *   npm run reencode                 # all videos missing an H.264 playback
 *   npm run reencode -- --id=UUID    # just one
 *   npm run reencode -- --all        # force re-encode every video
 *
 * Run it against production by pointing DATABASE_URL / BLOB_READ_WRITE_TOKEN /
 * OPENAI_API_KEY at your prod values (e.g. `vercel env pull`).
 */

import { config } from "dotenv";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../src/db";
import { media } from "../src/db/schema";
import { processMediaById } from "../src/lib/process-media";

config({ path: ".env.local" });
config();

function arg(name: string): string | undefined {
  const match = process.argv.find((a) => a.startsWith(`--${name}=`));
  return match?.split("=").slice(1).join("=");
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY missing");
  if (!process.env.BLOB_READ_WRITE_TOKEN)
    throw new Error("BLOB_READ_WRITE_TOKEN missing");

  const id = arg("id");
  const force = hasFlag("all");

  const where = id
    ? eq(media.id, id)
    : force
      ? eq(media.kind, "video")
      : // default: videos still missing an H.264 playback file
        and(eq(media.kind, "video"), isNull(media.playbackUrl));

  const targets = await db
    .select({ id: media.id, originalFilename: media.originalFilename })
    .from(media)
    .where(where)
    .orderBy(desc(media.createdAt));

  if (targets.length === 0) {
    console.log("No videos need re-encoding. 🎉");
    return;
  }

  console.log(`Re-encoding ${targets.length} video(s)…`);
  for (const item of targets) {
    console.log(`→ ${item.id} ${item.originalFilename ?? ""}`);
    // Requeue: processMediaById skips fully-ready items, so reset status first.
    await db
      .update(media)
      .set({ status: "uploaded", processingError: null })
      .where(eq(media.id, item.id));

    const result = await processMediaById(item.id);
    console.log(
      result.ok
        ? `  ✓ ${result.status}${result.error ? ` (${result.error})` : ""}`
        : `  ✗ ${result.error}`,
    );
  }
  console.log("Done. Reload the page (hard refresh) to pick up new playback URLs.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
