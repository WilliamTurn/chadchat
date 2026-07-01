CREATE TABLE IF NOT EXISTS "WeeklyReport" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"subject" text NOT NULL,
	"content" json NOT NULL,
	"sentAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "weeklyReportsEnabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "weeklyReportDay" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "weeklyReportHour" integer DEFAULT 17 NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "timezone" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "WeeklyReport" ADD CONSTRAINT "WeeklyReport_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
