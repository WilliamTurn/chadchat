ALTER TABLE "User" ADD COLUMN "onboardedAt" timestamp;
--> statement-breakpoint
-- Backfill: every existing user has already been using the app, so mark them
-- onboarded. Only genuinely new signups (inserted after this migration) keep
-- the NULL default and get routed to the first-run /welcome wizard once.
UPDATE "User" SET "onboardedAt" = now() WHERE "onboardedAt" IS NULL;