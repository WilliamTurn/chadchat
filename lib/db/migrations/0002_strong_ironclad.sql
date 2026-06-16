CREATE TABLE IF NOT EXISTS "UserMemory" (
	"userId" uuid PRIMARY KEY NOT NULL,
	"profile" text DEFAULT '' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "memoryEnabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserMemory" ADD CONSTRAINT "UserMemory_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
