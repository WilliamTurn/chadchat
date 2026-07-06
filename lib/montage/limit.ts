import "server-only";

import { countProgressMontagesCreatedSince } from "@/lib/db/queries";

/**
 * Fair-use cap on montage generation (FEAT-18), cloned from the meal-plan cap
 * (lib/nutrition/plan-limit.ts, the SEC-2 template). Each montage is a
 * flagship-vision pass over up to four photos, and the picture only changes
 * when new photos land — so the cap can be tight without a real member ever
 * seeing it. Invisible until hit; friendly copy only at that moment (memory
 * conversion-wording).
 */
const MAX_MONTAGES_PER_DAY = 2; // rolling 24 hours
const MAX_MONTAGES_PER_WEEK = 6; // rolling 7 days

const DAY_MS = 24 * 60 * 60 * 1000;

export type MontageAllowance =
  | { allowed: true }
  | { allowed: false; message: string };

export async function checkMontageAllowance(
  userId: string
): Promise<MontageAllowance> {
  const now = Date.now();
  const [inDay, inWeek] = await Promise.all([
    countProgressMontagesCreatedSince(userId, new Date(now - DAY_MS)),
    countProgressMontagesCreatedSince(userId, new Date(now - 7 * DAY_MS)),
  ]);
  if (inDay >= MAX_MONTAGES_PER_DAY) {
    return {
      allowed: false,
      message:
        "You've already built today's montage. The picture doesn't change by the hour; log a new photo and build the next one tomorrow.",
    };
  }
  if (inWeek >= MAX_MONTAGES_PER_WEEK) {
    return {
      allowed: false,
      message:
        "That's a full week of montages. New photos are what make the next one worth looking at, so keep logging and come back in a few days.",
    };
  }
  return { allowed: true };
}
