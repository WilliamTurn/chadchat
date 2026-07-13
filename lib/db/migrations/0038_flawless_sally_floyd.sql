CREATE TABLE IF NOT EXISTS "ExerciseAlias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid,
	"alias" text NOT NULL,
	"canonicalName" text NOT NULL,
	"source" varchar DEFAULT 'member' NOT NULL,
	"status" varchar DEFAULT 'proposed' NOT NULL,
	"confidence" varchar,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"decidedAt" timestamp
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ExerciseAlias" ADD CONSTRAINT "ExerciseAlias_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
