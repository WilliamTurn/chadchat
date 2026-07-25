import { Suspense } from "react";
import { Pencil, Trophy } from "lucide-react";
import Link from "next/link";
import { WorkoutsPageLoading } from "@/components/workouts/v2/loading";
import { PageShell } from "@/components/nav/page-shell";
import {
  equipmentLabel,
  exerciseSlug,
  findInCatalog,
  mergeCatalog,
  muscleLabel,
} from "@/components/workouts/v2/catalog";
import { formatDay, formatWeight } from "@/components/workouts/v2/format";
import { WorkoutPageHeader } from "@/components/workouts/v2/page-header";
import { ProgressChart } from "@/components/workouts/v2/progress-chart";
import { Pill, WButton, WCard } from "@/components/workouts/v2/ui";
import { resolveExerciseIdentity } from "@/lib/workouts/exercise-identity";
import { exerciseCue } from "@/lib/workouts/exercise-library";
import { epley1RM, toLb, type WorkoutData } from "@/lib/workouts/stats";
import { loadWorkoutContext, requireWorkoutsUser } from "../../data";

export const metadata = { title: "Exercise" };

/** Per-session best e1RM series for the progress chart, oldest first. */
function e1rmSeries(workouts: WorkoutData[], name: string) {
  const key = name.trim().toLowerCase();
  const points: { date: number; value: number; label: string }[] = [];
  for (const w of [...workouts].sort(
    (a, b) =>
      new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime()
  )) {
    let best = 0;
    let label = "";
    for (const ex of w.exercises) {
      if (ex.name.trim().toLowerCase() !== key) {
        continue;
      }
      for (const s of ex.sets) {
        if (!s.completed || s.setType === "warmup" || s.weight == null) {
          continue;
        }
        const e = epley1RM(s.weight, s.reps);
        if (e != null && toLb(e, s.unit) > best) {
          best = toLb(e, s.unit);
          label = `${s.weight} ${s.unit} × ${s.reps}`;
        }
      }
    }
    if (best > 0) {
      points.push({
        date: new Date(w.performedAt).getTime(),
        value: best,
        label,
      });
    }
  }
  return points;
}

/** All past performances of this exercise, newest first. */
function pastSessions(workouts: WorkoutData[], name: string) {
  const key = name.trim().toLowerCase();
  return workouts
    .filter((w) =>
      w.exercises.some(
        (ex) =>
          ex.name.trim().toLowerCase() === key &&
          ex.sets.some((s) => s.completed)
      )
    )
    .map((w) => ({
      workout: w,
      exercise: w.exercises.find(
        (ex) => ex.name.trim().toLowerCase() === key
      )!,
    }));
}

