import "server-only";

import { countFutureYouForecastsCreatedSince } from "@/lib/db/queries";

/**
 * Fair-use cap on Future You forecasts (FEAT-29), cloned from the montage cap
 * (lib/montage/limit.ts, the SEC-2 template). Each forecast is the app's most
 * expensive single artifact (a vision QC pass, a vision architect pass, and
 * 3-4 high-quality generated images), and the projection only moves when the
 * member's body or goal moves, so the cap can be tight without a real member
 * ever seeing it. Invisible until hit; friendly copy only at that moment
 * (memory conversion-wording). Failed runs never count (see the query).
 */
const MAX_FORECASTS_PER_DAY = 1; // rolling 24 hours
const MAX_FORECASTS_PER_30_DAYS = 4; // rolling 30 days

const DAY_MS = 24 * 60 * 60 * 1000;

export type ForecastAllowance =
  | { allowed: true }
  | { allowed: false; message: string };

export async function checkForecastAllowance(
  userId: string
): Promise<ForecastAllowance> {
  const now = Date.now();
  const [inDay, inMonth] = await Promise.all([
    countFutureYouForecastsCreatedSince(userId, new Date(now - DAY_MS)),
    countFutureYouForecastsCreatedSince(userId, new Date(now - 30 * DAY_MS)),
  ]);
  if (inDay >= MAX_FORECASTS_PER_DAY) {
    return {
      allowed: false,
      message:
        "Today's forecast is done. Your body doesn't change overnight and neither does the projection. Come back tomorrow for a fresh one.",
    };
  }
  if (inMonth >= MAX_FORECASTS_PER_30_DAYS) {
    return {
      allowed: false,
      message:
        "You've pulled four forecasts this month, and the picture ahead only changes when the work happens. Go put in the reps; a fresh forecast unlocks in a few days.",
    };
  }
  return { allowed: true };
}
