import { Suspense } from "react";
import { StandaloneHeader } from "@/components/nav/standalone-header";
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
    <PageShell>
      <StandaloneHeader active="/workouts" />
      <WorkoutPageHeader
        back={{ href: "/workouts", label: "Workouts" }}
        subtitle="Tap any exercise for how-to, your records, and your progress. Create your own for anything we don't have."
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
