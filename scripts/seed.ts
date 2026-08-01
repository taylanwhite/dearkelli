/**
 * Seed invite links for family & friends.
 *
 *   npm run seed
 *
 * Prints shareable /send/[token] URLs.
 */

import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { contributors } from "../src/db/schema";

config({ path: ".env.local" });
config();

function token() {
  return randomBytes(9).toString("base64url");
}

/** Edit this list before running. */
const PEOPLE: { name: string; relationship?: string; token?: string }[] = [
  { name: "Mom", relationship: "Mom" },
  { name: "Dad", relationship: "Dad" },
  // Add everyone else here…
];

const GENERIC_TOKEN = "open-kelli";

async function upsertByToken(input: {
  name: string;
  relationship?: string | null;
  inviteToken: string;
}) {
  const [existing] = await db
    .select()
    .from(contributors)
    .where(eq(contributors.inviteToken, input.inviteToken))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(contributors)
      .set({
        name: input.name,
        relationship: input.relationship ?? null,
      })
      .where(eq(contributors.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(contributors)
    .values({
      name: input.name,
      relationship: input.relationship ?? null,
      inviteToken: input.inviteToken,
    })
    .returning();
  return created;
}

async function upsertByName(input: {
  name: string;
  relationship?: string | null;
  inviteToken?: string;
}) {
  const [existing] = await db
    .select()
    .from(contributors)
    .where(eq(contributors.name, input.name))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(contributors)
      .set({
        relationship: input.relationship ?? existing.relationship,
      })
      .where(eq(contributors.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(contributors)
    .values({
      name: input.name,
      relationship: input.relationship ?? null,
      inviteToken: input.inviteToken || token(),
    })
    .returning();
  return created;
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");

  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";

  console.log("Seeding contributors…\n");

  const generic = await upsertByToken({
    name: "Someone who loves Kelli",
    relationship: null,
    inviteToken: GENERIC_TOKEN,
  });
  console.log(`Generic fallback`);
  console.log(`  ${generic.name}`);
  console.log(`  ${base}/send/${generic.inviteToken}\n`);

  for (const person of PEOPLE) {
    const row = person.token
      ? await upsertByToken({
          name: person.name,
          relationship: person.relationship,
          inviteToken: person.token,
        })
      : await upsertByName({
          name: person.name,
          relationship: person.relationship,
        });
    console.log(row.name + (row.relationship ? ` (${row.relationship})` : ""));
    console.log(`  ${base}/send/${row.inviteToken}\n`);
  }

  console.log(
    "Done. Share the personal links; keep the open-kelli link as backup.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
