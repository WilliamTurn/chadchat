import "server-only";

import { countMealPlansCreatedSince } from "@/lib/db/queries";

/**
 * Fair-use cap on meal-plan generation (NUT-19; the mechanics generalize to
 * the other expensive generators under SEC-2). Each plan is a full Opus design
 * pass plus dozens of food-database lookups, so an account can't farm plans
 * for friends or hammer the paid model. Deliberately generous: a real member
 * tweaking preferences never sees it. Invisible until hit; friendly copy only
 * at the moment it triggers (memory conversion-wording).
 */
const MAX_PLANS_PER_DAY = 4; // rolling 24 hours
const MAX_PLANS_PER_WEEK = 12; // rolling 7 days

const DAY_MS = 24 * 60 * 60 * 1000;

export type PlanAllowance = { allowed: true } | { allowed: false; message: string };

export async function checkMealPlanAllowance(
  userId: string
): Promise<PlanAllowance> {
  const now = Date.now();
  const [inDay, inWeek] = await Promise.all([
    countMealPlansCreatedSince(userId, new Date(now - DAY_MS)),
    countMealPlansCreatedSince(userId, new Date(now - 7 * DAY_MS)),
  ]);
  if (inDay >= MAX_PLANS_PER_DAY) {
    return {
      allowed: false,
      message:
        "You've built a lot of plans today, so Chad is calling a rest day on this one. Your current plan is saved and ready; build the next one tomorrow.",
    };
  }
  if (inWeek >= MAX_PLANS_PER_WEEK) {
    return {
      allowed: false,
      message:
        "That's a full week of plan-building. Chad wants you to run one of these plans, not keep redrafting; pick one and come back for a fresh plan in a few days.",
    };
  }
  return { allowed: true };
}
