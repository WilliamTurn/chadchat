import { Suspense } from "react";
import { Toaster } from "sonner";
import { WorkoutsPageLoading } from "@/components/workouts/v2/loading";
import { PageShell } from "@/components/nav/page-shell";
import { CustomExerciseForm } from "@/components/workouts/v2/custom-exercise-form";
import { WorkoutPageHeader } from "@/components/workouts/v2/page-header";
import { requireWorkoutsUser } from "../../data";

export const metadata = { title: "New Custom Exercise" };

/** Create a custom exercise on its own page. `from=pick` returns to the
 * picker afterwards so the flow continues where it started. */
export default function NewCustomExercisePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; target?: string; wex?: string }>;
}) {
  return (
    <PageShell active="/workouts">
      <Toaster position="top-center" theme="system" />
      <Suspense fallback={<WorkoutsPageLoading />}>
        <Content searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function Content({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; target?: string; wex?: string }>;
}) {
  await requireWorkoutsUser();
  const params = await searchParams;
  const backHref =
    params.from === "pick"
      ? `/workouts/exercises/pick?target=${params.target ?? "draft"}${
          params.wex ? `&wex=${params.wex}` : ""
        }`
      : "/workouts/exercises";
  return (
    <>
      <WorkoutPageHeader
        back={{
          href: backHref,
          label: params.from === "pick" ? "Add Exercises" : "Exercises",
        }}
        subtitle="Add a machine or movement we don't have. It joins your exercise picker and gets records, history, and a progress chart like any other exercise."
        title="New Custom Exercise"
      />
      <CustomExerciseForm backHref={backHref} />
    </>
  );
}
