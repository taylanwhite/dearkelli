import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { media } from "../src/db/schema";
import { processMediaById } from "../src/lib/process-media";
import { getWordStats } from "../src/lib/queries";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const rows = await db.select({ id: media.id, kind: media.kind, file: media.originalFilename }).from(media);
  console.log(`Reprocessing ${rows.length} item(s) so theme-fit curation runs…`);
  for (const r of rows) {
    await db
      .update(media)
      .set({ status: "uploaded", processingError: null })
      .where(eq(media.id, r.id));
    const res = await processMediaById(r.id);
    console.log(`  ${r.kind.padEnd(6)} ${r.file}: ${res.status}${res.error ? ` (${res.error})` : ""}`);
  }

  console.log("\nWord cloud now shows:");
  const stats = await getWordStats();
  for (const s of stats) {
    console.log(`  ${s.normalized}  (x${s.totalCount}, ${s.mediaCount} media)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
