import { tool } from "ai";
import type { Session } from "next-auth";
import { buildDayLog } from "@/lib/ai/dashboard";
import { getDashboardInputSchema } from "@/lib/ai/tool-schemas";
import { calendarRangeWindowInTz } from "@/lib/date";
import {
  getBodyMeasurementsByUserId,
  getKitchenAnalysesBetween,
  getMealsBetween,
  getNutritionTarget,
  getProgressEntriesByUserId,
  getWaterMlBetween,
  getWorkoutsBetween,
} from "@/lib/db/queries";
import { weighInKg } from "@/lib/progress/weight";

type GetDashboardProps = {
  session: Session;
  // The user's IANA zone (FEAT-8): "today" and day windows are resolved on
  // their wall clock, not the UTC date.
  timezone: string | null;
};

/**
 * Read-only access to the client's dashboard for any day — or a span of days —
 * including the past. Lets Chad pull what they actually logged (meals + macros,
 * workouts, weigh-ins, water, body measurements) instead of guessing or relying
 * only on the always-on "today" snapshot in his prompt. Owner-scoped via the
 * session, so a user can only ever read their own data.
 */
export const getDashboard = ({ session, timezone }: GetDashboardProps) =>
  tool({
    description:
      "Read this client's logged dashboard data for a specific day or date range, including past dates. Use it whenever you need to know what they actually did — e.g. 'what did I eat last Tuesday?', 'how was my training last week?', 'am I hitting my protein?', or to review progress before giving advice. Returns logged meals with macros, workouts with their estimated exercise calories (the same estimates their workout cards show; those calories count toward the day's calorie budget), progress check-ins (weigh-ins + whether a progress photo was logged), water, body measurements, and any 'Rate My Kitchen' shots (fridge, pantry, or other food scenes like a grocery cart). The always-on snapshot in your context already covers TODAY; use this for any other day or to compare a span. Dates are calendar days in YYYY-MM-DD.",
    inputSchema: getDashboardInputSchema,
    execute: async ({ date, endDate }) => {
      const userId = session.user.id;
      const { start, end } = calendarRangeWindowInTz(date, endDate, timezone);

      const [
        meals,
        workouts,
        waterMl,
        allWeighIns,
        allMeasurements,
        kitchen,
        target,
      ] = await Promise.all([
        getMealsBetween(userId, start, end),
        getWorkoutsBetween(userId, start, end),
        getWaterMlBetween(userId, start, end),
        getProgressEntriesByUserId(userId),
        getBodyMeasurementsByUserId(userId),
        getKitchenAnalysesBetween(userId, start, end),
        getNutritionTarget(userId),
      ]);

      const inWindow = (d: Date) =>
        d.getTime() >= start.getTime() && d.getTime() < end.getTime();
      const weighIns = allWeighIns.filter((e) => inWindow(e.recordedAt));
      const measurements = allMeasurements.filter((b) =>
        inWindow(b.recordedAt)
      );

      // Latest weigh-in overall (not window-scoped) — the weight every
      // burn-estimate surface prices against (plan §6's read-time rule).
      const latestWeighed = allWeighIns
        .filter((e) => e.weight != null)
        .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime())
        .at(-1);

      return buildDayLog({
        start,
        end,
        meals,
        workouts,
        weighIns,
        waterMl,
        measurements,
        kitchen,
        target,
        timezone,
        weightKg: weighInKg(latestWeighed ?? null),
      });
    },
  });
