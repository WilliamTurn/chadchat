"use client";

import { ClipboardList, Play, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { syncPlanDays } from "@/app/workouts/actions";
import { KpiHelp } from "@/components/dashboard/kpi";
import { Button } from "@/components/ui/button";
import {
  formatPlanTarget,
  type PlanDay,
  type PlanDayExercise,
} from "@/lib/validation/plan-days";
import {
  exerciseKind,
  findBuiltInExercise,
} from "@/lib/workouts/exercise-library";
import type { LastExerciseLog } from "@/lib/workouts/stats";
import {
  ghostsFromHistory,
  type PlanPrefill,
  WorkoutBuilder,
} from "./workout-builder";

type CustomExerciseRow = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  kind: string;
  notes: string | null;
};

/**
 * The FN-2 fix: the active training plan, runnable from the Workouts page.
 * Each day is a card with a Start button that opens the logger pre-filled:
 * the plan's exercises and set counts laid out, last session's numbers (or
 * the plan's prescription) ghosted per set. The Hevy "routine" experience,
 * driven by the plan Chad wrote.
 *
 * Plans saved before structured days existed arrive with `days: null`; this
 * component then runs the one-time AI extraction (`syncPlanDays`) automatically
 * and refreshes, so older plans become runnable without the member doing
 * anything.
 */
export function PlanRunner({
  planId,
  planTitle,
  days,
  customExercises,
  lastSets,
}: {
  planId: string;
  planTitle: string;
  days: PlanDay[] | null;
  customExercises: CustomExerciseRow[];
  lastSets: Record<string, LastExerciseLog>;
}) {
  const router = useRouter();
  const [syncedDays, setSyncedDays] = useState<PlanDay[] | null>(days);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(days == null);
  const startedRef = useRef(false);

  async function runSync() {
    setSyncing(true);
    setError(null);
    const result = await syncPlanDays(planId);
    if (result.ok) {
      setSyncedDays(result.days);
      router.refresh();
    } else {
      setError(result.error);
    }
    setSyncing(false);
  }

  useEffect(() => {
    if (days == null && !startedRef.current) {
      startedRef.current = true;
      void runSync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run-once backfill
  }, []);

  return (
    <section id="plan">
      <h2 className="mb-3 flex items-center gap-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
        <ClipboardList className="size-4 text-blood" />
        Your training plan
        <KpiHelp label="Your training plan">
          This is your current plan's week. Tap Start on a day and the logger
          opens with that day's exercises and sets already laid out. Faded
          numbers show what you lifted last session (or the plan's target), so
          you just check off sets as you do them.
        </KpiHelp>
      </h2>

      <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <span className="font-display font-semibold text-base leading-tight">
            {planTitle}
          </span>
          <Link
            className="text-muted-foreground text-xs underline-offset-4 hover:text-foreground hover:underline"
            href={`/plans/${planId}`}
          >
            View full plan
          </Link>
        </div>

        {syncing ? (
          <div className="flex items-center gap-2 rounded-xl border border-border border-dashed px-4 py-6 text-muted-foreground text-sm">
            <RefreshCw className="size-4 animate-spin" />
            Setting up your plan in the logger…
          </div>
        ) : error ? (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-border border-dashed px-4 py-5">
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button onClick={runSync} size="sm" type="button" variant="outline">
              <RefreshCw className="size-3.5" />
              Try again
            </Button>
          </div>
        ) : syncedDays && syncedDays.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {syncedDays.map((day) => (
              <DayCard
                customExercises={customExercises}
                day={day}
                key={day.name}
                lastSets={lastSets}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function DayCard({
  day,
  customExercises,
  lastSets,
}: {
  day: PlanDay;
  customExercises: CustomExerciseRow[];
  lastSets: Record<string, LastExerciseLog>;
}) {
  const prefill = buildPrefill(day, customExercises, lastSets);
  const preview = day.exercises
    .slice(0, 3)
    .map((ex) => ex.name)
    .join(" · ");
  const extra = day.exercises.length - 3;

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-background/40 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-sm">{day.name}</div>
          <div className="mt-0.5 text-muted-foreground text-xs">
            {day.exercises.length} exercise
            {day.exercises.length === 1 ? "" : "s"}
          </div>
        </div>
        <WorkoutBuilder
          customExercises={customExercises}
          lastSets={lastSets}
          mode="plan"
          plan={prefill}
          trigger={
            <Button className="shrink-0 gap-1.5" size="sm">
              <Play className="size-3.5" />
              Start
            </Button>
          }
        />
      </div>
      <p className="text-muted-foreground text-xs leading-relaxed">
        {preview}
        {extra > 0 ? ` · +${extra} more` : ""}
      </p>
    </div>
  );
}

/**
 * Resolve a plan day into logger prefill: each exercise's logging kind and
 * muscle group come from the member's custom library or the built-in catalog;
 * ghosts come from their last logged session of that exercise, falling back
 * to the plan's own prescription when they've never done it.
 */
function buildPrefill(
  day: PlanDay,
  customExercises: CustomExerciseRow[],
  lastSets: Record<string, LastExerciseLog>
): PlanPrefill {
  return {
    title: day.name,
    exercises: day.exercises.map((ex) => {
      const key = ex.name.trim().toLowerCase();
      const custom = customExercises.find(
        (c) => c.name.trim().toLowerCase() === key
      );
      const builtIn = findBuiltInExercise(ex.name);
      const kind = custom
        ? exerciseKind(custom)
        : builtIn
          ? exerciseKind(builtIn)
          : "weighted";
      const muscleGroup = custom?.muscleGroup ?? builtIn?.muscleGroup ?? null;

      const history = lastSets[key];
      const ghosts = history
        ? ghostsFromHistory(history.sets)
        : [planGhost(ex, kind)];

      return {
        name: builtIn?.name ?? custom?.name ?? ex.name,
        muscleGroup,
        kind,
        target: formatPlanTarget(ex),
        sets: ex.sets,
        unit: ex.unit ?? "lb",
        ghosts,
      };
    }),
  };
}

/** The plan's own prescription as a ghost, for never-before-logged exercises. */
function planGhost(
  ex: PlanDayExercise,
  kind: "weighted" | "bodyweight" | "timed"
): { weight: string; reps: string } {
  // A timed prescription like "45s" ghosts as plain seconds.
  const reps =
    kind === "timed" ? ex.reps.replace(/s(ec(onds)?)?$/i, "").trim() : ex.reps;
  return {
    weight: ex.weight != null && ex.weight > 0 ? String(ex.weight) : "",
    reps,
  };
}
