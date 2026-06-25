"use client";

import { Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type EditableGoal, GoalEditor } from "./goal-editor";
import { GoalViewer } from "./goal-viewer";

/** Live progress for a measurable goal, given a current value. */
function GoalProgress({
  goal,
  current,
}: {
  goal: EditableGoal;
  current: number | null;
}) {
  if (goal.targetValue == null || current == null) {
    return null;
  }
  const start = goal.startValue ?? current;
  const span = goal.targetValue - start;
  const done = current - start;
  // Works whether the target is above or below the start (gain or loss).
  const pct =
    span === 0
      ? 100
      : Math.max(0, Math.min(100, Math.round((done / span) * 100)));
  const toGo = Math.round(Math.abs(goal.targetValue - current) * 10) / 10;
  const unit = goal.unit ? ` ${goal.unit}` : "";

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {current}
          {unit} → {goal.targetValue}
          {unit}
        </span>
        <span className="font-medium">
          {pct >= 100 ? "Goal reached 🎯" : `${toGo}${unit} to go`}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-blood transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function GoalItem({
  goal,
  currentWeight,
}: {
  goal: EditableGoal;
  currentWeight: number | null;
}) {
  const current = goal.metric === "weight" ? currentWeight : null;
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{goal.title}</p>
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
      <GoalProgress current={current} goal={goal} />
      <div className="mt-1 flex items-center gap-1">
        <GoalViewer goal={goal} />
        <GoalEditor goal={goal} variant="icon" />
      </div>
    </div>
  );
}

/**
 * The /today "Your goals" card body: lists active goals with live progress, an
 * Add control, and a graceful empty state (falling back to the one-line goal
 * Chad has in memory, if any, until the user saves a real one).
 */
export function GoalList({
  goals,
  currentWeight,
  memoryGoalHint,
}: {
  goals: EditableGoal[];
  currentWeight: number | null;
  memoryGoalHint: string | null;
}) {
  return (
    <>
      <div className="mb-3 flex items-start justify-between">
        <h2 className="flex items-center gap-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
          <Target className="size-4 text-blood" />
          Your goals
        </h2>
        {goals.length > 0 && <GoalEditor variant="add" />}
      </div>

      {goals.length > 0 ? (
        <div className="flex flex-col gap-2">
          {goals.map((g) => (
            <GoalItem currentWeight={currentWeight} goal={g} key={g.id} />
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
              No goal set yet. Set it here, or tell Chad in chat and he'll build
              the plan around it.
            </p>
          )}
          <GoalEditor variant="cta" />
        </div>
      )}
    </>
  );
}
