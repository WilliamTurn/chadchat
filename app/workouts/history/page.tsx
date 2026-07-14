import { Suspense } from "react";
import { WorkoutsPageLoading } from "@/components/workouts/v2/loading";
import { PageShell } from "@/components/nav/page-shell";
import { HistoryCard } from "@/components/workouts/v2/history-card";
import { WorkoutPageHeader } from "@/components/workouts/v2/page-header";
import { WCard } from "@/components/workouts/v2/ui";
import { getWorkoutsByUserId } from "@/lib/db/queries";
import { getResolveOptions } from "@/lib/workouts/canonical";
import { canonicalizeWorkouts } from "@/lib/workouts/exercise-identity";
import { toWorkoutData } from "@/lib/workouts/serialize";
import { prCountsByWorkout, type WorkoutData } from "@/lib/workouts/stats";
import { MAX_WORKOUTS, requireWorkoutsUser } from "../data";

export const metadata = { title: "Workout History" };

/** The permanent log of finished workouts, grouped by month. */
export default function HistoryPage() {
  return (
    // Full-width desktop layout (LAY-1): month groups render their workout
    // cards in a multi-column grid instead of one stacked column.
    <PageShell active="/workouts" className="max-w-[1500px]">
      <Suspense fallback={<WorkoutsPageLoading />}>
        <Content />
      </Suspense>
    </PageShell>
  );
}

async function Content() {
  const user = await requireWorkoutsUser();
  const [rawWorkouts, resolveOptions] = await Promise.all([
    getWorkoutsByUserId(user.id, MAX_WORKOUTS),
    getResolveOptions(user.id),
  ]);
  const workouts = rawWorkouts.map(toWorkoutData);
  // FIX-33: PR pills replay canonicalized history so records that merged
  // across aliases count the same here as everywhere else.
  const prCounts = prCountsByWorkout(
    canonicalizeWorkouts(workouts, resolveOptions)
  );

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
              {/* Explicit grid-cols-1 + min-w-0 children (LAY-1 gotcha): the
                  implicit column would size to max-content and clip phones.
                  Columns start at lg (768 content is too narrow beside the
                  sidebar for half-width cards). */}
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
                {group.items.map((workout) => (
                  <div className="min-w-0" key={workout.id}>
                    <HistoryCard
                      prCount={prCounts[workout.id] ?? 0}
                      workout={workout}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
