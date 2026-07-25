import { Suspense } from "react";
import { TrainingAnalyticsView } from "@/components/progress/training/training-analytics-view";
import { TrainingLocked } from "@/components/progress/training/training-section";
import { calendarDayAnchorInTz } from "@/lib/date";
import { MS_PER_DAY } from "@/lib/chart/trend";
import type { PlanSchedule } from "@/lib/plans/schedule";
import type { CompletionEvent } from "@/lib/plans/up-next";
import type { WorkoutWeekDay } from "@/lib/today/week";
import { canonicalizeWorkouts } from "@/lib/workouts/exercise-identity";
import {
  computePersonalRecords,
  exercise1RMTrend,
  prEventsByWorkout,
  volumeTrend,
} from "@/lib/workouts/stats";
import type { TrainingAnalytics } from "@/lib/workouts/training-data";
import {
  mergeMilestoneTimeline,
  muscleGroupDistribution,
  nextSessionCountMilestone,
  perfectPlanWeekMilestones,
  sessionCountMilestones,
  volumeSinceLb,
  weeklyAdherenceSeries,
} from "@/lib/workouts/training-analytics";
import {
  FIXTURE_TIMEZONE,
  fixtureDayAnchorMs,
  PERSONAS,
  type Persona,
} from "@/tests/fixtures/dashboard-states";

/**
 * PROGRESS > TRAINING FIXTURE MATRIX (P56-B harness, FIX-33).
 *
 * The full TrainingAnalyticsView rendered for every fixture persona at the
 * fixed anchor date, built through the SAME pure computations the live
 * assembly uses (canonicalize -> stats -> analytics), so the harness proves
 * the alias dedup and every designed state deterministically:
 *
 *   - first-run: every section's designed empty state.
 *   - sparse: one session; facts without trend claims.
 *   - consistent: the full rewarding treatment (PR events across the fixture
 *     "Bench Press" alias, milestones, a recent-win celebration hero, and a
 *     synthetic-but-labeled plan-completion stream feeding the perfect-week
 *     milestones; the adherence CARD itself was deleted by owner ruling Q-G,
 *     executed in W3, so the view renders no adherence zone).
 *   - lapsed / overshoot: old data rendered honestly.
 *   - locked-basic: the locked teaser (rendered via the section contract).
 *
 * URL state is disabled (several personas share this page); the live page
 * owns ?range / ?pr.
 */

const WEEKDAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** The fixture member's Sunday-start week (anchor 2026-07-08 is a Wednesday). */
function fixtureWeek(sessionDays: readonly { t: number }[]): WorkoutWeekDay[] {
  const todayMs = fixtureDayAnchorMs(0);
  const weekStart = todayMs - 3 * MS_PER_DAY;
  const counts = new Map<number, number>();
  for (const d of sessionDays) {
    counts.set(d.t, (counts.get(d.t) ?? 0) + 1);
  }
  return Array.from({ length: 7 }, (_, i) => {
    const t = weekStart + i * MS_PER_DAY;
    const count = counts.get(t) ?? 0;
    return {
      t,
      label: WEEKDAY_LETTERS[i],
      dateLabel: new Date(t).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
      count,
      logged: count > 0,
      isToday: t === todayMs,
      isFuture: t > todayMs,
    };
  });
}

/**
 * Harness-only adherence stream for the consistent persona: a 3-session
 * rotation with each fixture workout completing the next session in
 * rotation. Synthetic and labeled as such (the live stream is FIX-28's
 * PlanSessionCompletion events); the SCORING runs through the same
 * weeklyAdherenceSeries/perfectPlanWeekMilestones the live page uses.
 */
