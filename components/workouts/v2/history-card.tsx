// One finished workout in a history list. Pure markup (no client hooks) so
// server pages can render it directly.

import { Clock, Dumbbell, Flame, Trophy, Weight } from "lucide-react";
import Link from "next/link";
import {
  isCardioOnlySession,
  sessionNetKcal,
} from "@/lib/energy/workout-energy";
import {
  bestSetOfWorkout,
  formatDuration,
  workoutSetCount,
  workoutVolumeLb,
  type WorkoutData,
} from "@/lib/workouts/stats";
import { formatDay, formatVolume } from "./format";
import { Pill, WCard } from "./ui";

export function HistoryCard({
  workout,
  prCount,
  weightKg = null,
}: {
  workout: WorkoutData;
  prCount: number;
  /** Latest weigh-in in kg for the burn estimate; null hides the line
   * (missing inputs never guess; calories-burned Phase 3). */
  weightKg?: number | null;
}) {
  const volume = workoutVolumeLb(workout);
  const sets = workoutSetCount(workout);
  const duration = formatDuration(workout.durationSeconds);
  const best = bestSetOfWorkout(workout);
  // energy.workout.kcal via its registered source symbol.
  const estimatedKcal = sessionNetKcal(workout, weightKg);
  // A logged run/ride is not a lift: its "1 set" count is noise, drop it.
  const cardioOnly = isCardioOnlySession(workout);
  return (
    // h-full so cards fill their row when rendered in a grid (LAY-1).
    <Link className="block h-full" href={`/workouts/history/${workout.id}`}>
      <WCard className="h-full p-5 transition hover:border-input hover:bg-muted/30">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-bold text-[16.5px] text-foreground">
              {workout.title}
            </h3>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {formatDay(new Date(workout.performedAt).getTime())}
            </p>
          </div>
          {prCount > 0 && (
            <Pill className="shrink-0" tone="gold">
              <Trophy aria-hidden className="size-3" />
              {prCount} {prCount === 1 ? "record" : "records"}
            </Pill>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-muted-foreground">
          {duration && (
            <span className="inline-flex items-center gap-1.5">
              <Clock aria-hidden className="size-3.5 text-muted-foreground/70" />
              {duration}
            </span>
          )}
          {!cardioOnly && (
            <span className="inline-flex items-center gap-1.5">
              <Dumbbell aria-hidden className="size-3.5 text-muted-foreground/70" />
              {sets} {sets === 1 ? "set" : "sets"}
            </span>
          )}
          {volume > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Weight aria-hidden className="size-3.5 text-muted-foreground/70" />
              {formatVolume(volume)} lb moved
            </span>
          )}
          {estimatedKcal != null && (
            <span className="inline-flex items-center gap-1.5">
              <Flame aria-hidden className="size-3.5 text-muted-foreground/70" />
              ~{estimatedKcal.toLocaleString()} cal estimated
            </span>
          )}
        </div>

        {best && (
          <p className="mt-2 truncate text-[12.5px] text-muted-foreground/80">
            Best set: {best}
          </p>
        )}
      </WCard>
    </Link>
  );
}
