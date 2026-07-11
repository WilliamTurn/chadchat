CREATE TABLE IF NOT EXISTS "UserUpload" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"url" text NOT NULL,
	"name" text NOT NULL,
	"contentType" varchar(128) NOT NULL,
	"size" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Document" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "Document" ADD COLUMN "category" varchar;--> statement-breakpoint
ALTER TABLE "Document" ADD COLUMN "chatId" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserUpload" ADD CONSTRAINT "UserUpload_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
