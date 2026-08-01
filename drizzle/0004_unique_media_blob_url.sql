-- Vercel Blob webhook + client /api/media can both insert the same upload.
-- Collapse existing dupes, then enforce uniqueness on blob_url.
DELETE FROM "media" a
USING "media" b
WHERE a.blob_url = b.blob_url
  AND a.ctid > b.ctid;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_blob_url_unique" UNIQUE("blob_url");
