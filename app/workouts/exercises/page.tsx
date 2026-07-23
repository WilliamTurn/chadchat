import { Suspense } from "react";
import { WorkoutsPageLoading } from "@/components/workouts/v2/loading";
import { PageShell } from "@/components/nav/page-shell";
import { ExerciseLibrary } from "@/components/workouts/v2/exercise-library-page";
import { WorkoutPageHeader } from "@/components/workouts/v2/page-header";
import { loadWorkoutContext, requireWorkoutsUser } from "../data";

export const metadata = { title: "Exercises" };

/** The exercise catalog: built-ins + the member's own, each linking to its
 * records and progress. */
export default function ExercisesPage() {
  return (
    // Full-width desktop layout (LAY-1): the catalog renders as a
    // multi-column card grid instead of one stacked list.
    <PageShell active="/workouts" className="max-w-[1500px]">
      <WorkoutPageHeader
        back={{ href: "/workouts", label: "Workouts" }}
        subtitle="Select any exercise for how-to, your records, and your progress. Create your own for anything that's missing."
        title="Exercises"
      />
      <Suspense fallback={<WorkoutsPageLoading />}>
        <Content />
      </Suspense>
    </PageShell>
  );
}

async function Content() {
  const user = await requireWorkoutsUser();
  const context = await loadWorkoutContext(user);
  return (
    <ExerciseLibrary
      customExercises={context.customExercises}
      prBaseline={context.prBaseline}
    />
  );
}
