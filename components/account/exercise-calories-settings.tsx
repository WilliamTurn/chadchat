"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveExerciseCalorieAddBack } from "@/app/account/actions";
import { Switch } from "@/components/ui/switch";

/**
 * The D2 exercise-calorie switch (calories-burned Phase 3). On (the
 * default): logged workouts add their estimated calories back to the day's
 * budget on the dashboard and the Calorie Tracker. Off: the day is plain
 * Target − Food. Optimistic like the other /account switches: flips
 * instantly, rolls back on failure.
 */
export function ExerciseCaloriesSettings({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();

  function save(next: boolean) {
    const prev = enabled;
    setEnabled(next);
    startTransition(async () => {
      try {
        await saveExerciseCalorieAddBack(next);
        toast.success(
          next
            ? "Exercise calories are on. Logged workouts raise the day's calorie budget."
            : "Exercise calories are off. Your day is target minus food only."
        );
      } catch {
        setEnabled(prev);
        toast.error("Couldn't save that. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h3 className="font-medium text-sm">Exercise calories</h3>
        <p className="mt-1 text-muted-foreground text-sm">
          Logged workouts add their estimated calories back to the day's
          budget, so calories remaining = target minus food plus exercise.
          Switch it off to keep the day at target minus food.
        </p>
      </div>
      <Switch
        aria-label="Exercise calories"
        checked={enabled}
        disabled={isPending}
        onCheckedChange={save}
      />
    </div>
  );
}
