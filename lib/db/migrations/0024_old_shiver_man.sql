ALTER TABLE "User" ADD COLUMN "checkInDays" json DEFAULT '[1,3,5]'::json NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "checkInMorningHour" integer DEFAULT 7 NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "checkInEveningHour" integer DEFAULT 20 NOT NULL;