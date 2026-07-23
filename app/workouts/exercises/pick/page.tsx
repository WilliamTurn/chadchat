import { Suspense } from "react";
import { WorkoutsPageLoading } from "@/components/workouts/v2/loading";
import { PageShell } from "@/components/nav/page-shell";
import {
  ExercisePickerPage,
  type PickerTarget,
} from "@/components/workouts/v2/exercise-picker";
import { WorkoutPageHeader } from "@/components/workouts/v2/page-header";
import { loadWorkoutContext, requireWorkoutsUser } from "../../data";

export const metadata = { title: "Add Exercises" };

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
            ? "Select an exercise to swap it in. Your sets and your place in the workout are kept."
            : `Search or filter, tap to select, then add your picks to ${backLabel}.`
        }
        title={target === "replace" ? "Replace Exercise" : "Add Exercises"}
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
