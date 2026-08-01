/**
 * Apply Drizzle migrations.
 *
 * Runs automatically before `next build` on Vercel.
 * Safe to re-run; already-applied migrations are skipped.
 *
 * If the schema was previously applied with `db:push` and there is no
 * migration history yet, this baselines existing migrations so CREATE
 * TABLE isn't re-run against a live database.
 *
 *   npm run db:migrate
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const MIGRATIONS_FOLDER = join(process.cwd(), "drizzle");
const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

type Journal = {
  entries: { tag: string; when: number }[];
};

function databaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL is not set; cannot run migrations");
  }
  // Prefer the direct (non-pooler) endpoint for DDL.
  return raw.replace("-pooler", "");
}

function readJournal(): Journal {
  const path = join(MIGRATIONS_FOLDER, "meta/_journal.json");
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. Run npm run db:generate first.`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as Journal;
}

function migrationHash(tag: string): string {
  const sqlText = readFileSync(join(MIGRATIONS_FOLDER, `${tag}.sql`), "utf8");
  return createHash("sha256").update(sqlText).digest("hex");
}

// neon's tagged-template generics are awkward across package versions
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sql = any;

async function needsBaseline(sql: Sql): Promise<boolean> {
  const tables = (await sql`
    select 1 as ok
    from information_schema.tables
    where table_schema = 'public' and table_name = 'contributors'
    limit 1
  `) as { ok: number }[];
  if (tables.length === 0) return false;

  const tracked = (await sql`
    select 1 as ok
    from information_schema.tables
    where table_schema = ${MIGRATIONS_SCHEMA}
      and table_name = ${MIGRATIONS_TABLE}
    limit 1
  `) as { ok: number }[];
  if (tracked.length === 0) return true;

  const rows = (await sql`
    select count(*)::int as count
    from drizzle.__drizzle_migrations
  `) as { count: number }[];
  return (rows[0]?.count ?? 0) === 0;
}

async function baseline(sql: Sql) {
  const journal = readJournal();
  console.log(
    `Schema already exists; baselining ${journal.entries.length} migration(s) without re-applying SQL.`,
  );

  await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
  await sql`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `;

  for (const entry of journal.entries) {
    const hash = migrationHash(entry.tag);
    await sql`
      INSERT INTO drizzle.__drizzle_migrations ("hash", "created_at")
      SELECT ${hash}, ${entry.when}
      WHERE NOT EXISTS (
        SELECT 1 FROM drizzle.__drizzle_migrations
        WHERE hash = ${hash} OR created_at = ${entry.when}
      )
    `;
    console.log(`  ✓ baselined ${entry.tag}`);
  }
}

async function main() {
  if (!existsSync(join(MIGRATIONS_FOLDER, "meta/_journal.json"))) {
    console.log("No migrations folder yet; skipping.");
    return;
  }

  const url = databaseUrl();
  const sql = neon(url);

  if (await needsBaseline(sql)) {
    await baseline(sql);
    console.log("Baseline complete.");
    return;
  }

  console.log("Applying pending migrations…");
  // neon / drizzle generic defaults disagree slightly across versions
  const db = drizzle(sql as never);
  await migrate(db, {
    migrationsFolder: MIGRATIONS_FOLDER,
    migrationsSchema: MIGRATIONS_SCHEMA,
    migrationsTable: MIGRATIONS_TABLE,
  });
  console.log("Migrations complete.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
