import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageShell } from "@/components/nav/page-shell";
import { exerciseSlug } from "@/components/workouts/v2/catalog";
import { CompleteCelebration } from "@/components/workouts/v2/complete-celebration";
import { FactsBand } from "@/components/workouts/v2/facts-band";
import {
  formatClock,
  formatDay,
  formatDurationLong,
  formatVolume,
} from "@/components/workouts/v2/format";
import {
  DeleteWorkoutButton,
  DoneButton,
  RepeatWorkoutButton,
} from "@/components/workouts/v2/history-actions";
import { WorkoutsPageLoading } from "@/components/workouts/v2/loading";
import {
  WorkoutBackLink,
  WorkoutPageHeader,
} from "@/components/workouts/v2/page-header";
import { WButton, WCard } from "@/components/workouts/v2/ui";
import { getLatestWeighIn, getWorkoutById } from "@/lib/db/queries";
import {
  isCardioOnlySession,
  sessionNetKcal,
} from "@/lib/energy/workout-energy";
import { weighInKg } from "@/lib/progress/weight";
import { toWorkoutData } from "@/lib/workouts/serialize";
import { workoutSetCount, workoutVolumeLb } from "@/lib/workouts/stats";
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
  const [row, context, latestWeighIn] = await Promise.all([
    getWorkoutById({ id, userId: user.id }),
    loadWorkoutContext(user),
    getLatestWeighIn(user.id),
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
          <WButton variant="primary">Back to Workout History</WButton>
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
  // energy.workout.kcal via its registered source symbol (Phase 3); null =
  // no weigh-in or no computable component, and no tile renders.
  const estimatedKcal = sessionNetKcal(workout, weighInKg(latestWeighIn));
  // A logged run/ride is not a lift: set counts and "0 lb moved" are noise.
  const cardioOnly = isCardioOnlySession(workout);

  return (
    <>
      {isNew ? (
        /* ---- Celebration header (just finished) ---- */
        <>
          {/* RC-1 (CMP-15/16): the celebration view replaces the standard
              header, which used to cost it the top back control every other
              workout page has. Explicit destination, not history: the page
              behind this one is the dead just-finished workout.
              RC-11 (Q-28, owner ruling 2026-07-19): the top control points at
              Home, so finishing a workout has a one-tap route back to the main
              surface. The bottom "Done, back to Workouts" stays, so both
              destinations are reachable and neither is duplicated. */}
          <WorkoutBackLink href="/home" label="Home" />
          {/* S2 (owner order 2026-07-22): the struck-gold medal celebration
              replaces the red PartyPopper square. Gold = earned (Q-C reward);
              motion + reduced-motion story live in complete-celebration.css. */}
          <CompleteCelebration title={workout.title} />
        </>
      ) : (
        <WorkoutPageHeader
          back={{ href: "/workouts/history", label: "Workout History" }}
          subtitle={formatDay(new Date(workout.performedAt).getTime())}
          title={workout.title}
        />
      )}

      {/* Stats: the flat key-facts band (W5, audit F-2; comp-canon 05
          #35/#87: the boxed StatTile grid passed none of 01 §4's earning
          tests). Cardio-only sessions drop the lifting facts (set count,
          "0 lb moved"); the burn estimate renders whenever it's computable
          and is always labeled estimated (Phase 3). */}
      {(() => {
        /* Peer unit grammar (W5 comp-audit F-4): labels are the measures'
           names, figures carry their units inline ("11,895 lb", "~253
           cal"); a bare count ("9") is named by its label. "Volume" is the
           established member-facing name for weight x reps (the
           /progress/training label), one term per concept. */
        const facts: { label: string; value: string }[] = [
          ...(duration ? [{ label: "Duration", value: duration }] : []),
          ...(cardioOnly
            ? []
            : [
                { label: "Sets logged", value: String(sets) },
                { label: "Volume", value: `${formatVolume(volume)} lb` },
              ]),
          ...(estimatedKcal != null
            ? [
                {
                  label: "Calories",
                  value: `~${estimatedKcal.toLocaleString()} cal`,
                },
              ]
            : []),
        ];
        const notes = [
          ...(cardioOnly
            ? []
            : [
                `Volume is the total weight you moved: weight × reps, added up across every set${
                  comparison
                    ? `. ${formatVolume(volume)} lb is ${comparison}`
                    : ""
                }.`,
              ]),
          ...(estimatedKcal != null
            ? [
                "Calories are estimated from your time and effort at your body weight.",
              ]
            : []),
        ];
        return (
          <>
            {/* mt-4 + the 24px above it = the page's 40px zone seam
                (comp-audit F-1: seams must clear 2x the 16px in-zone
                gaps; the header's mb-6 and the celebration's mb both
                measure 24px, and flex-col margins do not collapse). */}
            {facts.length > 0 && (
              <FactsBand center={isNew} className="mt-4" facts={facts} />
            )}
            {notes.length > 0 && (
              /* Explanatory footnote: bound to the band (12px), on the
                 left spine in both states at a capped measure. A centered
                 3-4 line paragraph re-hunts its left edge on every line
                 (taste-audit F-4), so only the band centers on the
                 celebration; the footnote opens the read register. */
              <p className="mt-3 max-w-prose text-[13px] text-muted-foreground leading-relaxed">
                {notes.join(" ")}
              </p>
            )}
          </>
        );
      })()}

      {/* mt-10 zone seams below here (comp-audit F-1): three rhythm tiers,
          8px inside a lockup, 12-16px inside a zone, 40px between zones. */}
      {workout.notes && (
        <WCard className="mt-10 p-4">
          {/* Full-strength muted ink on the 13px headers and set indexes:
              the /80 alpha put them under 4.5:1 (this surface's pinned
              axe nodes; W5 owns the call-site fixes). */}
          <h2 className="font-black text-[13px] text-muted-foreground uppercase tracking-[0.14em]">
            Your notes
          </h2>
          <p className="mt-1.5 max-w-prose whitespace-pre-wrap text-[14.5px] text-foreground leading-relaxed">
            {workout.notes}
          </p>
        </WCard>
      )}

      {/* Per-exercise breakdown */}
      <h2 className="mt-10 mb-2.5 font-black font-display text-[13px] text-muted-foreground uppercase tracking-[0.14em]">
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
                  {/* Device-neutral verb (copy law device-verb) at the
                      13px label floor, full-strength muted ink (the
                      pinned axe contrast node class; taste-audit F-1). */}
                  <p className="text-meta text-muted-foreground">
                    See your records &amp; progress
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
                    /* Warm-up rows dim via muted ink, not a row-level
                       opacity-60: the compounded alpha put 13px text at
                       2.5:1 (pinned axe node). Working rows keep bright
                       set values, so the three-state read survives. */
                    <div
                      className="flex items-center gap-3 rounded-lg px-2 py-1.5"
                      key={`${ex.name}-${setIndex}`}
                    >
                      <span className="w-8 text-center font-bold font-mono text-[13px] text-muted-foreground">
                        {isWarmup ? "W" : workingIndex}
                      </span>
                      <span
                        className={`flex-1 font-mono text-[15px] tabular-nums ${isWarmup ? "text-muted-foreground" : "text-foreground"}`}
                      >
                        {(() => {
                          if (timed) {
                            if (set.reps == null) {
                              return "Done (no seconds entered)";
                            }
                            // Long timed work reads as a clock ("30:00"),
                            // not "1800 seconds" (cardio sessions).
                            return set.reps >= 120
                              ? `${formatClock(set.reps)} min`
                              : `${set.reps} seconds`;
                          }
                          if (set.weight == null && set.reps == null) {
                            return "Done (no numbers entered)";
                          }
                          return `${set.weight ?? 0} ${set.unit} × ${set.reps ?? 0}`;
                        })()}
                      </span>
                      {/* Set annotations: one quiet muted treatment at the
                          13px floor (taste-audit F-1: 11.5px broke the
                          permanent type floor; F-5: stock purple belongs
                          to sleep). "to failure" alone keeps the red
                          family in its AA text form (blood-text, 5.7:1
                          dark) as the max-effort marker. */}
                      {set.rpe != null && (
                        <span className="text-meta text-muted-foreground">
                          RPE {set.rpe}
                        </span>
                      )}
                      {isWarmup && (
                        <span className="text-meta text-muted-foreground">
                          warm-up
                        </span>
                      )}
                      {set.setType === "dropset" && (
                        <span className="text-meta text-muted-foreground">
                          drop set
                        </span>
                      )}
                      {set.setType === "failure" && (
                        <span className="text-meta text-blood-text">
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
