import { z } from "zod";

/** Largest sleep we'll accept in one night (24h) — guards a fat-fingered entry. */
export const MAX_SLEEP_MINUTES = 24 * 60;

/** The nightly target used to color a "good night" — 7h, per sleep guidance. */
export const SLEEP_GOAL_MINUTES = 7 * 60;

/**
 * A single night's sleep. Stored in minutes so 7h30m is exact (not a 7.5
 * float). Quality is an optional 1–5 self-rating. `recordedAt` is an ISO date
 * string from a date picker (or empty → today), anchored to noon UTC in the
 * action (see lib/date.ts).
 */
export const sleepEntrySchema = z.object({
  recordedAt: z.string().optional(),
  minutes: z
    .number()
    .int()
    .min(1, "Enter how long you slept.")
    .max(MAX_SLEEP_MINUTES),
  quality: z.number().int().min(1).max(5).nullable().optional(),
});

export type SleepEntryInput = z.infer<typeof sleepEntrySchema>;
