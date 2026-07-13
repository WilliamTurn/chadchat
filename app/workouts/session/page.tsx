import { Suspense } from "react";
import { Toaster } from "sonner";
import { WorkoutsPageLoading } from "@/components/workouts/v2/loading";
import { PageShell } from "@/components/nav/page-shell";
import { SessionPlayer } from "@/components/workouts/v2/session-player";
import { getWorkoutTemplatesByUserId } from "@/lib/db/queries";
import { parseTemplateExercises } from "@/lib/validation/workout-templates";
import { loadWorkoutContext, requireWorkoutsUser } from "../data";

export const metadata = { title: "Workout in Progress" };

/** The live workout player. The session itself lives client-side (store +
 * localStorage); this page supplies history-derived context: "last time"
 * ghosts, PR baselines, and the member's templates for the update-plan
 * checkbox on Finish. */
export default function SessionPage() {
  return (
    // Full-width desktop layout (LAY-1): the live exercise cards render
    // two-across on desktop instead of one stacked column.
    <PageShell active="/workouts" className="max-w-[1500px]">
      <Toaster position="top-center" richColors theme="system" />
      <Suspense fallback={<WorkoutsPageLoading />}>
        <Content />
      </Suspense>
    </PageShell>
  );
}

async function Content() {
  const user = await requireWorkoutsUser();
  const [context, rawTemplates] = await Promise.all([
    loadWorkoutContext(user),
    getWorkoutTemplatesByUserId(user.id),
  ]);
  const templates = rawTemplates.flatMap((t) => {
    const exercises = parseTemplateExercises(t.exercises);
    return exercises ? [{ id: t.id, name: t.name, exercises }] : [];
  });
  return (
    <SessionPlayer
      lastSets={context.lastSets}
      prBaseline={context.prBaseline}
      templates={templates}
    />
  );
}
