import { config } from "dotenv";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { media, transcripts } from "../src/db/schema";
import { processMediaById } from "../src/lib/process-media";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const rows = await db
    .select({ id: media.id, kind: media.kind, file: media.originalFilename })
    .from(media)
    .where(inArray(media.kind, ["audio", "video"]));

  console.log(`Reprocessing ${rows.length} AV item(s) for timed captions…`);
  for (const r of rows) {
    await db
      .update(media)
      .set({ status: "uploaded", processingError: null })
      .where(eq(media.id, r.id));
    const res = await processMediaById(r.id);
    console.log(
      `  ${r.kind} ${r.file}: ${res.status}${res.error ? ` (${res.error})` : ""}`,
    );
  }

  const caps = await db
    .select({
      mediaId: transcripts.mediaId,
      fullText: transcripts.fullText,
      timedWords: transcripts.timedWords,
    })
    .from(transcripts);

  console.log("\nTimed captions:");
  for (const c of caps) {
    const n = c.timedWords?.length ?? 0;
    console.log(
      `  ${c.mediaId.slice(0, 8)}…  "${(c.fullText || "").slice(0, 60)}"  (${n} timed words)`,
    );
    if (c.timedWords?.length) {
      console.log(
        "   ",
        c.timedWords.map((w) => `${w.raw}@${w.startMs}`).join(" "),
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
