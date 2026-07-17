import { Suspense } from "react";
import { ChevronRight, PartyPopper, Trophy } from "lucide-react";
import Link from "next/link";
import { WorkoutsPageLoading } from "@/components/workouts/v2/loading";
import { PageShell } from "@/components/nav/page-shell";
import { exerciseSlug } from "@/components/workouts/v2/catalog";
import {
  formatDay,
  formatDurationLong,
  formatVolume,
} from "@/components/workouts/v2/format";
import {
  DeleteWorkoutButton,
  DoneButton,
  RepeatWorkoutButton,
} from "@/components/workouts/v2/history-actions";
import {
  WorkoutBackLink,
  WorkoutPageHeader,
} from "@/components/workouts/v2/page-header";
import { Pill, WButton, WCard } from "@/components/workouts/v2/ui";
import { getWorkoutById } from "@/lib/db/queries";
import { toWorkoutData } from "@/lib/workouts/serialize";
import {
  workoutSetCount,
  workoutVolumeLb,
} from "@/lib/workouts/stats";
import { loadWorkoutContext, requireWorkoutsUser } from "../../data";

export const metadata = { title: "Workout" };

/** A friendly real-world equivalent for total volume. */
function volumeComparison(lb: number): string | null {
  if (lb >= 40_000) {
    return "about the weight of a loaded semi truck";
  }
  if (lb >= 24_000) {
    return "about the weight of two adult elephants";
  }
  if (lb >= 12_000) {
    return "about the weight of an adult elephant";
  }
  if (lb >= 5000) {
    return "about the weight of a pickup truck";
  }
  if (lb >= 3000) {
    return "about the weight of a small car";
  }
  if (lb >= 1000) {
    return "about the weight of a grand piano";
  }
  return null;
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <WCard className="p-4 text-center">
      <div className="font-bold font-mono text-[24px] text-foreground leading-none tabular-nums">
        {value}
      </div>
      <div className="mt-1.5 text-[12px] text-muted-foreground leading-snug">
        {label}
      </div>
    </WCard>
  );
}