export default function ExerciseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  return (
    // Full-width desktop layout (LAY-1): how-to/records/progress beside the
    // past-session log on desktop, stacked on phones.
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
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const user = await requireWorkoutsUser();
  const context = await loadWorkoutContext(user);
  const { slug } = await params;
  // S6 #6: the session player links here with ?from=workout so back controls
  // return to the active workout instead of dumping into the library.
  const { from } = await searchParams;
  const fromWorkout = from === "workout";
  const name = decodeURIComponent(slug);
  const catalog = mergeCatalog(context.customExercises);
  const entry = findInCatalog(catalog, name);
  // FIX-33: an alias URL ("bench press") lands on the canonical identity's
  // merged history; records and progress read canonicalized workouts so
  // variants that merged count here too.
  const analyticsName = resolveExerciseIdentity(
    name,
    context.resolveOptions
  ).canonicalName;
  // History may contain exercises no longer in the catalog, still show them.
  const loggedHere = pastSessions(context.canonicalWorkouts, analyticsName);

  if (!entry && loggedHere.length === 0) {
    // Error state, not an empty state (canon 03 §65): the slug is unknown, so
    // never show first-use copy here. Canon 03 §51: statement + way forward,
    // never strand; canon 04 §140: the link names its destination.
    return (
      <div className="py-24 text-center">
        <p className="font-bold text-[17px] text-foreground">
          Exercise not found
        </p>
        <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
          No exercise matches this link. It may have been renamed or deleted.
          Search your exercise library to find it.
        </p>
        <Link
          className="mt-5 inline-block"
          href={fromWorkout ? "/workouts/active" : "/workouts/exercises"}
        >
          <WButton variant="primary">
            {fromWorkout ? "Back to your workout" : "Back to Exercises"}
          </WButton>
        </Link>
      </div>
    );
  }

  const displayName = entry?.name ?? loggedHere[0].exercise.name;
  const timed = entry
    ? entry.kind === "timed"
    : loggedHere[0]?.exercise.kind === "timed";
  const cue = exerciseCue(displayName);
  const custom = entry?.custom
    ? context.customExercises.find(
        (c) => c.name.trim().toLowerCase() === displayName.trim().toLowerCase()
      )
    : undefined;
  const best = context.prBaseline[displayName.trim().toLowerCase()];
  const series = e1rmSeries(context.canonicalWorkouts, analyticsName);

  return (
    <>
      <WorkoutPageHeader
        action={
          custom ? (
            <Link href={`/workouts/exercises/${exerciseSlug(displayName)}/edit`}>
              <WButton size="sm">
                <Pencil aria-hidden className="size-4" />
                Edit
              </WButton>
            </Link>
          ) : undefined
        }
        back={
          // S6 #6: arriving from the active workout, back returns to it
          // (canon 04 §140: the control names its destination).
          fromWorkout
            ? { href: "/workouts/active", label: "your workout" }
            : { href: "/workouts/exercises", label: "Exercises" }
        }
        title={displayName}
      />
      <div className="-mt-2 mb-5 flex flex-wrap gap-1.5">
        {entry?.muscleGroup && <Pill>{muscleLabel(entry.muscleGroup)}</Pill>}
        {entry?.equipment && <Pill>{equipmentLabel(entry.equipment)}</Pill>}
        {entry?.kind === "bodyweight" && (
          <Pill>Bodyweight, log added weight</Pill>
        )}
        {timed && <Pill>Timed, log seconds per set</Pill>}
        {entry?.custom && <Pill tone="blood">Your exercise</Pill>}
      </div>

      {/* Full-width desktop layout (LAY-1): the info column (how-to, records,
          progress) sits beside the past-session log at xl; phones keep the
          stacked order. Explicit grid-cols-1 + min-w-0 columns (the implicit
          column would size to max-content and clip phones under
          overflow-x: clip); [&>:first-child]:mt-0 aligns both column tops. */}
      <div
        className={`grid grid-cols-1 items-start gap-8 pb-24 ${
          cue || custom?.notes || !timed ? "xl:grid-cols-2" : ""
        }`}
      >
        {(cue || custom?.notes || !timed) && (
          <div className="min-w-0 [&>:first-child]:mt-0">
            {/* How to */}
            {(cue || custom?.notes) && (
              <WCard className="p-4">
                <h2 className="font-black text-[13px] text-muted-foreground/80 uppercase tracking-[0.14em]">
                  {custom?.notes ? "Your setup notes" : "How to do it"}
                </h2>
                <p className="mt-1.5 text-[14.5px] text-foreground leading-relaxed">
                  {custom?.notes ?? cue}
                </p>
              </WCard>
            )}

            {/* Records */}
            {!timed && (
              <>
                <h2 className="mt-7 mb-2.5 font-black font-display text-[13px] text-muted-foreground/80 uppercase tracking-[0.14em]">
                  Your records
                </h2>
                {!best || best.bestWeightLb === 0 ? (
                  <WCard className="p-6 text-center">
                    <p className="font-semibold text-[15px] text-foreground">
                      No records yet
                    </p>
                    {/* Canon 03 §62: empty states say why and how to fill. */}
                    <p className="mx-auto mt-1 max-w-[300px] text-[13.5px] text-muted-foreground">
                      Your heaviest lift and estimated strength appear after
                      your first logged set.
                    </p>
                  </WCard>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <WCard className="p-4">
                      <div className="flex items-center gap-1.5">
                        <Trophy
                          aria-hidden
                          className="size-3.5 text-amber-500 dark:text-amber-300"
                        />
                        <span className="font-bold text-[11.5px] text-muted-foreground uppercase tracking-wide">
                          Heaviest weight
                        </span>
                      </div>
                      <div className="mt-2 font-bold font-mono text-[26px] text-foreground leading-none tabular-nums">
                        {formatWeight(best.bestWeightLb)}{" "}
                        <span className="text-[15px] text-muted-foreground">lb</span>
                      </div>
                      <p className="mt-1.5 text-[12px] text-muted-foreground leading-snug">
                        The most weight you&apos;ve ever lifted for at least one rep.
                      </p>
                    </WCard>
                    <WCard className="p-4">
                      <div className="flex items-center gap-1.5">
                        <Trophy
                          aria-hidden
                          className="size-3.5 text-amber-500 dark:text-amber-300"
                        />
                        <span className="font-bold text-[11.5px] text-muted-foreground uppercase tracking-wide">
                          Estimated strength
                        </span>
                      </div>
                      <div className="mt-2 font-bold font-mono text-[26px] text-foreground leading-none tabular-nums">
                        {formatWeight(Math.round(best.bestE1RMLb))}{" "}
                        <span className="text-[15px] text-muted-foreground">lb</span>
                      </div>
                      <p className="mt-1.5 text-[12px] text-muted-foreground leading-snug">
                        The most Chad estimates you could lift once, based on your best
                        set.
                      </p>
                    </WCard>
                  </div>
                )}

                {/* Progress */}
                <h2 className="mt-7 mb-2.5 font-black font-display text-[13px] text-muted-foreground/80 uppercase tracking-[0.14em]">
                  Your progress
                </h2>
                <WCard className="p-4">
                  <p className="mb-3 text-[12.5px] text-muted-foreground leading-snug">
                    Each dot is one workout, plotted by estimated strength that day.
                    Light days dip the line. The direction over weeks is what
                    matters.
                  </p>
                  <ProgressChart points={series} />
                </WCard>
              </>
            )}
          </div>
        )}

        {/* Past sessions */}
        <div className="min-w-0 [&>:first-child]:mt-0">
          <h2 className="mt-7 mb-2.5 font-black font-display text-[13px] text-muted-foreground/80 uppercase tracking-[0.14em]">
            Every time you&apos;ve done it
          </h2>
          {loggedHere.length === 0 ? (
            // Canon 03 §62: empty states say why and how to fill.
            <WCard className="p-6 text-center">
              <p className="font-semibold text-[15px] text-foreground">
                Not logged yet
              </p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                Every workout you do this exercise in will be listed here.
              </p>
            </WCard>
          ) : (
            <div className="flex flex-col gap-3">
              {loggedHere.map(({ workout, exercise }) => {
                let workingIndex = 0;
                return (
                  <WCard className="p-4" key={workout.id}>
                    <Link
                      className="flex min-h-[44px] items-center justify-between gap-2"
                      href={`/workouts/history/${workout.id}`}
                    >
                      <span className="truncate font-bold text-[14.5px] text-foreground hover:underline">
                        {workout.title}
                      </span>
                      <span className="shrink-0 text-[12.5px] text-muted-foreground/80">
                        {formatDay(new Date(workout.performedAt).getTime())}
                      </span>
                    </Link>
                    <div className="mt-2 flex flex-col gap-1">
                      {exercise.sets
                        .filter((s) => s.completed)
                        .map((set, i) => {
                          if (set.setType !== "warmup") {
                            workingIndex++;
                          }
                          return (
                            <div
                              className="flex items-center gap-3 px-1"
                              key={`${workout.id}-${i}`}
                            >
                              <span className="w-6 text-center font-bold font-mono text-[12.5px] text-muted-foreground/80">
                                {set.setType === "warmup" ? "W" : workingIndex}
                              </span>
                              <span className="font-mono text-[14px] text-foreground tabular-nums">
                                {(() => {
                                  if (timed) {
                                    return set.reps == null
                                      ? "Done"
                                      : `${set.reps}s`;
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
                            </div>
                          );
                        })}
                    </div>
                  </WCard>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
