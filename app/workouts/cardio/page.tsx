import { Suspense } from "react";
import { PageShell } from "@/components/nav/page-shell";
import { CardioLog } from "@/components/workouts/v2/cardio-log";
import { WorkoutsPageLoading } from "@/components/workouts/v2/loading";
import { WorkoutPageHeader } from "@/components/workouts/v2/page-header";
import { toCalendarDayISO, todayAnchorInTz } from "@/lib/date";
import { getLatestWeighIn } from "@/lib/db/queries";
import { weighInKg } from "@/lib/progress/weight";
import { requireWorkoutsUser } from "../data";

export const metadata = { title: "Log Cardio" };

/** The Phase 3 cardio quick-log: activity + minutes → workout history. */
export default function LogCardioPage() {
  return (
    // The default focused frame: a picker + short form, not a wide layout.
    <PageShell active="/workouts">
      <Suspense fallback={<WorkoutsPageLoading />}>
        <Content />
      </Suspense>
    </PageShell>
  );
}

async function Content() {
  const user = await requireWorkoutsUser();
  const latest = await getLatestWeighIn(user.id);
  return (
    <>
      <WorkoutPageHeader
        back={{ href: "/workouts", label: "Workouts" }}
        subtitle="Ran, biked, swam, or played? Pick the activity and the minutes. It lands in your history, and the estimated calories count toward your day."
        title="Log Cardio"
      />
      <CardioLog
        todayISO={toCalendarDayISO(todayAnchorInTz(user.timezone))}
        weightKg={weighInKg(latest)}
      />
    </>
  );
}
