CREATE TABLE IF NOT EXISTS "CheckIn" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"slot" varchar NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"sentAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "checkInsEnabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "checkInFrequency" varchar DEFAULT 'daily' NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
