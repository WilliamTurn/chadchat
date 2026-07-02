"use client";

import { RotateCcw, Target, Trash2 } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { removeGoal, updateGoalRecord } from "@/app/today/actions";
import { computeGoalProgress } from "@/lib/goals/progress";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExerciseTrendChart } from "@/components/workouts/exercise-trend-chart";
import { type EditableGoal, GoalEditor } from "./goal-editor";
import { GoalViewer } from "./goal-viewer";
import { ModuleFooter, ModuleHeader } from "./module-card";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Est.-1RM history for a lift goal's exercise, plus its current/first values. */
export type LiftProgress = {
  current: number | null;
  first: number | null;
  points: { t: number; value: number }[];
};

/** Live progress for a measurable goal, given a current value. */
function GoalProgress({
  goal,
  current,
  firstValue,
}: {
  goal: EditableGoal;
  current: number | null;
  /** Fallback start anchor when the goal has no stored startValue (lift goals). */
  firstValue?: number | null;
}) {
  const reduced = useReducedMotion() ?? false;

  // Shared start-weight + progress-% calc — the same one `/progress` uses, so the
  // two screens never disagree (DSH-26).
  const progress = computeGoalProgress({
    startValue: goal.startValue,
    targetValue: goal.targetValue,
    current,
    firstWeight: firstValue,
  });
  if (progress == null) {
    return null;
  }
  const { pct, toGo, reached } = progress;
  const unit = goal.unit ? ` ${goal.unit}` : "";

  return (
    <div className="mt-2">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {current}
          {unit} → {goal.targetValue}
          {unit}
        </span>
        <span className="font-medium tabular-nums">
          {reached ? "Goal reached 🎯" : `${pct}% · ${toGo}${unit} to go`}
        </span>
      </div>
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <motion.div
          animate={{ width: `${pct}%` }}
          className="h-full rounded-full bg-gradient-to-r from-blood/70 to-blood shadow-[0_0_10px_var(--color-blood)]"
          initial={{ width: reduced ? `${pct}%` : 0 }}
          transition={{ duration: reduced ? 0 : 0.9, ease: EASE }}
        />
      </div>
    </div>
  );
}

function GoalItem({
  goal,
  currentWeight,
  lift,
  exerciseNames,
}: {
  goal: EditableGoal;
  currentWeight: number | null;
  lift: LiftProgress | undefined;
  exerciseNames: string[];
}) {
  const isLift = goal.metric === "lift";
  const current = isLift ? (lift?.current ?? null) : goal.metric === "weight" ? currentWeight : null;
  const unit = goal.unit ? ` ${goal.unit}` : "";
  // A lift goal whose exercise has no logged sets yet — show the target, and a
  // nudge to start logging it, instead of a bar that can't move.
  const liftAwaitingData =
    isLift && current == null && goal.targetValue != null;
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{goal.title}</p>
          {isLift && goal.metricRef && (
            <p className="text-muted-foreground text-xs">
              Tracking {goal.metricRef} · est. 1RM
            </p>
          )}
          {goal.targetDate && (
            <p className="text-muted-foreground text-xs">
              Target: {goal.targetDate}
            </p>
          )}
        </div>
        {goal.status !== "active" && (
          <Badge variant="secondary">{goal.status}</Badge>
        )}
      </div>
      <GoalProgress
        current={current}
        firstValue={lift?.first}
        goal={goal}
      />
      {liftAwaitingData && (
        <p className="mt-2 text-muted-foreground text-xs">
          Target {goal.targetValue}
          {unit} — no sets logged for {goal.metricRef ?? "this lift"} yet. Log it
          in Workouts and the chart fills in.
        </p>
      )}
      {isLift && lift && lift.points.length >= 2 && (
        <div className="mt-3">
          <ExerciseTrendChart
            points={lift.points}
            target={goal.targetValue}
            unit={goal.unit ?? "lb"}
          />
        </div>
      )}
      <div className="mt-1 flex items-center gap-1">
        <GoalViewer goal={goal} />
        <GoalEditor exerciseNames={exerciseNames} goal={goal} variant="icon" />
        <RowDeleteGoal id={goal.id} />
      </div>
    </div>
  );
}

/**
 * A direct row delete for a goal: a trash icon that flips to an inline
 * Delete/Cancel confirm (matching the workouts list), so deleting doesn't
 * require opening the View dialog (NAV-25).
 */
