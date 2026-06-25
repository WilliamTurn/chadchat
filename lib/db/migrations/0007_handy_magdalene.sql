CREATE TABLE IF NOT EXISTS "BodyMeasurement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"recordedAt" timestamp NOT NULL,
	"kind" varchar NOT NULL,
	"value" double precision NOT NULL,
	"unit" varchar DEFAULT 'in' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Goal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"title" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"targetDate" text,
	"status" varchar DEFAULT 'active' NOT NULL,
	"source" varchar DEFAULT 'user' NOT NULL,
	"sourceChatId" uuid,
	"metric" varchar,
	"startValue" double precision,
	"targetValue" double precision,
	"unit" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"title" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"kind" varchar DEFAULT 'training' NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"source" varchar DEFAULT 'user' NOT NULL,
	"sourceChatId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "WaterLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"recordedAt" timestamp NOT NULL,
	"amountMl" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "MealAnalysis" ALTER COLUMN "photoUrl" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "MealAnalysis" ALTER COLUMN "verdict" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "MealAnalysis" ADD COLUMN IF NOT EXISTS "source" varchar DEFAULT 'photo' NOT NULL;--> statement-breakpoint
ALTER TABLE "MealAnalysis" ADD COLUMN IF NOT EXISTS "meal" varchar;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "BodyMeasurement" ADD CONSTRAINT "BodyMeasurement_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Plan" ADD CONSTRAINT "Plan_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "WaterLog" ADD CONSTRAINT "WaterLog_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
