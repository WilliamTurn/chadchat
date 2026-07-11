import { Suspense } from "react";
import { WorkoutsPageLoading } from "@/components/workouts/v2/loading";
import { PageShell } from "@/components/nav/page-shell";
import { HistoryCard } from "@/components/workouts/v2/history-card";
import { WorkoutPageHeader } from "@/components/workouts/v2/page-header";
import { WCard } from "@/components/workouts/v2/ui";
import { getWorkoutsByUserId } from "@/lib/db/queries";
import { toWorkoutData } from "@/lib/workouts/serialize";
import { prCountsByWorkout, type WorkoutData } from "@/lib/workouts/stats";
import { MAX_WORKOUTS, requireWorkoutsUser } from "../data";

export const metadata = { title: "Workout History" };

/** The permanent log of finished workouts, grouped by month. */
export default function HistoryPage() {
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
  const workouts = (await getWorkoutsByUserId(user.id, MAX_WORKOUTS)).map(
    toWorkoutData
  );
  const prCounts = prCountsByWorkout(workouts);

  const groups: { key: string; items: WorkoutData[] }[] = [];
  for (const workout of workouts) {
    const key = new Date(workout.performedAt).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
    const group = groups.find((g) => g.key === key);
    if (group) {
      group.items.push(workout);
    } else {
      groups.push({ key, items: [workout] });
    }
  }

  return (
    <>
      <WorkoutPageHeader
        back={{ href: "/workouts", label: "Workouts" }}
        subtitle={
          workouts.length > 0
            ? `${workouts.length} finished ${workouts.length === 1 ? "workout" : "workouts"}. Tap one to see every set.`
            : undefined
        }
        title="History"
      />

      {workouts.length === 0 ? (
        <WCard className="p-8 text-center">
          <p className="font-bold text-[16px] text-foreground">
            Workouts you finish will appear here
          </p>
          <p className="mx-auto mt-1.5 max-w-[320px] text-[13.5px] text-muted-foreground leading-relaxed">
            Start a workout from the Workouts page, check off your sets, and
            press Finish. The full record lands on this page.
          </p>
        </WCard>
      ) : (
        <div className="flex flex-col gap-6 pb-24">
          {groups.map((group) => (
            <section aria-label={group.key} key={group.key}>
              <h2 className="mb-2.5 font-black font-display text-[13px] text-muted-foreground/80 uppercase tracking-[0.14em]">
                {group.key}
              </h2>
              <div className="flex flex-col gap-3">
                {group.items.map((workout) => (
                  <HistoryCard
                    key={workout.id}
                    prCount={prCounts[workout.id] ?? 0}
                    workout={workout}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
