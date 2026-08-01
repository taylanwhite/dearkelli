/**
 * Manual / batch processing (same pipeline as auto-process on upload).
 *
 *   npm run process              # all status=uploaded
 *   npm run process -- --id=UUID
 *   npm run process -- --failed
 */

import { config } from "dotenv";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { media, type Media } from "../src/db/schema";
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
  const statuses = hasFlag("failed")
    ? (["failed"] as const)
    : hasFlag("all")
      ? (["uploaded", "failed"] as const)
      : (["uploaded"] as const);

  let items: Media[];
  if (id) {
    // Force requeue ready items when targeting by id
    await db
      .update(media)
      .set({ status: "uploaded" })
      .where(eq(media.id, id));
    items = await db.select().from(media).where(eq(media.id, id));
  } else {
    items = await db
      .select()
      .from(media)
      .where(inArray(media.status, [...statuses]));
  }

  if (items.length === 0) {
    console.log("Nothing to process.");
    return;
  }

  console.log(`Processing ${items.length} item(s)…`);
  for (const item of items) {
    console.log(`→ ${item.id} (${item.kind}) ${item.originalFilename || ""}`);
    const result = await processMediaById(item.id);
    console.log(
      result.ok ? `✓ ${result.status} ${item.id}` : `✗ ${result.error}`,
    );
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
