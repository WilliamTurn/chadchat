import { Suspense } from "react";
import { PageShell } from "@/components/nav/page-shell";
import { WorkoutsPageLoading } from "@/components/workouts/v2/loading";
import { SessionPlayer } from "@/components/workouts/v2/session-player";
import { loadWorkoutContext, requireWorkoutsUser } from "../data";

export const metadata = { title: "Active workout" };

/** The active workout player. The run itself lives client-side (store +
 * localStorage); this page supplies history-derived context: "last time"
 * ghosts and PR baselines. (The finish step at ./finish owns the
 * update-plan option and loads the member's templates itself.) */
export default function ActiveWorkoutPage() {
  return (
    // Full-width desktop layout (LAY-1): the live exercise cards render
    // two-across on desktop instead of one stacked column.
    <PageShell active="/workouts" className="max-w-[1500px]">
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
    <SessionPlayer
      lastSets={context.lastSets}
      prBaseline={context.prBaseline}
    />
  );
}
