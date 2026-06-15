-- Phase 2: add Stripe subscription columns to the User table.
-- Hand-authored ALTER (idempotent) because the 0000 baseline snapshot was
-- missing, which made drizzle-kit emit a full CREATE-everything migration.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeCustomerId" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscriptionStatus" text;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "subscriptionTier" varchar;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "currentPeriodEnd" timestamp;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "trialEndsAt" timestamp;
