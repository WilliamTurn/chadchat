import "server-only";

import { asc, eq } from "drizzle-orm";
import {
  db,
  getActivePlansByUserId,
  getWorkoutsByUserId,
} from "@/lib/db/queries";
import {
  getPlanSessionCompletions,
  resolvePlanScheduleView,
} from "@/lib/db/plan-goal-queries";
import { workout } from "@/lib/db/schema";
import type { User } from "@/lib/db/schema";
import { calendarDayAnchorInTz } from "@/lib/date";
import { MS_PER_DAY } from "@/lib/chart/trend";
import { ChatbotError } from "@/lib/errors";
import type { CompletionEvent } from "@/lib/plans/up-next";
import {
  buildWorkoutWeek,
  weekAnchors,
  type WorkoutWeekDay,
} from "@/lib/today/week";
import { getResolveOptions } from "./canonical";
import { canonicalizeWorkouts } from "./exercise-identity";
import { toWorkoutData } from "./serialize";
import {
  computePersonalRecords,
  exercise1RMTrend,
  type PersonalRecord,
  type PrEvent,
  prEventsByWorkout,
  volumeTrend,
} from "./stats";
import {
  mergeMilestoneTimeline,
  type MuscleGroupShare,
  muscleGroupDistribution,
  nextSessionCountMilestone,
  perfectPlanWeekMilestones,
  sessionCountMilestones,
  type TrainingMilestone,
  volumeSinceLb,
  type WeekAdherencePoint,
  weeklyAdherenceSeries,
} from "./training-analytics";

/**
 * THE Progress > Training data assembly (FIX-33). One server module computes
 * every number the surface shows, from canonicalized history (aliases merge,
 * read-time only) and the FIX-28 completion event stream, so the page, the
 * fixture harness, and any later consumer render identical values
 * (one-canonical-value law). All timestamps handed to the client are
 * member-local day anchors or ISO strings; no Dates or Maps cross the wire.
 */

// The hydration cap for full-history analytics (sets + reps for trends,
// records, PR replay). Header-level facts (session counts, milestones) come
// from the UNCAPPED header query below, so they stay truthful past the cap.
const MAX_ANALYTICS_WORKOUTS = 500;

/** Trailing member-local weeks the adherence series covers (1 year max). */
const MAX_ADHERENCE_WEEKS = 52;

export type StrengthTrend = PersonalRecord & {
  /** Best est-1RM per session (lb), oldest first. */
  trend: { t: number; value: number }[];
};

export type TrainingAnalytics = {
  /** True total session count (uncapped header query). */
  totalSessions: number;
  /** Sessions completed inside the member's current Sunday-start week. */
  sessionsThisWeek: number;
  /** Total volume (lb) inside the current week (training.volume.week). */
  volumeThisWeek: number;
  /** The member's current Sunday-start week strip (strip law, s181). */
  week: WorkoutWeekDay[];
  /** Member-local day anchor of today (fixture-stable determinism seam). */
  todayMs: number;
  /** Member-local day anchors of every logged session (frequency chart). */
  sessionDays: { t: number }[];
  /** Daily training volume, member-local days, oldest first. */
  volumePoints: { t: number; volume: number }[];
  /** Top lifts with per-session est-1RM trends (canonical identities). */
  strength: StrengthTrend[];
  /** Every record-beating set, NEWEST first (source-linked timeline). */
  prEvents: PrEvent[];
  /** Reached milestones, NEWEST first. */
  milestones: TrainingMilestone[];
  /** The next session-count milestone ahead, for honest progress framing. */
  nextMilestone: { threshold: number; remaining: number } | null;
  /** Plan adherence, when a structured training plan exists. */
  adherence: {
    planId: string;
    planTitle: string;
    plannedPerWeek: number;
    completedThisWeek: number;
    /** Weekly completed-vs-planned, oldest first. */
    weekly: WeekAdherencePoint[];
  } | null;
  /** Completed working sets per muscle group, full analytics window. */
  muscleGroups: MuscleGroupShare[];
};

/**
 * Light, UNCAPPED header rows for counts + session milestones: the one
 * source behind "Workouts logged" (training.sessions.total) everywhere it
 * renders, so a member past the hydration cap still reads a true count.
 */
