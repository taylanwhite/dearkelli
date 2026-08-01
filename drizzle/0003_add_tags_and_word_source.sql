ALTER TABLE "media" ADD COLUMN "tags" text[];--> statement-breakpoint
ALTER TABLE "words" ADD COLUMN "source" text DEFAULT 'speech' NOT NULL;--> statement-breakpoint
CREATE INDEX "words_source_idx" ON "words" USING btree ("source");