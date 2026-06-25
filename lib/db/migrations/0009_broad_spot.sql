ALTER TABLE "MealAnalysis" ADD COLUMN IF NOT EXISTS "recordedAt" timestamp;--> statement-breakpoint
UPDATE "MealAnalysis" SET "recordedAt" = "createdAt" WHERE "recordedAt" IS NULL;