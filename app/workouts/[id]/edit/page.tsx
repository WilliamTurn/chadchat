import { Suspense } from "react";
import Link from "next/link";
import { Toaster } from "sonner";
import { WorkoutsPageLoading } from "@/components/workouts/v2/loading";
import { PageShell } from "@/components/nav/page-shell";
import { WButton } from "@/components/workouts/v2/ui";
import { WorkoutEditor } from "@/components/workouts/v2/workout-editor";
import { getWorkoutTemplateById } from "@/lib/db/queries";
import { parseTemplateExercises } from "@/lib/validation/workout-templates";
import { requireWorkoutsUser } from "../../data";

export const metadata = { title: "Edit Workout" };

export default function EditWorkoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <PageShell active="/workouts">
      <Toaster position="top-center" theme="system" />
      <Suspense fallback={<WorkoutsPageLoading />}>
        <Content params={params} />
      </Suspense>
    </PageShell>
  );
}

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireWorkoutsUser();
  const { id } = await params;
  const template = await getWorkoutTemplateById({ id, userId: user.id });
  const exercises = template ? parseTemplateExercises(template.exercises) : null;

  if (!(template && exercises)) {
    return (
      <div className="py-24 text-center">
          <p className="font-bold text-[17px] text-foreground">
            This workout doesn&apos;t exist
          </p>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            It may have been deleted.
          </p>
        <Link className="mt-5 inline-block" href="/workouts">
          <WButton variant="primary">Back to Workouts</WButton>
        </Link>
      </div>
    );
  }

  return (
    <WorkoutEditor
        initialExercises={exercises.map((ex, i) => ({
          id: `dex-${template.id}-${i}`,
          name: ex.name,
          muscleGroup: ex.muscleGroup ?? null,
          equipment: ex.equipment ?? null,
          kind: ex.kind ?? "weighted",
          targetSets: ex.targetSets,
          repRangeMin: ex.repRangeMin,
          repRangeMax: ex.repRangeMax,
          restSeconds: ex.restSeconds,
          note: ex.note ?? null,
        }))}
      initialName={template.name}
      templateId={template.id}
    />
  );
}
