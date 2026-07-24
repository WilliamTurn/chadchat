import { Suspense } from "react";
import { PageShell } from "@/components/nav/page-shell";
import { FinishStep } from "@/components/workouts/v2/finish-step";
import { WorkoutsPageLoading } from "@/components/workouts/v2/loading";
import { getWorkoutTemplatesByUserId } from "@/lib/db/queries";
import { parseTemplateExercises } from "@/lib/validation/workout-templates";
import { requireWorkoutsUser } from "../../data";

export const metadata = { title: "Finish workout" };

/** The finish step of the live workout (composition canon 04 §11/§12: the
 * finish form outgrew its confirm dialog and escalates to its own page).
 * The session itself lives client-side (store + localStorage); this page
 * supplies the member's templates for the update-plan option. */
export default function FinishWorkoutPage() {
  return (
    <PageShell active="/workouts">
      <Suspense fallback={<WorkoutsPageLoading />}>
        <Content />
      </Suspense>
    </PageShell>
  );
}

async function Content() {
  const user = await requireWorkoutsUser();
  const rawTemplates = await getWorkoutTemplatesByUserId(user.id);
  const templates = rawTemplates.flatMap((t) => {
    const exercises = parseTemplateExercises(t.exercises);
    return exercises ? [{ id: t.id, name: t.name, exercises }] : [];
  });
  return <FinishStep templates={templates} />;
}
