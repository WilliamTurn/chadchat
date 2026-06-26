CREATE TABLE IF NOT EXISTS "MealPlan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"title" text NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"source" varchar DEFAULT 'chad' NOT NULL,
	"sourceChatId" uuid,
	"targetCalories" integer,
	"targetProtein" integer,
	"targetCarbs" integer,
	"targetFat" integer,
	"preferences" json NOT NULL,
	"coachIntro" text DEFAULT '' NOT NULL,
	"days" json NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "MealPlan" ADD CONSTRAINT "MealPlan_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
