CREATE TABLE "race_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"race_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"rank" smallint NOT NULL,
	"status" text NOT NULL,
	"wpm" real NOT NULL,
	"gross_wpm" real NOT NULL,
	"accuracy" real NOT NULL,
	"errors" integer NOT NULL,
	"duration_ms" integer NOT NULL,
	"progress" real NOT NULL,
	"wpm_series" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "race_results_status_check" CHECK ("race_results"."status" in ('finished', 'unfinished', 'abandoned')),
	CONSTRAINT "race_results_progress_check" CHECK ("race_results"."progress" >= 0 and "race_results"."progress" <= 1)
);
--> statement-breakpoint
CREATE TABLE "races" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_code" text NOT NULL,
	"host_id" uuid,
	"config" jsonb NOT NULL,
	"text" text NOT NULL,
	"participant_count" smallint NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_race_id_races_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."races"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_results" ADD CONSTRAINT "race_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "races" ADD CONSTRAINT "races_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "race_results_user_created_at_idx" ON "race_results" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "race_results_race_user_idx" ON "race_results" USING btree ("race_id","user_id");