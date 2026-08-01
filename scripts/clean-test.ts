/**
 * Remove all is_test people, media, and related Blob files.
 *
 *   npm run seed:test:clean
 */

import { config } from "dotenv";
import { cleanTestData } from "./clean-test-data";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing");
  await cleanTestData();
  console.log("Test data cleaned.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
