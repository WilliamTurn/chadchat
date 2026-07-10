CREATE TABLE IF NOT EXISTS "FutureYouForecast" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"goalId" uuid NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"sourcePhotoUrls" json NOT NULL,
	"content" json,
	"error" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "FutureYouForecast" ADD CONSTRAINT "FutureYouForecast_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "FutureYouForecast" ADD CONSTRAINT "FutureYouForecast_goalId_Goal_id_fk" FOREIGN KEY ("goalId") REFERENCES "public"."Goal"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
