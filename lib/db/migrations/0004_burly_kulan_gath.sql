CREATE TABLE IF NOT EXISTS "ProgressEntry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"recordedAt" timestamp NOT NULL,
	"weight" double precision,
	"unit" varchar DEFAULT 'lb' NOT NULL,
	"photoUrl" text,
	"note" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ProgressEntry" ADD CONSTRAINT "ProgressEntry_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
