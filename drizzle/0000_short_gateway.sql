CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"username" text,
	"display_name" text NOT NULL,
	"password_hash" text,
	"keyboard_layout" text DEFAULT 'qwerty' NOT NULL,
	"locale" text DEFAULT 'fr' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	CONSTRAINT "users_kind_check" CHECK ("users"."kind" in ('member', 'guest')),
	CONSTRAINT "users_keyboard_layout_check" CHECK ("users"."keyboard_layout" in ('qwerty', 'azerty', 'cmf')),
	CONSTRAINT "users_locale_check" CHECK ("users"."locale" in ('fr', 'en')),
	CONSTRAINT "users_username_length_check" CHECK (char_length("users"."username") <= 20),
	CONSTRAINT "users_display_name_length_check" CHECK (char_length("users"."display_name") <= 40),
	CONSTRAINT "users_kind_columns_check" CHECK (("users"."kind" = 'member' and "users"."username" is not null and "users"."password_hash" is not null)
        or ("users"."kind" = 'guest' and "users"."username" is null and "users"."password_hash" is null and "users"."expires_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_idx" ON "users" USING btree (lower("username"));--> statement-breakpoint
CREATE INDEX "users_guest_expires_at_idx" ON "users" USING btree ("expires_at") WHERE "users"."kind" = 'guest';