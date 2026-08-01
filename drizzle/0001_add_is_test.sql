ALTER TABLE "contributors" ADD COLUMN "is_test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD COLUMN "is_test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "contributors_is_test_idx" ON "contributors" USING btree ("is_test");--> statement-breakpoint
CREATE INDEX "media_is_test_idx" ON "media" USING btree ("is_test");