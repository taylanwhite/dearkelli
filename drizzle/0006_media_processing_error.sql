ALTER TABLE "media" ADD COLUMN "processing_error" text;--> statement-breakpoint
-- AI failure must never hide a memory; promote old failures to visible.
UPDATE "media"
SET
  "status" = 'ready',
  "processing_error" = COALESCE(
    "processing_error",
    'Previously failed AI processing. Requeue to try again.'
  )
WHERE "status" = 'failed';
