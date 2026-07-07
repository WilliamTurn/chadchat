CREATE TABLE IF NOT EXISTS "QuitPrediction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"predictedAt" timestamp DEFAULT now() NOT NULL,
	"quitDate" timestamp NOT NULL,
	"failureMode" text NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"resolvedAt" timestamp,
	"content" json NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "QuitPrediction" ADD CONSTRAINT "QuitPrediction_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
