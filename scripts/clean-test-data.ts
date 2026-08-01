import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { contributors, media } from "../src/db/schema";

/** Delete every contributor/media row with is_test = true, plus Blob files. */
export async function cleanTestData() {
  const testMedia = await db.select().from(media).where(eq(media.isTest, true));
  const testPeople = await db
    .select()
    .from(contributors)
    .where(eq(contributors.isTest, true));

  const urls = [
    ...new Set(
      testMedia.flatMap((row) =>
        [row.blobUrl, row.posterUrl].filter((u): u is string => !!u),
      ),
    ),
  ];

  if (urls.length > 0) {
    try {
      await del(urls);
      console.log(`Deleted ${urls.length} blob object(s).`);
    } catch (err) {
      console.warn("Blob delete warning (continuing with DB cleanup):", err);
    }
  }

  // Cascades media → transcripts/words/phrases
  for (const person of testPeople) {
    await db.delete(contributors).where(eq(contributors.id, person.id));
  }
  await db.delete(media).where(eq(media.isTest, true));

  console.log(
    `Removed ${testPeople.length} test person(s) and ${testMedia.length} test upload(s).`,
  );
}