export async function getWorkoutHeaders(
  userId: string
): Promise<{ id: string; performedAt: string }[]> {
  try {
    const rows = await db
      .select({ id: workout.id, performedAt: workout.performedAt })
      .from(workout)
      .where(eq(workout.userId, userId))
      .orderBy(asc(workout.performedAt));
    return rows.map((r) => ({ id: r.id, performedAt: r.performedAt.toISOString() }));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get workout headers");
  }
}

/** Trailing member-local week bounds, oldest first, ending at the current week. */
function trailingWeeks(
  currentWeekStartMs: number,
  count: number
): { startMs: number; endMs: number }[] {
  const weeks: { startMs: number; endMs: number }[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const startMs = currentWeekStartMs - i * 7 * MS_PER_DAY;
    weeks.push({ startMs, endMs: startMs + 7 * MS_PER_DAY });
  }
  return weeks;
}

export async function getTrainingAnalytics(user: User): Promise<TrainingAnalytics> {
  const [rawWorkouts, headers, activePlans, resolveOptions] = await Promise.all([
    getWorkoutsByUserId(user.id, MAX_ANALYTICS_WORKOUTS),
    getWorkoutHeaders(user.id),
    getActivePlansByUserId(user.id),
    getResolveOptions(user.id),
  ]);

  const workouts = rawWorkouts.map(toWorkoutData);
  const canonical = canonicalizeWorkouts(workouts, resolveOptions);

  const { days, todayMs } = weekAnchors(user.timezone);
  const weekStartMs = days[0].getTime();

  const sessionDays = canonical.map((w) => ({
    t: calendarDayAnchorInTz(new Date(w.performedAt), user.timezone).getTime(),
  }));
  // The pinned training.sessions.thisWeek source (buildWorkoutWeek) doubles
  // as the strip data: one computation for the count AND the visual.
  const week = buildWorkoutWeek(
    canonical.map((w) => new Date(w.performedAt)),
    user.timezone
  );

  const strength = computePersonalRecords(canonical)
    .slice(0, 8)
    .map((r) => ({ ...r, trend: exercise1RMTrend(canonical, r.exerciseName) }));

  // Plan adherence from the FIX-28 completion stream (structured plans only).
  const trainingPlan = activePlans.find((p) => p.kind === "training") ?? null;
  let adherence: TrainingAnalytics["adherence"] = null;
  let perfectWeeks: TrainingMilestone[] = [];
  if (trainingPlan) {
    const view = await resolvePlanScheduleView(trainingPlan);
    if (view.kind === "structured" && view.schedule.sessions.length > 0) {
      const completionRows = await getPlanSessionCompletions({
        planId: trainingPlan.id,
        userId: user.id,
      });
      const completions: CompletionEvent[] = completionRows.map((c) => ({
        planSessionId: c.planSessionId,
        completedDayMs: c.completedDay.getTime(),
      }));
      const firstCompletion = completions.reduce<number | null>(
        (acc, c) =>
          acc === null || c.completedDayMs < acc ? c.completedDayMs : acc,
        null
      );
      const weeksBack =
        firstCompletion === null
          ? 1
          : Math.min(
              MAX_ADHERENCE_WEEKS,
              Math.floor((weekStartMs - firstCompletion) / (7 * MS_PER_DAY)) + 2
            );
      const weeks = trailingWeeks(weekStartMs, Math.max(1, weeksBack));
      const weekly = weeklyAdherenceSeries({
        schedule: view.schedule,
        completions,
        weeks,
      });
      const current = weekly.at(-1);
      adherence = {
        planId: trainingPlan.id,
        planTitle: trainingPlan.title,
        plannedPerWeek: view.schedule.sessions.length,
        completedThisWeek: current?.completed ?? 0,
        weekly,
      };
      perfectWeeks = perfectPlanWeekMilestones({
        schedule: view.schedule,
        completions,
        weeks,
      });
    }
  }

  const milestones = mergeMilestoneTimeline(
    sessionCountMilestones(headers),
    perfectWeeks
  );

  return {
    totalSessions: headers.length,
    sessionsThisWeek: week.reduce((sum, d) => sum + d.count, 0),
    volumeThisWeek: volumeSinceLb(canonical, weekStartMs, user.timezone),
    week,
    todayMs,
    sessionDays,
    volumePoints: volumeTrend(canonical, user.timezone),
    strength,
    prEvents: prEventsByWorkout(canonical).reverse(),
    milestones,
    nextMilestone: nextSessionCountMilestone(headers.length),
    adherence,
    muscleGroups: muscleGroupDistribution(canonical),
  };
}
