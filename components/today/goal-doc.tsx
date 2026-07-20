"use client";

import { Download, MessageSquare, Pencil, Trash2, TriangleAlert } from "lucide-react";
import { KpiHelp } from "@/components/dashboard/kpi";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { removeGoal, updateGoalRecord } from "@/app/home/actions";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { WeightChartInteractive } from "@/components/progress/weight-chart-interactive";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExerciseTrendChart } from "@/components/workouts/exercise-trend-chart";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadGoalPdf } from "@/lib/pdf/goal-pdf";
import type { EditableGoal } from "@/components/goals/types";
import {
  GoalProgress,
  isManualMetric,
  liftInGoalUnit,
  type LiftProgress,
} from "./goal-list";

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
  weightChart = null,
  coherence = null,
  todayMs,
}: {
  goal: EditableGoal;
  /** Smoothed trend weight in the member's display unit, for weight goals —
   *  the canonical "current weight" every screen shares (LC-4). */
  currentWeight: number | null;
  /** Est.-1RM history for a lift goal's exercise. */
  lift: LiftProgress | null;
  /** Weigh-in history for a weight goal, re-plotted against the goal line
   *  with the projected finish date (VF-6). */
  weightChart?: GoalWeightChart | null;
  coherence?: GoalCoherence | null;
  /** Member-local today anchor for the embedded weight chart's window, so
   *  this page's 30-day stats match /progress/body and /home exactly
   *  (P56-Z audit P1: the UTC fallback shifted the window a day). */
  todayMs?: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const isLift = goal.metric === "lift";
  // Est.-1RM history in the goal's own unit (kg lift goals convert from lb).
  const liftData = isLift ? liftInGoalUnit(lift, goal.unit) : null;
  const isManual = isManualMetric(goal.metric);
  const current = isLift
    ? (liftData?.current ?? null)
    : goal.metric === "weight"
      ? currentWeight
      : isManual
        ? (goal.currentValue ?? goal.startValue ?? null)
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
      }
    });
  }

  const coherenceCard =
    coherence?.calorie || (coherence?.overlapTitles.length ?? 0) > 0 ? (
      <section className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.05] p-5">
        <h3 className="flex items-center gap-1.5 font-medium text-sm">
          <TriangleAlert className="size-4 text-amber-500" />
          Needs a look
        </h3>
        <div className="mt-2 flex flex-col gap-2 text-muted-foreground text-sm leading-relaxed">
          {coherence?.calorie && (
            <p>
              This goal mentions {coherence.calorie.mentioned.toLocaleString()}{" "}
              calories a day, but your Nutrition target is{" "}
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
            className="h-11"
            label="Sort this out with Chad"
            prompt={`Look at my goal "${goal.title}". ${
              coherence?.calorie
                ? `It says ${coherence.calorie.mentioned.toLocaleString()} calories a day but my Nutrition target is ${coherence.calorie.target.toLocaleString()}; which should I follow? `
                : ""
            }${
              (coherence?.overlapTitles.length ?? 0) > 0
                ? `I also have another active goal tracking the same thing (${coherence?.overlapTitles.join(", ")}). Help me pick one to keep and archive the other.`
                : ""
            }`.trim()}
          />
        </div>
      </section>
    ) : null;

  const showUpdateProgress =
    isManual && goal.status === "active" && goal.targetValue != null;

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
              <p className="mt-1 flex items-center gap-1 text-muted-foreground text-sm">
                Tracking {goal.metricRef} · est. 1RM
                <KpiHelp label="est. 1RM">
                  Your estimated one-rep max: the heaviest single rep you
                  could likely manage on this lift, calculated from the weight
                  and reps of your logged sets. It updates as you log
                  workouts.
                </KpiHelp>
              </p>
            )}
            {(goal.targetDate || goal.createdAtLabel) && (
              <p className="mt-1 text-muted-foreground text-sm">
                {/* The set-on date anchors relative deadlines like "8 weeks",
                    which are otherwise uncheckable (LC-5). */}
                {[
                  goal.createdAtLabel ? `Set ${goal.createdAtLabel}` : null,
                  goal.targetDate ? `Target: ${goal.targetDate}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          {/* The page's actions live in the header, the standard document
              toolbar (owner ruling s178: no side rails). Phones keep the
              bottom action row instead. */}
          <div className="hidden flex-wrap items-center gap-2 sm:flex">
            <DeleteGoalDialog
              className="h-11 gap-1.5 text-muted-foreground"
              onDelete={onDelete}
              pending={pending}
              title={goal.title}
            />
            <Button
              className="h-11 gap-1.5 px-4"
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
            {/* The dedicated edit page (MOB-19), not a dialog. */}
            <Button
              asChild
              className="h-11 gap-1.5 px-4"
              size="sm"
              variant="outline"
            >
              <Link href={`/goals/${goal.id}/edit`}>
                <Pencil className="size-3.5" />
                Edit
              </Link>
            </Button>
            <Button asChild className="h-11 gap-1.5 px-4" size="sm">
              <Link href={`/?prompt=${encodeURIComponent(discussPrompt)}`}>
                <MessageSquare className="size-3.5" />
                Discuss with Chad
              </Link>
            </Button>
          </div>
        </div>

        <GoalProgress current={current} firstValue={liftData?.first} goal={goal} />

        {isLift && liftData && liftData.points.length >= 2 && (
          <div className="mt-4">
            <ExerciseTrendChart
              points={liftData.points}
              target={goal.targetValue}
              unit={goal.unit ?? "lb"}
            />
          </div>
        )}

        {/* Metrics with no automatic data source (body fat, measurements,
            custom numbers) get their update control right here, where the
            progress bar lives — the table-stakes "log progress" affordance
            every real goal tracker has. */}
        {showUpdateProgress && <UpdateProgress goal={goal} />}
      </section>

      {/* The weight trend re-plotted against this goal's line, with the
          projected finish date: the same interactive chart /progress leads
          with, so the goal page finally shows the journey, not one bar (VF-6). */}
      {weightChart && weightChart.points.length >= 2 && (
        <WeightChartInteractive
          goalStartWeight={weightChart.goalStartWeight}
          goalWeight={weightChart.goalWeight}
          points={weightChart.points}
          todayMs={todayMs}
          unit={weightChart.unit}
        />
      )}

      {coherenceCard}

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

      {/* Phone action row; at sm+ the header toolbar carries these. */}
      <div className="flex flex-wrap items-center justify-between gap-3 sm:hidden">
        <DeleteGoalDialog
          className="h-11 gap-1.5 text-muted-foreground"
          onDelete={onDelete}
          pending={pending}
          title={goal.title}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="h-11 gap-1.5 px-4"
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
          <Button
            asChild
            className="h-11 gap-1.5 px-4"
            size="sm"
            variant="outline"
          >
            <Link href={`/goals/${goal.id}/edit`}>
              <Pencil className="size-3.5" />
              Edit
            </Link>
          </Button>
          <Button asChild className="h-11 gap-1.5 px-4" size="sm">
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

/** The delete confirm, rendered by both layouts (phone action row + desktop
 *  rail); each instance owns its own dialog state. */
function DeleteGoalDialog({
  title,
  pending,
  onDelete,
  className,
  label = "Delete",
}: {
  title: string;
  pending: boolean;
  onDelete: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button className={className} size="sm" variant="ghost">
          <Trash2 className="size-3.5" />
          {label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this goal?</AlertDialogTitle>
          <AlertDialogDescription>
            "{title}" and its progress will be permanently deleted, and Chad
            will stop tracking it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={pending}
            onClick={onDelete}
          >
            {pending ? "Deleting…" : "Delete goal"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Inline progress logging for metrics with no automatic data source: type the
 * latest number, save, and the progress bar above moves. Weight and lift goals
 * never render this — their numbers flow in from weigh-ins and logged sets.
 */
function UpdateProgress({ goal }: { goal: EditableGoal }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Rendered once per layout (phone in-card + desktop rail), so the input id
  // must be unique per instance.
  const inputId = useId();
  const currentNow = goal.currentValue ?? goal.startValue;
  const [value, setValue] = useState(
    currentNow != null ? String(currentNow) : ""
  );
  const [error, setError] = useState<string | null>(null);

  function onSave() {
    const n = Number(value.trim());
    if (!value.trim() || !Number.isFinite(n) || n <= 0) {
      setError("Enter a number above zero.");
      return;
    }
    if (goal.metric === "bodyfat" && (n < 1 || n > 75)) {
      setError("Body fat is a percentage between 1 and 75.");
      return;
    }
    startTransition(async () => {
      const result = await updateGoalRecord({ ...goal, currentValue: n });
      if (result.ok) {
        toast.success("Progress updated.");
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't save that.");
      }
    });
  }

  const noun =
    goal.metric === "bodyfat"
      ? "body fat reading"
      : goal.metric === "measurement"
        ? `${goal.metricRef ?? "measurement"} number`.trim()
        : "number";

  return (
    <div className="mt-4 rounded-xl border border-border bg-background/40 p-3.5">
      <Label className="text-sm" htmlFor={inputId}>
        Update your progress
      </Label>
      <p className="mt-0.5 text-muted-foreground text-xs">
        Enter your latest {noun} and the progress bar updates.
      </p>
      <div className="mt-2 flex items-start gap-2">
        <div className="relative w-32">
          <Input
            aria-invalid={error ? true : undefined}
            className={goal.metric === "bodyfat" ? "h-11 pr-8" : "h-11"}
            id={inputId}
            inputMode="decimal"
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            value={value}
          />
          {goal.metric === "bodyfat" && (
            <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 text-muted-foreground text-sm">
              %
            </span>
          )}
        </div>
        {goal.metric !== "bodyfat" && goal.unit && (
          <span className="self-center text-muted-foreground text-sm">
            {goal.unit}
          </span>
        )}
        <Button className="h-11" disabled={pending} onClick={onSave} type="button">
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      {error && <p className="mt-1.5 text-destructive text-xs">{error}</p>}
    </div>
  );
}