function RowDeleteGoal({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button
        aria-label="Delete goal"
        className="size-7 text-muted-foreground"
        onClick={() => setConfirming(true)}
        size="icon"
        variant="ghost"
      >
        <Trash2 className="size-3.5" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        className="h-7 px-2 text-xs"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await removeGoal(id);
            if (result.ok) {
              toast.success("Goal deleted.");
              router.refresh();
            } else {
              toast.error(result.error ?? "Couldn't delete that goal.");
              setConfirming(false);
            }
          })
        }
        size="sm"
        variant="destructive"
      >
        {pending ? "Deleting…" : "Delete"}
      </Button>
      <Button
        className="h-7 px-2 text-xs"
        disabled={pending}
        onClick={() => setConfirming(false)}
        size="sm"
        variant="ghost"
      >
        Cancel
      </Button>
    </div>
  );
}

/** One achieved/archived goal: status badge, View, and a one-click Reopen. */
function PastGoalItem({ goal }: { goal: EditableGoal }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onReopen() {
    startTransition(async () => {
      const result = await updateGoalRecord({ ...goal, status: "active" });
      if (result.ok) {
        toast.success("Goal reopened.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't reopen that.");
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background/40 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <p className="truncate text-sm">{goal.title}</p>
        <Badge variant="secondary">{goal.status}</Badge>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <GoalViewer goal={goal} />
        <Button
          aria-label="Reopen goal"
          className="size-7 text-muted-foreground"
          disabled={pending}
          onClick={onReopen}
          size="icon"
          variant="ghost"
        >
          <RotateCcw className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

/**
 * The /today "Your goals" card body: lists active goals with live progress, an
 * Add control, and a graceful empty state (falling back to the one-line goal
 * Chad has in memory, if any, until the user saves a real one). Achieved and
 * archived goals collapse into a "Past goals" disclosure so a status change
 * stays recoverable instead of reading as a silent delete.
 */
export function GoalList({
  goals,
  currentWeight,
  memoryGoalHint,
  pastGoals = [],
  liftProgress = {},
  exerciseNames = [],
  quiet = false,
}: {
  goals: EditableGoal[];
  currentWeight: number | null;
  memoryGoalHint: string | null;
  pastGoals?: EditableGoal[];
  /** Est.-1RM history per lift-goal id, for live progress + the trend chart. */
  liftProgress?: Record<string, LiftProgress>;
  /** Logged exercise names, offered as suggestions when adding a lift goal. */
  exerciseNames?: string[];
  /** First-run (P1-4): the empty state describes what will appear here instead
   *  of adding another CTA to the chorus — the hero owns the one first action. */
  quiet?: boolean;
}) {
  return (
    <>
      <ModuleHeader
        icon={<Target className="size-4" />}
        title="Your goals"
        tone="blood"
      />

      {goals.length > 0 ? (
        <div className="flex flex-col gap-2">
          {goals.map((g) => (
            <GoalItem
              currentWeight={currentWeight}
              exerciseNames={exerciseNames}
              goal={g}
              key={g.id}
              lift={liftProgress[g.id]}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          {memoryGoalHint ? (
            <div className="rounded-xl border border-border border-dashed bg-background/40 p-3">
              <p className="font-medium leading-snug">{memoryGoalHint}</p>
              <p className="mt-1 text-muted-foreground text-xs">
                Pulled from your chats. Save it as a goal to track it and export
                it.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              {quiet
                ? "Your goals will live here once you and Chad set them. Tell him what you're after and he'll build the plan around it."
                : "No goal set yet. Set it here, or tell Chad in chat and he'll build the plan around it."}
            </p>
          )}
          {!quiet && <GoalEditor exerciseNames={exerciseNames} variant="cta" />}
        </div>
      )}

      {pastGoals.length > 0 && (
        <details className="group mt-4 border-border border-t pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground">
            <span className="transition-transform group-open:rotate-90">›</span>
            Past goals ({pastGoals.length})
          </summary>
          <div className="mt-2 flex flex-col gap-2">
            {pastGoals.map((g) => (
              <PastGoalItem goal={g} key={g.id} />
            ))}
          </div>
        </details>
      )}

      <ModuleFooter>
        <AskChadButton prompt="Look at my goals and my progress toward them. Am I on track, and what should I focus on this week?" />
        {goals.length > 0 && (
          <GoalEditor exerciseNames={exerciseNames} variant="add" />
        )}
      </ModuleFooter>
    </>
  );
}
