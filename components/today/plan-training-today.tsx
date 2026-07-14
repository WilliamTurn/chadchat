import { Dumbbell } from "lucide-react";
import Link from "next/link";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { SegmentStrip } from "@/components/charts/segment-strip";
import { PlanPanel } from "@/components/panels/roles";
import { Button } from "@/components/ui/button";
import type { TrainingTodayData } from "@/lib/today/plans-goals-data";
import { cn } from "@/lib/utils";

/**
 * TRAINING TODAY (FIX-30). The plans-band summary of the member's next
 * training session: session name, rotation position, a substantive exercise
 * preview (name + sets x reps, the Boostcamp/Hevy card grammar from the
 * rule-8 teardown), and the week's plan completion. The session verdict is
 * P34-D's selectUpNextSession via the canonical assembler: this card and Up
 * next can never name different sessions.
 *
 * Answers "what's next" in EVERY state (the TrainingPeaks bar): trained
 * today shows the completed session as a reward and still names the next
 * one; a document plan names itself and opens; no plan explains the path.
 * PlanPanel role: the next actionable slice, never the document.
 */

const EXERCISE_PREVIEW_LIMIT = 4;

export function PlanTrainingToday({
  data,
  canStartWorkout = true,
  className,
}: {
  /** null = no active training plan (the designed empty state). */
  data: TrainingTodayData | null;
  /** Below Pro the logger is gated, so the Start CTA is withheld; the plan
   *  itself (a member capability) still summarizes and opens. */
  canStartWorkout?: boolean;
  className?: string;
}) {
  const verdict = data?.verdict ?? null;
  const trainedToday = data?.trainedToday === true;

  const rotationStrip =
    data && data.rotation.length > 0 ? (
      <div className="flex flex-col gap-1.5">
        <SegmentStrip
          accent="blood"
          label={`${data.planTitle} rotation`}
          segments={data.rotation.map((s, i) => ({
            key: `${s.name}-${i}`,
            status:
              !trainedToday && verdict && i === verdict.session.position
                ? "next"
                : s.completedThisWeek
                  ? "done"
                  : "upcoming",
            label: `${s.name}${
              !trainedToday && verdict && i === verdict.session.position
                ? " (next)"
                : s.completedThisWeek
                  ? " (done this week)"
                  : ""
            }`,
          }))}
        />
        {data.adherence && (
          <p
            className={cn(
              "text-meta text-muted-foreground",
              data.adherence.completedThisWeek >=
                data.adherence.plannedPerWeek && "text-positive-text"
            )}
          >
            {data.adherence.completedThisWeek} of{" "}
            {data.adherence.plannedPerWeek} plan sessions this week
          </p>
        )}
      </div>
    ) : null;

  const exercisePreview =
    verdict && verdict.session.exercises.length > 0 ? (
      <div className="flex flex-wrap gap-1.5">
        {verdict.session.exercises
          .slice(0, EXERCISE_PREVIEW_LIMIT)
          .map((ex) => (
            <span
              className="rounded-lg border border-border bg-background/40 px-2.5 py-1 text-body-sm text-muted-foreground"
              key={ex.name}
            >
              <span className="font-medium text-foreground">{ex.name}</span>{" "}
              {ex.sets} x {ex.reps}
            </span>
          ))}
        {verdict.session.exercises.length > EXERCISE_PREVIEW_LIMIT && (
          <span className="px-1 py-1 text-meta text-muted-foreground">
            +{verdict.session.exercises.length - EXERCISE_PREVIEW_LIMIT} more
          </span>
        )}
      </div>
    ) : null;

  const headline = !data ? (
    "No training plan"
  ) : trainedToday ? (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
      <span className="min-w-0 text-positive-text">
        {data.completedTodayName ?? "Session"} done
      </span>
      <span className="text-body-sm text-muted-foreground">
        {data.planTitle}
      </span>
    </span>
  ) : data.kind === "document" ? (
    data.planTitle
  ) : verdict ? (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
      <span className="min-w-0">{verdict.session.name}</span>
      <span className="text-body-sm text-muted-foreground">
        {data.planTitle}
      </span>
    </span>
  ) : (
    data.planTitle
  );

  const visual = !data ? null : trainedToday ? (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-body-sm text-muted-foreground">
        Today's training is in the books.
        {verdict ? ` Up next in your rotation: ${verdict.session.name}.` : ""}
      </p>
      {rotationStrip}
    </div>
  ) : data.kind === "document" ? (
    <p className="text-body-sm text-muted-foreground">
      This plan is a written document. Open it to read today's work, or
      prepare it on Workouts to make its days startable.
    </p>
  ) : verdict ? (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-body-sm text-muted-foreground">{verdict.reason}</p>
      {rotationStrip}
      {exercisePreview}
    </div>
  ) : (
    <p className="text-body-sm text-muted-foreground">
      This plan has no sessions yet. Open it to add your training days.
    </p>
  );

  return (
    <PlanPanel
      className={className}
      detailLink={
        // The document card's primary IS "Open plan", so its named link goes
        // to the plans index instead (no duplicate destinations, FIX-30).
        data && data.kind !== "document"
          ? { label: "Training plan", href: `/plans/${data.planId}` }
          : { label: "All plans", href: "/plans" }
      }
      empty={{
        absent: "No training plan yet.",
        unlock:
          "Ask Chad for a split or add one on All plans, and today's session appears here. Freestyle sessions count too.",
        // Freestyle members keep their Today workout entry (the old workout
        // card's job); plan management is the named "All plans" link above.
        action: (
          <Button
            asChild
            className="min-h-11 sm:min-h-8"
            size="sm"
            variant="outline"
          >
            <Link href="/workouts">Start a workout</Link>
          </Button>
        ),
      }}
      footer={{
        status: trainedToday ? "Trained today" : undefined,
        askChad: (
          <AskChadButton
            className="min-h-11 sm:min-h-8"
            prompt={
              data
                ? "Look at my training plan and what I've done this week. Is today's session right, and what should I focus on in it?"
                : "I don't have a training plan yet. Build me a split that fits my goal and schedule."
            }
          />
        ),
        primary: !data
          ? undefined
          : trainedToday
            ? undefined
            : data.kind === "document"
              ? { label: "Open plan", href: `/plans/${data.planId}` }
              : canStartWorkout
                ? { label: "Start workout", href: "/workouts" }
                : undefined,
        secondary:
          trainedToday && data
            ? [{ label: "Workout history", href: "/workouts#history" }]
            : undefined,
      }}
      glow={trainedToday ? "emerald" : "blood"}
      headline={headline}
      icon={<Dumbbell className="size-4" />}
      lockedCapability="Members see their next plan session with a one-tap start."
      state={data ? "populated" : "empty"}
      title="Training today"
      wrapTitle
      tone="blood"
      visual={visual}
    />
  );
}
