import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { buildDayLog } from "@/lib/ai/dashboard";
import { calendarRangeWindowUTC } from "@/lib/date";
import {
  getBodyMeasurementsByUserId,
  getKitchenAnalysesBetween,
  getMealsBetween,
  getNutritionTarget,
  getProgressEntriesByUserId,
  getWaterMlBetween,
  getWorkoutsBetween,
} from "@/lib/db/queries";

type GetDashboardProps = {
  session: Session;
};

/**
 * Read-only access to the client's dashboard for any day — or a span of days —
 * including the past. Lets Chad pull what they actually logged (meals + macros,
 * workouts, weigh-ins, water, body measurements) instead of guessing or relying
 * only on the always-on "today" snapshot in his prompt. Owner-scoped via the
 * session, so a user can only ever read their own data.
 */
export const getDashboard = ({ session }: GetDashboardProps) =>
  tool({
    description:
      "Read this client's logged dashboard data for a specific day or date range, including past dates. Use it whenever you need to know what they actually did — e.g. 'what did I eat last Tuesday?', 'how was my training last week?', 'am I hitting my protein?', or to review progress before giving advice. Returns logged meals with macros, workouts, progress check-ins (weigh-ins + whether a progress photo was logged), water, body measurements, and any fridge/pantry 'Rate My Kitchen' shots. The always-on snapshot in your context already covers TODAY; use this for any other day or to compare a span. Dates are calendar days in YYYY-MM-DD.",
    inputSchema: z.object({
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
        .nullable()
        .optional()
        .describe(
          "The day to look up (YYYY-MM-DD). Omit for today. With endDate, this is the start of the range."
        ),
      endDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
        .nullable()
        .optional()
        .describe(
          "Optional inclusive end of a range (YYYY-MM-DD). Omit to look up a single day. Keep ranges reasonable (a few weeks at most)."
        ),
    }),
    execute: async ({ date, endDate }) => {
      const userId = session.user.id;
      const { start, end } = calendarRangeWindowUTC(date, endDate);

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
      });
    },
  });
