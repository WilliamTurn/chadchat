ALTER TABLE "CustomExercise" ADD COLUMN "kind" varchar DEFAULT 'weighted' NOT NULL;--> statement-breakpoint
ALTER TABLE "CustomExercise" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "Plan" ADD COLUMN "days" json;--> statement-breakpoint
ALTER TABLE "WorkoutExercise" ADD COLUMN "kind" varchar;