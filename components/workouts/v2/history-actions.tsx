"use client";

// Client actions on a finished-workout page: repeat it as a new live session,
// delete it, and the post-finish "Done" return button.

import { Play, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { removeWorkout } from "@/app/workouts/actions";
import type { LastExerciseLog, WeightUnit, WorkoutData } from "@/lib/workouts/stats";
import { type CustomExerciseData, findInCatalog, mergeCatalog } from "./catalog";
import { ConfirmDialog } from "./confirm";
import { sessionFromPast } from "./session-factory";
import { useWorkouts } from "./store";
import { WButton } from "./ui";

export function RepeatWorkoutButton({
  workout,
  customExercises,
  lastSets,
  unit,
}: {
  workout: WorkoutData;
  customExercises: CustomExerciseData[];
  lastSets: Record<string, LastExerciseLog>;
  unit: WeightUnit;
}) {
  const { session, startSession } = useWorkouts();
  const router = useRouter();
  const busy = Boolean(session);
  const catalog = mergeCatalog(customExercises);
  return (
    <WButton
      className="w-full"
      disabled={busy}
      onClick={() => {
        startSession(
          sessionFromPast(
            workout,
            (name) => findInCatalog(catalog, name)?.equipment ?? null,
            lastSets,
            unit
          )
        );
        router.push("/workouts/session");
      }}
      size="lg"
      variant="primary"
    >
      <Play aria-hidden className="size-5 fill-current" />
      {busy ? "Finish your current workout first" : "Do this workout again"}
    </WButton>
  );
}

export function DeleteWorkoutButton({ workoutId }: { workoutId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  return (
    <>
      <WButton
        className="w-full"
        onClick={() => setConfirming(true)}
        variant="danger"
      >
        <Trash2 aria-hidden className="size-4" />
        Delete this workout from your history
      </WButton>
      <ConfirmDialog
        body="It will be removed from your history permanently, including any records it set."
        busy={deleting}
        confirmLabel="Delete workout"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          setDeleting(true);
          const result = await removeWorkout(workoutId);
          setDeleting(false);
          setConfirming(false);
          if (!result.ok) {
            toast.error(result.error ?? "Couldn't delete that workout.");
            return;
          }
          router.push("/workouts/history");
          router.refresh();
        }}
        open={confirming}
        title="Delete this workout?"
      />
    </>
  );
}

export function DoneButton() {
  const router = useRouter();
  return (
    <WButton
      className="w-full"
      onClick={() => {
        router.push("/workouts");
        router.refresh();
      }}
      size="lg"
      variant="primary"
    >
      Done, back to Workouts
    </WButton>
  );
}
