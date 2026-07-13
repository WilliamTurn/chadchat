CREATE TABLE IF NOT EXISTS "GoalOutcome" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goalId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"metricId" text,
	"metricRef" text,
	"label" text,
	"startValue" double precision,
	"targetValue" double precision,
	"currentValue" double precision,
	"unit" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PlanSession" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"name" text NOT NULL,
	"weekday" integer,
	"active" boolean DEFAULT true NOT NULL,
	"sourceHash" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PlanSessionCompletion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"planId" uuid NOT NULL,
	"planSessionId" uuid NOT NULL,
	"workoutId" uuid NOT NULL,
	"sessionName" text NOT NULL,
	"completedDay" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PlanSessionExercise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planSessionId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"exerciseName" text NOT NULL,
	"sets" integer NOT NULL,
	"reps" text NOT NULL,
	"weight" double precision,
	"unit" varchar DEFAULT 'lb' NOT NULL,
	"note" text,
	"restSeconds" integer,
	"supersetGroup" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PlanSessionSet" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"planSessionExerciseId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"type" varchar DEFAULT 'normal' NOT NULL,
	"reps" integer,
	"repRangeStart" integer,
	"repRangeEnd" integer,
	"weight" double precision,
	"durationSeconds" integer,
	"rpe" double precision,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "GoalOutcome" ADD CONSTRAINT "GoalOutcome_goalId_Goal_id_fk" FOREIGN KEY ("goalId") REFERENCES "public"."Goal"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "GoalOutcome" ADD CONSTRAINT "GoalOutcome_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PlanSession" ADD CONSTRAINT "PlanSession_planId_Plan_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PlanSession" ADD CONSTRAINT "PlanSession_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PlanSessionCompletion" ADD CONSTRAINT "PlanSessionCompletion_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PlanSessionCompletion" ADD CONSTRAINT "PlanSessionCompletion_planId_Plan_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."Plan"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PlanSessionCompletion" ADD CONSTRAINT "PlanSessionCompletion_planSessionId_PlanSession_id_fk" FOREIGN KEY ("planSessionId") REFERENCES "public"."PlanSession"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PlanSessionCompletion" ADD CONSTRAINT "PlanSessionCompletion_workoutId_Workout_id_fk" FOREIGN KEY ("workoutId") REFERENCES "public"."Workout"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PlanSessionExercise" ADD CONSTRAINT "PlanSessionExercise_planSessionId_PlanSession_id_fk" FOREIGN KEY ("planSessionId") REFERENCES "public"."PlanSession"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PlanSessionExercise" ADD CONSTRAINT "PlanSessionExercise_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PlanSessionSet" ADD CONSTRAINT "PlanSessionSet_planSessionExerciseId_PlanSessionExercise_id_fk" FOREIGN KEY ("planSessionExerciseId") REFERENCES "public"."PlanSessionExercise"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "PlanSessionSet" ADD CONSTRAINT "PlanSessionSet_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "PlanSession_planId_position_unique" ON "PlanSession" USING btree ("planId","position");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "PlanSessionCompletion_workoutId_unique" ON "PlanSessionCompletion" USING btree ("workoutId");