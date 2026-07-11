import { Suspense } from "react";
import { Toaster } from "sonner";
import { PageShell } from "@/components/nav/page-shell";
import { WorkoutsPageLoading } from "@/components/workouts/v2/loading";
import { WorkoutEditor } from "@/components/workouts/v2/workout-editor";
import { requireWorkoutsUser } from "../data";

export const metadata = { title: "New Workout" };

/** Build a new workout (a reusable plan). Nothing is logged from here. */
export default function NewWorkoutPage() {
  return (
    <PageShell active="/workouts">
      <Toaster position="top-center" theme="system" />
      <Suspense fallback={<WorkoutsPageLoading />}>
        <Content />
      </Suspense>
    </PageShell>
  );
}

async function Content() {
  await requireWorkoutsUser();
  return <WorkoutEditor initialExercises={[]} initialName="" templateId={null} />;
}
