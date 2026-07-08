"use client";

import { Calendar, Clock, Dumbbell, Pencil, Repeat, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { removeWorkout } from "@/app/workouts/actions";
import { Button } from "@/components/ui/button";
import { formatCalendarDay } from "@/lib/date";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  type WorkoutData,
  workoutSetCount,
  workoutVolumeLb,
} from "@/lib/workouts/stats";
import { GROUP_CHIPS, supersetLabel } from "./superset";

const SET_TAG: Record<string, string> = {
  warmup: "warm-up",
  dropset: "drop",
  failure: "failure",
};

// Per-workout accent (DSH-54): history entries used to be identical cards
// that blurred together. Each workout title hashes to one of the five
// dashboard chart tokens, so "Push day" is always sky, "Leg day" always
// emerald, and a scan of the list reads as distinct sessions (the Hevy-style
// colored-icon pattern). Static class strings so Tailwind keeps them.
const ACCENTS = [
  { bar: "bg-chart-1", chip: "bg-chart-1/15 text-chart-1" },
  { bar: "bg-chart-2", chip: "bg-chart-2/15 text-chart-2" },
  { bar: "bg-chart-3", chip: "bg-chart-3/15 text-chart-3" },
  { bar: "bg-chart-4", chip: "bg-chart-4/15 text-chart-4" },
  { bar: "bg-chart-5", chip: "bg-chart-5/15 text-chart-5" },
] as const;

function accentFor(title: string) {
  let h = 0;
  for (let i = 0; i < title.length; i++) {
    h = (h * 31 + title.charCodeAt(i)) >>> 0;
  }
  return ACCENTS[h % ACCENTS.length];
}

function fmtDate(iso: string): string {
  return formatCalendarDay(new Date(iso), {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function WorkoutCard({ workout }: { workout: WorkoutData }) {
  const volume = workoutVolumeLb(workout);
  const sets = workoutSetCount(workout);
  const duration = formatDuration(workout.durationSeconds);
  const accent = accentFor(workout.title);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]">
      <div
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-1", accent.bar)}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl",
              accent.chip
            )}
          >
            <Dumbbell className="size-4" />
          </span>
          <div className="min-w-0">
          <h3 className="font-display font-semibold text-lg leading-tight">
            {workout.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {fmtDate(workout.performedAt)}
            </span>
            {duration ? (
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {duration}
              </span>
            ) : null}
            <span className="flex items-center gap-1">
              <Dumbbell className="size-3" />
              {sets} set{sets === 1 ? "" : "s"}
            </span>
            {volume > 0 ? (
              <span className="font-medium text-foreground">
                {volume.toLocaleString()} lb volume
              </span>
            ) : null}
          </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* Repeat/Edit open the full-page logger (MOB-18), not a popup. */}
          <Button
            aria-label="Repeat this workout"
            asChild
            className="size-8 text-muted-foreground"
            size="icon"
            title="Repeat this workout"
            variant="ghost"
          >
            <Link href={`/workouts/log?repeat=${workout.id}`}>
              <Repeat className="size-3.5" />
            </Link>
          </Button>
          <Button
            aria-label="Edit workout"
            asChild
            className="size-8 text-muted-foreground"
            size="icon"
            title="Edit workout"
            variant="ghost"
          >
            <Link href={`/workouts/log?edit=${workout.id}`}>
              <Pencil className="size-3.5" />
            </Link>
          </Button>
          <DeleteWorkout id={workout.id} />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {workout.exercises.map((ex, exIdx) => (
          <div key={`${ex.name}-${exIdx}`}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-sm">{ex.name}</span>
              {ex.supersetGroup != null && (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 font-medium text-[10px] uppercase tracking-wide",
                    GROUP_CHIPS[(ex.supersetGroup - 1) % GROUP_CHIPS.length]
                  )}
                  title="Performed back-to-back with the other exercises in this superset"
                >
                  {supersetLabel(ex.supersetGroup)}
                </span>
              )}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {ex.sets.map((s, i) => {
                const tag = SET_TAG[s.setType];
                // A timed exercise's sets are durations ("60s"), not load × reps.
                const timed = ex.kind === "timed";
                const load = timed
                  ? ""
                  : s.weight == null
                    ? "BW"
                    : `${s.weight}${s.unit}`;
                const reps =
                  s.reps == null ? "" : timed ? `${s.reps}s` : ` × ${s.reps}`;
                return (
                  <span
                    className={cn(
                      "rounded-md border px-1.5 py-0.5 text-xs",
                      s.completed
                        ? "border-border bg-background/60"
                        : "border-border border-dashed text-muted-foreground line-through",
                      s.setType === "warmup" && "opacity-70"
                    )}
                    key={i}
                    title={cn(
                      tag ? `${tag} set` : "working set",
                      s.rpe != null &&
                        `· RPE ${s.rpe} (how hard it felt, 1-10)`
                    )}
                  >
                    {load}
                    {reps}
                    {s.rpe != null ? (
                      <span className="ml-1 text-muted-foreground">
                        @{s.rpe}
                      </span>
                    ) : null}
                    {tag ? (
                      <span className="ml-1 text-[10px] text-muted-foreground uppercase">
                        {tag}
                      </span>
                    ) : null}
                  </span>
                );
              })}
            </div>
            {ex.notes ? (
              <p className="mt-1 text-muted-foreground text-xs italic">
                {ex.notes}
              </p>
            ) : null}
          </div>
        ))}
      </div>

      {workout.notes ? (
        <p className="mt-4 rounded-lg border border-border bg-background/40 px-3 py-2 text-muted-foreground text-sm">
          {workout.notes}
        </p>
      ) : null}
    </section>
  );
}

function DeleteWorkout({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        aria-label="Delete workout"
        className="size-8 text-muted-foreground"
        onClick={() => setConfirming(true)}
        size="icon"
        variant="ghost"
      >
        <Trash2 className="size-3.5" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        className="h-8 px-2 text-xs"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await removeWorkout(id);
            if (result.ok) {
              router.refresh();
            } else {
              toast.error(result.error ?? "Couldn't delete that workout.");
              setConfirming(false);
            }
          })
        }
        size="sm"
        variant="destructive"
      >
        {pending ? "Deleting…" : "Delete"}
      </Button>
      <Button
        className="h-8 px-2 text-xs"
        disabled={pending}
        onClick={() => setConfirming(false)}
        size="sm"
        variant="ghost"
      >
        Cancel
      </Button>
    </div>
  );
}