function fixtureAdherence(persona: Persona): {
  adherence: TrainingAnalytics["adherence"];
  completions: CompletionEvent[];
  schedule: PlanSchedule | null;
  weeks: { startMs: number; endMs: number }[];
} {
  if (persona.id !== "consistent") {
    return { adherence: null, completions: [], schedule: null, weeks: [] };
  }
  const schedule: PlanSchedule = {
    planId: "fixture-plan",
    sessions: [0, 1, 2].map((position) => ({
      id: `fixture-session-${position}`,
      position,
      name: ["Upper A", "Lower A", "Push B"][position],
      weekday: null,
      exercises: [],
    })),
  };
  const ordered = [...persona.workouts].sort(
    (a, b) =>
      new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
  );
  const completions: CompletionEvent[] = ordered.map((w, i) => ({
    planSessionId: `fixture-session-${i % 3}`,
    completedDayMs: calendarDayAnchorInTz(
      new Date(w.performedAt),
      FIXTURE_TIMEZONE
    ).getTime(),
  }));
  const todayMs = fixtureDayAnchorMs(0);
  const currentWeekStart = todayMs - 3 * MS_PER_DAY;
  const weeks = Array.from({ length: 5 }, (_, i) => {
    const startMs = currentWeekStart - (4 - i) * 7 * MS_PER_DAY;
    return { startMs, endMs: startMs + 7 * MS_PER_DAY };
  });
  const weekly = weeklyAdherenceSeries({ schedule, completions, weeks });
  const current = weekly.at(-1);
  return {
    adherence: {
      planId: "fixture-plan",
      planTitle: "Fixture hypertrophy block",
      plannedPerWeek: 3,
      completedThisWeek: current?.completed ?? 0,
      weekly,
    },
    completions,
    schedule,
    weeks,
  };
}

function buildFixtureAnalytics(persona: Persona): TrainingAnalytics {
  const todayMs = fixtureDayAnchorMs(0);
  const canonical = canonicalizeWorkouts(persona.workouts);
  const sessionDays = canonical.map((w) => ({
    t: calendarDayAnchorInTz(new Date(w.performedAt), FIXTURE_TIMEZONE).getTime(),
  }));
  const week = fixtureWeek(sessionDays);
  const headers = persona.workouts.map((w) => ({
    id: w.id,
    performedAt: w.performedAt,
  }));
  const { adherence, completions, schedule, weeks } = fixtureAdherence(persona);
  const perfectWeeks =
    schedule !== null
      ? perfectPlanWeekMilestones({ schedule, completions, weeks })
      : [];

  return {
    totalSessions: headers.length,
    sessionsThisWeek: week.reduce((sum, d) => sum + d.count, 0),
    volumeThisWeek: volumeSinceLb(
      canonical,
      todayMs - 3 * MS_PER_DAY,
      FIXTURE_TIMEZONE
    ),
    week,
    todayMs,
    sessionDays,
    volumePoints: volumeTrend(canonical, FIXTURE_TIMEZONE),
    strength: computePersonalRecords(canonical)
      .slice(0, 8)
      .map((r) => ({ ...r, trend: exercise1RMTrend(canonical, r.exerciseName) })),
    prEvents: prEventsByWorkout(canonical).reverse(),
    milestones: mergeMilestoneTimeline(
      sessionCountMilestones(headers),
      perfectWeeks
    ),
    nextMilestone: nextSessionCountMilestone(headers.length),
    adherence,
    muscleGroups: muscleGroupDistribution(canonical),
  };
}

export default function TrainingFixturePage() {
  const personas = PERSONAS.filter((p) => p.id !== "locked-basic");
  return (
    <div className="flex flex-col gap-12">
      <div>
        <h1 className="text-page-title">Progress &gt; Training matrix</h1>
        <p className="mt-2 max-w-prose text-body text-muted-foreground">
          The FIX-33 training analytics view for every fixture persona at the
          fixed anchor (2026-07-08, America/Chicago), computed through the
          same pure pipeline as the live page: canonicalized workouts (alias
          dedup), one stats replay, registered metrics only. The consistent
          persona carries a synthetic, clearly-labeled plan-completion stream
          so the adherence ring and perfect-week milestones render.
        </p>
      </div>

      {personas.map((persona) => (
        <section aria-label={persona.id} key={persona.id}>
          <h2 className="mb-1 text-section-title">{persona.id}</h2>
          <p className="mb-4 max-w-prose text-body-sm text-muted-foreground">
            {persona.description}
          </p>
          <div className="rounded-3xl border border-border border-dashed p-4 md:p-6">
            <Suspense fallback={null}>
              <TrainingAnalyticsView
                data={buildFixtureAnalytics(persona)}
                urlState={false}
              />
            </Suspense>
          </div>
        </section>
      ))}

      <section aria-label="locked-basic">
        <h2 className="mb-1 text-section-title">locked-basic</h2>
        <p className="mb-4 max-w-prose text-body-sm text-muted-foreground">
          Active Basic subscriber: the designed locked teaser (capability +
          upgrade path), never an empty or error tone, and no data fetched.
        </p>
        <div className="rounded-3xl border border-border border-dashed p-4 md:p-6">
          <TrainingLocked />
        </div>
      </section>
    </div>
  );
}
