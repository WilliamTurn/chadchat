import { Suspense } from "react";
import { WorkoutsPageLoading } from "@/components/workouts/v2/loading";
import { PageShell } from "@/components/nav/page-shell";
import {
  ExercisePickerPage,
  type PickerTarget,
} from "@/components/workouts/v2/exercise-picker";
import { WorkoutPageHeader } from "@/components/workouts/v2/page-header";
import { loadWorkoutContext, requireWorkoutsUser } from "../../data";

export const metadata = { title: "Add exercises" };

/**
 * The Add Exercises page, a dedicated full page (never a cramped panel).
 * `target` says where selections go: the workout builder draft ("draft"),
 * the live session ("session"), or a single swap ("replace" + wex id).
 */
export default function PickExercisesPage({
  searchParams,
}: {
  searchParams: Promise<{ target?: string; wex?: string }>;
}) {
  return (
    // Full-width desktop layout (LAY-1): the picker results render as a
    // multi-column card grid instead of one stacked list.
    <PageShell active="/workouts" className="max-w-[1500px]">
      <Suspense fallback={<WorkoutsPageLoading />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function Content({
  searchParams,
}: {
  searchParams: Promise<{ target?: string; wex?: string }>;
}) {
  const user = await requireWorkoutsUser();
  const context = await loadWorkoutContext(user);
  const params = await searchParams;
  const target: PickerTarget =
    params.target === "session" || params.target === "replace"
      ? params.target
      : "draft";
  const backLabel =
    target === "draft" ? "the workout builder" : "your workout";

  return (
    <>
      <WorkoutPageHeader
        back={{
          href: target === "draft" ? "/workouts/new" : "/workouts/active",
          label: target === "draft" ? "workout builder" : "your workout",
        }}
        subtitle={
          target === "replace"
            ? // Honest promise (canon 03 §44-46): replace keeps only the slot's
              // position and rest timer; logged sets are NOT carried over
              // (store "replace-session-exercise" + exerciseFromRef build a
              // fresh exercise). Never claim sets survive.
              "Select the exercise to put in this spot. It keeps the same position and rest timer, and starts with empty sets."
            : `Search or filter, select what you want, then add your picks to ${backLabel}.`
        }
        // Sentence case for titles (canon 04 §127 / Q-DS-4).
        title={target === "replace" ? "Replace exercise" : "Add exercises"}
      />
      <ExercisePickerPage
        customExercises={context.customExercises}
        lastSets={context.lastSets}
        prBaseline={context.prBaseline}
        replaceWexId={params.wex ?? null}
        target={target}
      />
    </>
  );
}
