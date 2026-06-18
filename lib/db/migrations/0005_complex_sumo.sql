CREATE TABLE IF NOT EXISTS "MealAnalysis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"kind" varchar DEFAULT 'meal' NOT NULL,
	"photoUrl" text NOT NULL,
	"title" text NOT NULL,
	"calories" double precision,
	"protein" double precision,
	"carbs" double precision,
	"fat" double precision,
	"healthScore" integer,
	"verdict" text NOT NULL,
	"items" json NOT NULL,
	"tips" json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "NutritionTarget" (
	"userId" uuid PRIMARY KEY NOT NULL,
	"calories" integer,
	"protein" integer,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "MealAnalysis" ADD CONSTRAINT "MealAnalysis_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "NutritionTarget" ADD CONSTRAINT "NutritionTarget_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
