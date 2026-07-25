"use client";

import { useId, useState, useTransition } from "react";
import { saveExerciseCalorieAddBack } from "@/app/account/actions";
import { SettingsRow } from "@/components/account/settings-row";
import { Switch } from "@/components/ui/switch";

/**
 * The D2 exercise-calorie switch (calories-burned Phase 3). On (the
 * default): logged workouts add their estimated calories back to the day's
 * budget on the dashboard and the Calorie Tracker. Off: the day is plain
 * Target − Food. Optimistic like the other /account switches: flips
 * instantly, rolls back on failure. The moved switch is the feedback, no
 * toast (ux-canon 03 #32); failure renders inline (ux-canon 03 #29, #40).
 */
export function ExerciseCaloriesSettings({
  initialEnabled,
}: {
  initialEnabled: boolean;
}) {
  const id = useId();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(next: boolean) {
    const prev = enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      try {
        await saveExerciseCalorieAddBack(next);
      } catch {
        setEnabled(prev);
        setError("Exercise calories didn't save. Try again.");
      }
    });
  }

  return (
    <SettingsRow
      control={
        <Switch
          checked={enabled}
          disabled={isPending}
          id={id}
          onCheckedChange={save}
        />
      }
      controlId={id}
      error={error}
      label="Exercise calories"
      supporting="Logged workouts add their estimated calories back to your daily budget."
    />
  );
}
