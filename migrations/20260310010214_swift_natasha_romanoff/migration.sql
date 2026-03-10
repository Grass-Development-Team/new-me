CREATE TABLE "platform_users" (
	"platform" text,
	"user_id" text,
	CONSTRAINT "platform_user_id" PRIMARY KEY("platform","user_id")
);
--> statement-breakpoint
CREATE TABLE "user_platform_relations" (
	"user_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"platform_uid" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY,
	"score" integer DEFAULT 10 NOT NULL,
	"last_interaction" timestamp,
	"summary" text
);
--> statement-breakpoint
ALTER TABLE "user_platform_relations" ADD CONSTRAINT "user_platform_relation_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "user_platform_relations" ADD CONSTRAINT "user_platform_relation_platform_user_fk" FOREIGN KEY ("platform","platform_uid") REFERENCES "platform_users"("platform","user_id");