CREATE TABLE "text_passages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"language" text NOT NULL,
	"content" text NOT NULL,
	"source" text,
	CONSTRAINT "text_passages_language_check" CHECK ("text_passages"."language" in ('fr', 'en'))
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "text_passages_language_content_idx" ON "text_passages" USING btree ("language","content");