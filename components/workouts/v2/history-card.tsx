// One finished workout in a history list. Pure markup (no client hooks) so
// server pages can render it directly.

import { Clock, Dumbbell, Trophy, Weight } from "lucide-react";
import Link from "next/link";
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
}: {
  workout: WorkoutData;
  prCount: number;
}) {
  const volume = workoutVolumeLb(workout);
  const sets = workoutSetCount(workout);
  const duration = formatDuration(workout.durationSeconds);
  const best = bestSetOfWorkout(workout);
  return (
    <Link className="block" href={`/workouts/history/${workout.id}`}>
      <WCard className="p-5 transition hover:border-input hover:bg-muted/30">
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
          <span className="inline-flex items-center gap-1.5">
            <Dumbbell aria-hidden className="size-3.5 text-muted-foreground/70" />
            {sets} {sets === 1 ? "set" : "sets"}
          </span>
          {volume > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Weight aria-hidden className="size-3.5 text-muted-foreground/70" />
              {formatVolume(volume)} lb moved
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
