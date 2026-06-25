"use client";

import { Calendar, Clock, Dumbbell, Pencil, Repeat, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { removeWorkout } from "@/app/workouts/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatDuration,
  type WorkoutData,
  workoutSetCount,
  workoutVolumeLb,
} from "@/lib/workouts/stats";
import { WorkoutBuilder } from "./workout-builder";

type CustomExerciseRow = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
};

const SET_TAG: Record<string, string> = {
  warmup: "warm-up",
  dropset: "drop",
  failure: "failure",
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function WorkoutCard({
  workout,
  customExercises,
}: {
  workout: WorkoutData;
  customExercises: CustomExerciseRow[];
}) {
  const volume = workoutVolumeLb(workout);
  const sets = workoutSetCount(workout);
  const duration = formatDuration(workout.durationSeconds);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
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
        <div className="flex shrink-0 items-center gap-1">
          <WorkoutBuilder
            customExercises={customExercises}
            initial={workout}
            mode="repeat"
            trigger={
              <Button
                aria-label="Repeat this workout"
                className="size-8 text-muted-foreground"
                size="icon"
                title="Repeat this workout"
                variant="ghost"
              >
                <Repeat className="size-3.5" />
              </Button>
            }
          />
          <WorkoutBuilder
            customExercises={customExercises}
            initial={workout}
            mode="edit"
            trigger={
              <Button
                aria-label="Edit workout"
                className="size-8 text-muted-foreground"
                size="icon"
                variant="ghost"
              >
                <Pencil className="size-3.5" />
              </Button>
            }
          />
          <DeleteWorkout id={workout.id} />
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {workout.exercises.map((ex, exIdx) => (
          <div key={`${ex.name}-${exIdx}`}>
            <div className="font-medium text-sm">{ex.name}</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {ex.sets.map((s, i) => {
                const tag = SET_TAG[s.setType];
                const load = s.weight == null ? "BW" : `${s.weight}${s.unit}`;
                const reps = s.reps == null ? "" : ` × ${s.reps}`;
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
                    title={tag ? `${tag} set` : "working set"}
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
