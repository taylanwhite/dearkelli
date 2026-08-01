ALTER TABLE "media" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "last_viewed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "media_view_count_idx" ON "media" USING btree ("view_count");
