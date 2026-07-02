"use client";

import { Download, MessageSquare, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { removeGoal } from "@/app/today/actions";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { WeightChartInteractive } from "@/components/progress/weight-chart-interactive";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExerciseTrendChart } from "@/components/workouts/exercise-trend-chart";
import { downloadGoalPdf } from "@/lib/pdf/goal-pdf";
import { type EditableGoal, GoalEditor } from "./goal-editor";
import { GoalProgress, type LiftProgress } from "./goal-list";

/** The weight-goal chart's inputs, all pre-converted to the display unit. */
export type GoalWeightChart = {
  points: { t: number; weight: number }[];
  unit: "lb" | "kg";
  goalWeight: number | null;
  goalStartWeight: number | null;
};

/** Per-goal coherence detail (VF-4): the card shows one quiet line; the full
 *  explanation lives here on the goal's own page. */
export type GoalCoherence = {
  calorie: { mentioned: number; target: number } | null;
  overlapTitles: string[];
};

/**
 * The full-page goal document (R2-9): the goal's write-up plus its live
 * progress and lift chart, with the same actions the old cramped dialog
 * carried (edit, PDF, discuss with Chad, delete). Rendered by /goals/[id].
 */
export function GoalDoc({
  goal,
  currentWeight,
  lift,
  exerciseNames,
  weightChart = null,
  coherence = null,
}: {
  goal: EditableGoal;
  /** Latest weigh-in in the member's display unit, for weight goals. */
  currentWeight: number | null;
  /** Est.-1RM history for a lift goal's exercise. */
  lift: LiftProgress | null;
  exerciseNames: string[];
  /** Weigh-in history for a weight goal, re-plotted against the goal line
   *  with the projected finish date (VF-6). */
  weightChart?: GoalWeightChart | null;
  coherence?: GoalCoherence | null;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const isLift = goal.metric === "lift";
  const current = isLift
    ? (lift?.current ?? null)
    : goal.metric === "weight"
      ? currentWeight
      : null;

  const discussPrompt = `Let's review my goal: "${goal.title}". Where am I at, and what should I be doing right now to hit it?`;

  function onDelete() {
    startTransition(async () => {
      const result = await removeGoal(goal.id);
      if (result.ok) {
        toast.success("Goal deleted.");
        router.push("/goals");
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't delete that.");
        setConfirming(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display font-semibold text-xl leading-tight">
                {goal.title}
              </h2>
              <Badge variant="secondary">{goal.status}</Badge>
            </div>
            {isLift && goal.metricRef && (
              <p className="mt-1 text-muted-foreground text-sm">
                Tracking {goal.metricRef} · est. 1RM
              </p>
            )}
            {goal.targetDate && (
              <p className="mt-1 text-muted-foreground text-sm">
                Target: {goal.targetDate}
              </p>
            )}
          </div>
          <GoalEditor
            exerciseNames={exerciseNames}
            goal={goal}
            variant="button"
          />
        </div>

        <GoalProgress current={current} firstValue={lift?.first} goal={goal} />

        {isLift && lift && lift.points.length >= 2 && (
          <div className="mt-4">
            <ExerciseTrendChart
              points={lift.points}
              target={goal.targetValue}
              unit={goal.unit ?? "lb"}
            />
          </div>
        )}
      </section>

      {/* The weight trend re-plotted against this goal's line, with the
          projected finish date: the same interactive chart /progress leads
          with, so the goal page finally shows the journey, not one bar (VF-6). */}
      {weightChart && weightChart.points.length >= 2 && (
        <WeightChartInteractive
          goalStartWeight={weightChart.goalStartWeight}
          goalWeight={weightChart.goalWeight}
          points={weightChart.points}
          unit={weightChart.unit}
        />
      )}

      {(coherence?.calorie || (coherence?.overlapTitles.length ?? 0) > 0) && (
        <section className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] p-5">
          <h3 className="flex items-center gap-1.5 font-medium text-sm">
            <TriangleAlert className="size-4 text-amber-500" />
            Needs a look
          </h3>
          <div className="mt-2 flex flex-col gap-2 text-muted-foreground text-sm leading-relaxed">
            {coherence?.calorie && (
              <p>
                This goal mentions{" "}
                {coherence.calorie.mentioned.toLocaleString()} calories a day,
                but your Calorie Tracker target is{" "}
                {coherence.calorie.target.toLocaleString()}. One of them is out
                of date. Ask Chad which to follow, or edit the stale one so they
                match.
              </p>
            )}
            {coherence?.overlapTitles.map((title) => (
              <p key={title}>
                "{title}" also tracks the same thing as this goal. The two
                progress bars start from different points, so they will
                disagree. Keep one and archive the other.
              </p>
            ))}
          </div>
          <div className="mt-3">
            <AskChadButton
              label="Sort this out with Chad"
              prompt={`Look at my goal "${goal.title}". ${
                coherence?.calorie
                  ? `It says ${coherence.calorie.mentioned.toLocaleString()} calories a day but my Calorie Tracker target is ${coherence.calorie.target.toLocaleString()}; which should I follow? `
                  : ""
              }${
                (coherence?.overlapTitles.length ?? 0) > 0
                  ? `I also have another active goal tracking the same thing (${coherence?.overlapTitles.join(", ")}). Help me pick one to keep and archive the other.`
                  : ""
              }`.trim()}
            />
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-6">
        <h3 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
          The full write-up
        </h3>
        {goal.detail.trim() ? (
          <div className="whitespace-pre-line text-sm leading-relaxed">
            {goal.detail.trim()}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            No details written yet. Hit Edit to add the full picture: your why,
            the deadline, how you'll measure it.
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {confirming ? (
          <div className="flex items-center gap-2">
            <Button
              disabled={pending}
              onClick={onDelete}
              size="sm"
              variant="destructive"
            >
              {pending ? "Deleting…" : "Delete goal"}
            </Button>
            <Button
              disabled={pending}
              onClick={() => setConfirming(false)}
              size="sm"
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            className="gap-1.5 text-muted-foreground"
            onClick={() => setConfirming(true)}
            size="sm"
            variant="ghost"
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="gap-1.5"
            onClick={() => {
              downloadGoalPdf(goal).catch(() =>
                toast.error("Couldn't generate the PDF.")
              );
            }}
            size="sm"
            variant="outline"
          >
            <Download className="size-3.5" />
            PDF
          </Button>
          <Button asChild className="gap-1.5" size="sm">
            <Link href={`/?prompt=${encodeURIComponent(discussPrompt)}`}>
              <MessageSquare className="size-3.5" />
              Discuss with Chad
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
