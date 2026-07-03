ALTER TABLE "MealAnalysis" ADD COLUMN "mealLabel" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "soundEnabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN "hapticsEnabled" boolean DEFAULT true NOT NULL;