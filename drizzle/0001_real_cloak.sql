CREATE TABLE "oauth_accounts" (
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id"),
	CONSTRAINT "oauth_accounts_provider_check" CHECK ("oauth_accounts"."provider" in ('github', 'discord'))
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_kind_columns_check";--> statement-breakpoint
ALTER TABLE "oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "oauth_accounts_user_id_idx" ON "oauth_accounts" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_kind_columns_check" CHECK (("users"."kind" = 'member' and "users"."username" is not null)
        or ("users"."kind" = 'guest' and "users"."username" is null and "users"."password_hash" is null and "users"."expires_at" is not null));