export default function WorkoutDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  return (
    // Full-width desktop layout (LAY-1): the per-exercise breakdown renders
    // two-across on desktop instead of one stacked column.
    <PageShell active="/workouts" className="max-w-[1500px]">
      <Suspense fallback={<WorkoutsPageLoading />}>
        <Content params={params} searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function Content({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const user = await requireWorkoutsUser();
  const { id } = await params;
  const isNew = (await searchParams).new === "1";
  const [row, context] = await Promise.all([
    getWorkoutById({ id, userId: user.id }),
    loadWorkoutContext(user),
  ]);

  if (!row) {
    return (
      <div className="py-24 text-center">
          <p className="font-bold text-[17px] text-foreground">
            This workout isn&apos;t here
          </p>
          <p className="mt-1.5 text-[14px] text-muted-foreground">
            It may have been deleted.
          </p>
        <Link className="mt-5 inline-block" href="/workouts/history">
          <WButton variant="primary">Back to History</WButton>
        </Link>
      </div>
    );
  }

  const workout = toWorkoutData(row);
  const volume = workoutVolumeLb(workout);
  const sets = workoutSetCount(workout);
  const comparison = volumeComparison(volume);
  const duration = workout.durationSeconds
    ? formatDurationLong(workout.durationSeconds)
    : null;

  return (
    <>
      {isNew ? (
        /* ---- Celebration header (just finished) ---- */
        <>
          {/* RC-1 (CMP-15/16): the celebration view replaces the standard
              header, which used to cost it the top back control every other
              workout page has. Explicit destination, not history: the page
              behind this one is the dead just-finished session. */}
          <WorkoutBackLink href="/workouts" label="Workouts" />
          <div className="mb-6 animate-in text-center duration-500 slide-in-from-bottom-4">
            <div className="mx-auto mb-4 flex size-16 animate-in items-center justify-center rounded-3xl bg-blood text-white shadow-[0_16px_48px_rgba(164,22,26,0.35)] zoom-in-75 duration-500">
              <PartyPopper aria-hidden className="size-8" />
            </div>
            <h1 className="font-black font-display text-[32px] text-foreground uppercase leading-none tracking-tight">
              Workout complete
            </h1>
            <p className="mt-2 text-[14.5px] text-muted-foreground">
              {workout.title} · saved to your history. Chad sees it too.
            </p>
          </div>
        </>
      ) : (
        <WorkoutPageHeader
          back={{ href: "/workouts/history", label: "History" }}
          subtitle={formatDay(new Date(workout.performedAt).getTime())}
          title={workout.title}
        />
      )}

      {/* Stats */}
      <div className={`grid gap-3 ${duration ? "grid-cols-3" : "grid-cols-2"}`}>
        {duration && <StatTile label="Duration" value={duration} />}
        <StatTile label="Sets logged" value={String(sets)} />
        <StatTile label="lb moved" value={formatVolume(volume)} />
      </div>
      <p className="mt-2.5 text-center text-[13px] text-muted-foreground leading-relaxed">
        &ldquo;lb moved&rdquo; is weight × reps, added up across every set
        {comparison
          ? `. ${formatVolume(volume)} lb is ${comparison}.`
          : "."}
      </p>

      {workout.notes && (
        <WCard className="mt-5 p-4">
          <h2 className="font-black text-[13px] text-muted-foreground/80 uppercase tracking-[0.14em]">
            Your notes
          </h2>
          <p className="mt-1.5 whitespace-pre-wrap text-[14.5px] text-foreground leading-relaxed">
            {workout.notes}
          </p>
        </WCard>
      )}

      {/* Per-exercise breakdown */}
      <h2 className="mt-7 mb-2.5 font-black font-display text-[13px] text-muted-foreground/80 uppercase tracking-[0.14em]">
        What you did
      </h2>
      {/* Two-across on desktop (LAY-1); explicit grid-cols-1 + min-w-0 cards
          so the implicit column never sizes to max-content on phones. */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {workout.exercises.map((ex, exIndex) => {
          let workingIndex = 0;
          const timed = ex.kind === "timed";
          return (
            <WCard className="min-w-0 p-4" key={`${ex.name}-${exIndex}`}>
              <Link
                className="group flex min-h-[44px] items-center justify-between gap-2"
                href={`/workouts/exercises/${exerciseSlug(ex.name)}`}
              >
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-[15.5px] text-foreground group-hover:underline">
                    {ex.name}
                  </h3>
                  <p className="text-[12px] text-muted-foreground/80">
                    Tap for your records &amp; progress
                  </p>
                </div>
                <ChevronRight
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground/70 transition group-hover:text-muted-foreground"
                />
              </Link>
              {ex.notes && (
                <p className="mt-1.5 rounded-lg bg-muted/50 px-2 py-1 text-[12.5px] text-muted-foreground">
                  {ex.notes}
                </p>
              )}
              <div className="mt-2 flex flex-col">
                {ex.sets.map((set, setIndex) => {
                  if (set.setType !== "warmup") {
                    workingIndex++;
                  }
                  const isWarmup = set.setType === "warmup";
                  return (
                    <div
                      className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${isWarmup ? "opacity-60" : ""}`}
                      key={`${ex.name}-${setIndex}`}
                    >
                      <span className="w-8 text-center font-bold font-mono text-[13px] text-muted-foreground/80">
                        {isWarmup ? "W" : workingIndex}
                      </span>
                      <span className="flex-1 font-mono text-[15px] text-foreground tabular-nums">
                        {(() => {
                          if (timed) {
                            return set.reps == null
                              ? "Done (no seconds entered)"
                              : `${set.reps} seconds`;
                          }
                          if (set.weight == null && set.reps == null) {
                            return "Done (no numbers entered)";
                          }
                          return `${set.weight ?? 0} ${set.unit} × ${set.reps ?? 0}`;
                        })()}
                      </span>
                      {set.rpe != null && (
                        <span className="text-[11.5px] text-muted-foreground">
                          RPE {set.rpe}
                        </span>
                      )}
                      {isWarmup && (
                        <span className="text-[11.5px] text-muted-foreground/80">
                          warm-up
                        </span>
                      )}
                      {set.setType === "dropset" && (
                        <span className="text-[11.5px] text-purple-500 dark:text-purple-300">
                          drop set
                        </span>
                      )}
                      {set.setType === "failure" && (
                        <span className="text-[11.5px] text-blood">
                          to failure
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </WCard>
          );
        })}
      </div>

      {/* Footer actions: stacked on phones; on desktop the primary Repeat
          sits left with the destructive Delete separated to the right (the
          s180 goals-edit ruling). */}
      <div className="mt-8 pb-24">
        {isNew ? (
          /* The celebration view is centered, so its action centers too. */
          <div className="flex sm:justify-center">
            <DoneButton />
          </div>
        ) : (
          <div className="flex flex-col gap-3 border-border border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
            <RepeatWorkoutButton
              customExercises={context.customExercises}
              lastSets={context.lastSets}
              unit={context.unit}
              workout={workout}
            />
            <DeleteWorkoutButton workoutId={workout.id} />
          </div>
        )}
      </div>
    </>
  );
}
