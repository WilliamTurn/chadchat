import { Suspense } from "react";
import Link from "next/link";
import { WorkoutsPageLoading } from "@/components/workouts/v2/loading";
import { PageShell } from "@/components/nav/page-shell";
import { toCustomExerciseData } from "@/components/workouts/v2/catalog";
import { CustomExerciseForm } from "@/components/workouts/v2/custom-exercise-form";
import { WorkoutPageHeader } from "@/components/workouts/v2/page-header";
import { WButton } from "@/components/workouts/v2/ui";
import { getCustomExercisesByUserId } from "@/lib/db/queries";
import { requireWorkoutsUser } from "../../../data";

export const metadata = { title: "Edit Custom Exercise" };

export default function EditCustomExercisePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    // Full-width desktop frame (LAY-1); the form lays itself out inside it.
    <PageShell active="/workouts" className="max-w-[1500px]">
      <Suspense fallback={<WorkoutsPageLoading />}>
        <Content params={params} />
      </Suspense>
    </PageShell>
  );
}

async function Content({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireWorkoutsUser();
  const { slug } = await params;
  const name = decodeURIComponent(slug).trim().toLowerCase();
  const customs = await getCustomExercisesByUserId(user.id);
  const existing = customs.find((c) => c.name.trim().toLowerCase() === name);

  if (!existing) {
    return (
      <div className="py-24 text-center">
          <p className="font-bold text-[17px] text-foreground">
            This isn&apos;t one of your custom exercises
          </p>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            Built-in exercises can&apos;t be edited.
          </p>
        <Link className="mt-5 inline-block" href="/workouts/exercises">
          <WButton variant="primary">Back to Exercises</WButton>
        </Link>
      </div>
    );
  }

  return (
    <>
      <WorkoutPageHeader
        back={{ href: "/workouts/exercises", label: "Exercises" }}
        subtitle="Changes apply going forward. Workouts you already logged keep the details they were logged with."
        title="Edit Custom Exercise"
      />
      <CustomExerciseForm
        backHref="/workouts/exercises"
        existing={toCustomExerciseData(existing)}
      />
    </>
  );
}
