"use client";

import { Pencil, Plus, RotateCcw, Target, Trash2, TriangleAlert } from "lucide-react";
import { KpiHelp } from "@/components/dashboard/kpi";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { removeGoal, updateGoalRecord } from "@/app/today/actions";
import { computeGoalProgress } from "@/lib/goals/progress";
import { cn } from "@/lib/utils";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExerciseTrendChart } from "@/components/workouts/exercise-trend-chart";
import type { EditableGoal } from "@/components/goals/types";
import { ModuleFooter, ModuleHeader } from "./module-card";

const EASE = [0.22, 1, 0.36, 1] as const;

/** Est.-1RM history for a lift goal's exercise, plus its current/first values. */
export type LiftProgress = {
  current: number | null;
  first: number | null;
  points: { t: number; value: number }[];
};

const LB_PER_KG = 2.204_62;

/** Est.-1RM data is stored in lb; a kg lift goal charts and scores in kg, so
 *  convert at the display boundary. Shared with the /goals/[id] document. */
export function liftInGoalUnit(
  lift: LiftProgress | null | undefined,
  unit: string | null
): LiftProgress | null {
  if (!lift) {
    return null;
  }
  const isKg = (unit ?? "").trim().toLowerCase().startsWith("k");
  if (!isKg) {
    return lift;
  }
  const conv = (n: number | null) =>
    n == null ? null : Math.round((n / LB_PER_KG) * 10) / 10;
  return {
    current: conv(lift.current),
    first: conv(lift.first),
    points: lift.points.map((p) => ({
      t: p.t,
      value: p.value / LB_PER_KG,
    })),
  };
}

/** True for metrics with no automatic data source: the member updates the
 *  goal's own `currentValue` by hand. */
export function isManualMetric(metric: EditableGoal["metric"]): boolean {
  return (
    metric === "bodyfat" || metric === "measurement" || metric === "custom"
  );
}

/** The full-page goal document (R2-9). */
function goalHref(goal: EditableGoal): string {
  return `/goals/${goal.id}`;
}

/** Live progress for a measurable goal, given a current value. Exported for
 *  the /goals/[id] document page, so the bar there matches the card exactly. */
export function GoalProgress({
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
  // "%" hugs its number ("15%"); word units keep the space ("15 lb").
  const unit = goal.unit ? (goal.unit === "%" ? "%" : ` ${goal.unit}`) : "";
  const start = Math.round(progress.start * 10) / 10;

  return (
    <div className="mt-2">
      {/* All three anchors are printed — start, now, goal — so the percentage
          is derivable from the numbers next to it. It used to print only
          "current → target" while the % was anchored on a hidden start weight,
          so two identical-looking ranges showed wildly different numbers
          (LC-3). */}
      <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs">
        <span className="text-muted-foreground">
          Start {start} → now {current} → goal {goal.targetValue}
          {unit}
        </span>
        <span className="font-medium tabular-nums">
          {reached ? "Goal reached 🎯" : `${pct}% · ${toGo}${unit} to go`}
        </span>
      </div>
      {/* Track is foreground-tinted, not bg-muted: bg-muted is near-invisible
          on the card in dark mode, which made a 0% goal look like it had no
          progress bar at all (P3-3). Fill is emerald, not blood: progress
          toward a goal is exactly what emerald means (VF-7 color law), and a
          red bar at 26% read as danger on an on-track goal. (The /progress
          twin of this bar was retired in VF-15; the % lives in that chart's
          footer now; this card is the one place the bar itself renders.) */}
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-foreground/10">
        <motion.div
          animate={{ width: `${pct}%` }}
          className="h-full rounded-full bg-gradient-to-r from-emerald-500/70 to-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.35)]"
          initial={{ width: reduced ? `${pct}%` : 0 }}
          transition={{ duration: reduced ? 0 : 0.9, ease: EASE }}
        />
      </div>
    </div>
  );
}

/** Plain name for the thing two overlapping goals both measure (P2-4). */
function metricNoun(goal: EditableGoal): string {
  if (goal.metric === "bodyfat") {
    return "body fat";
  }
  if (goal.metric === "lift") {
    return goal.metricRef ?? "this lift";
  }
  return "your weight";
}

/**
 * The card's ONE consolidated coherence notice (VF-4). The old treatment
 * stacked a glowing calorie-conflict banner plus an identical amber strip on
 * every overlapping goal row, so the card read as a wall of warnings. Now:
 * one quiet row per card (small icon, one short line per issue, one action);
 * the full explanations live on each goal's own page.
 */
function CoherenceNotice({
  calorieConflict,
  overlapNouns,
  page = false,
}: {
  calorieConflict: { goalTitle: string; mentioned: number; target: number } | null;
  overlapNouns: string[];
  /** Page-grid styling (LAY-1): a solid card on the page background. */
  page?: boolean;
}) {
  const lines: string[] = [];
  const promptParts: string[] = [];
  if (calorieConflict) {
    lines.push(
      `"${calorieConflict.goalTitle}" mentions ${calorieConflict.mentioned.toLocaleString()} calories a day; your Calorie Tracker target is ${calorieConflict.target.toLocaleString()}.`
    );
    promptParts.push(
      `My goal "${calorieConflict.goalTitle}" says ${calorieConflict.mentioned.toLocaleString()} calories a day, but my Calorie Tracker target is ${calorieConflict.target.toLocaleString()}. Which one should I follow? Update the stale one so they match.`
    );
  }
  for (const noun of overlapNouns) {
    lines.push(
      `Two active goals track ${noun}, so their progress bars will disagree. Keep one and archive the other.`
    );
    promptParts.push(
      `Two of my active goals track ${noun.replace(/^your /, "my ")}. Help me pick the one to keep and archive the other.`
    );
  }
  if (lines.length === 0) {
    return null;
  }
  return (
    // Stacked on phones: side-by-side squeezed the warning copy into a skinny
    // half-width column at 390px. The button rides the row only at sm+.
    <div
      className={cn(
        "mb-3 flex flex-col gap-2 rounded-xl border border-border bg-background/40 px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-x-3",
        page && "mb-0 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-card)]"
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
        <div className="flex min-w-0 flex-col gap-1 text-muted-foreground text-xs leading-relaxed">
          {lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </div>
      {/* Full 44px tap height: this is the same control class as the page's
          other buttons, so it gets the same target size. */}
      <AskChadButton
        className="h-11 shrink-0 self-start text-xs sm:self-auto"
        prompt={promptParts.join(" ")}
      />
    </div>
  );
}

function GoalItem({
  goal,
  currentWeight,
  lift,
  page = false,
}: {
  goal: EditableGoal;
  currentWeight: number | null;
  lift: LiftProgress | undefined;
  /** Page-grid styling (LAY-1): a standalone card on the page background,
   *  full-height so action rows line up across a row of goal cards. */
  page?: boolean;
}) {
  const isLift = goal.metric === "lift";
  // Est.-1RM history in the goal's own unit (kg lift goals convert from lb).
  const liftData = isLift ? liftInGoalUnit(lift, goal.unit) : null;
  const current = isLift
    ? (liftData?.current ?? null)
    : goal.metric === "weight"
      ? currentWeight
      : isManualMetric(goal.metric)
        ? (goal.currentValue ?? goal.startValue ?? null)
        : null;
  const unit = goal.unit ? ` ${goal.unit}` : "";
  // A lift goal whose exercise has no logged sets yet — show the target, and a
  // nudge to start logging it, instead of a bar that can't move.
  const liftAwaitingData =
    isLift && current == null && goal.targetValue != null;
  return (
    <div
      className={
        page
          ? "flex h-full min-w-0 flex-col rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
          : "rounded-xl border border-border bg-background/40 p-3"
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium leading-snug">{goal.title}</p>
          {isLift && goal.metricRef && (
            <p className="flex items-center gap-1 text-muted-foreground text-xs">
              Tracking {goal.metricRef} · est. 1RM
              <KpiHelp label="est. 1RM">
                Your estimated one-rep max: the heaviest single rep you could
                likely manage on this lift, calculated from the weight and
                reps of your logged sets. It updates as you log workouts.
              </KpiHelp>
            </p>
          )}
          {(goal.targetDate || goal.createdAtLabel) && (
            <p className="text-muted-foreground text-xs">
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
        {goal.status !== "active" && (
          <Badge variant="secondary">{goal.status}</Badge>
        )}
      </div>
      <GoalProgress
        current={current}
        firstValue={liftData?.first}
        goal={goal}
      />
      {liftAwaitingData && (
        <p className="mt-2 text-muted-foreground text-xs">
          Target {goal.targetValue}
          {unit}: no sets logged for {goal.metricRef ?? "this lift"} yet. Log it
          in Workouts and the chart fills in.
        </p>
      )}
      {isLift && liftData && liftData.points.length >= 2 && (
        <div className="mt-3">
          <ExerciseTrendChart
            points={liftData.points}
            target={goal.targetValue}
            unit={goal.unit ?? "lb"}
          />
        </div>
      )}
      {/* 44px touch targets with real gaps: Edit and the destructive Delete
          were 30px icons 4px apart, a guaranteed phone mis-tap. In the page
          grid the row is mt-auto so actions line up across equal-height cards. */}
      <div className={page ? "mt-auto flex items-center gap-1.5 pt-2" : "mt-1 flex items-center gap-1.5"}>
        {/* The goal's full-page document (R2-9), not a cramped dialog. */}
        <Button
          asChild
          className="-ml-2 h-11 px-2 text-blood"
          size="sm"
          variant="link"
        >
          <Link href={goalHref(goal)}>View</Link>
        </Button>
        {/* The dedicated edit page (MOB-19), not a dialog. */}
        <Button
          aria-label="Edit goal"
          asChild
          className="size-11 text-muted-foreground"
          size="icon"
          variant="ghost"
        >
          <Link href={`/goals/${goal.id}/edit`}>
            <Pencil className="size-4" />
          </Link>
        </Button>
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
        className="size-11 text-muted-foreground"
        onClick={() => setConfirming(true)}
        size="icon"
        variant="ghost"
      >
        <Trash2 className="size-4" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        className="h-11 px-3 text-xs"
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
        className="h-11 px-3 text-xs"
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
function PastGoalItem({
  goal,
  page = false,
}: {
  goal: EditableGoal;
  page?: boolean;
}) {
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
    <div
      className={
        page
          ? // Stacks on narrow phones so the title never truncates down to
            // nothing to make room for the inline controls.
            "flex min-w-0 flex-col items-start gap-1 rounded-2xl border border-border bg-card px-4 py-2.5 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between sm:gap-2"
          : "flex items-center justify-between gap-2 rounded-xl border border-border bg-background/40 px-3 py-2"
      }
    >
      <div className="flex min-w-0 items-center gap-2">
        <p className="truncate text-sm">{goal.title}</p>
        <Badge variant="secondary">{goal.status}</Badge>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          asChild
          className="h-11 px-2 text-blood"
          size="sm"
          variant="link"
        >
          <Link href={goalHref(goal)}>View</Link>
        </Button>
        <Button
          aria-label="Reopen goal"
          className="size-11 text-muted-foreground"
          disabled={pending}
          onClick={onReopen}
          size="icon"
          variant="ghost"
        >
          <RotateCcw className="size-4" />
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
  quiet = false,
  calorieConflict = null,
  overlapIds = [],
  viewHref,
  layout = "card",
}: {
  goals: EditableGoal[];
  currentWeight: number | null;
  memoryGoalHint: string | null;
  pastGoals?: EditableGoal[];
  /** Est.-1RM history per lift-goal id, for live progress + the trend chart. */
  liftProgress?: Record<string, LiftProgress>;
  /** First-run (P1-4): the empty state describes what will appear here instead
   *  of adding another CTA to the chorus — the hero owns the one first action. */
  quiet?: boolean;
  /** An active goal's text names a calorie figure that disagrees with the
   *  Calorie Tracker target (P2-4), surfaced as an "align these" nudge. */
  calorieConflict?: {
    goalTitle: string;
    mentioned: number;
    target: number;
  } | null;
  /** Ids of active goals that track the same metric as another active goal. */
  overlapIds?: string[];
  /** The goals deep page ("View all →" /goals). Omit when already on it. */
  viewHref?: string;
  /** "card" = the /today module body (default). "page" = the /goals page body
   *  (LAY-1): toolbar up top, goal cards in a responsive multi-column grid,
   *  past goals in a two-column grid — a real desktop layout, not a column. */
  layout?: "card" | "page";
}) {
  const overlapNouns = [
    ...new Set(goals.filter((g) => overlapIds.includes(g.id)).map(metricNoun)),
  ];

  if (layout === "page") {
    return (
      <div className="flex flex-col gap-6">
        {/* Toolbar: the page's actions live up top, like every desktop app. */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            {goals.length > 0
              ? `${goals.length} active ${goals.length === 1 ? "goal" : "goals"}`
              : "No active goals yet"}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <AskChadButton
              className="h-11"
              prompt="Look at my goals and my progress toward them. Am I on track, and what should I focus on this week?"
            />
            <Button asChild className="h-11 gap-1.5 px-4" size="sm">
              <Link href="/goals/new">
                <Plus className="size-3.5" />
                Add goal
              </Link>
            </Button>
          </div>
        </div>

        <CoherenceNotice
          calorieConflict={calorieConflict}
          overlapNouns={overlapNouns}
          page
        />

        {goals.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((g) => (
              <GoalItem
                currentWeight={currentWeight}
                goal={g}
                key={g.id}
                lift={liftProgress[g.id]}
                page
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border border-dashed bg-card p-8 text-center sm:p-12">
            <div className="mx-auto flex max-w-md flex-col items-center gap-3">
              {memoryGoalHint ? (
                <>
                  <p className="font-medium leading-snug">{memoryGoalHint}</p>
                  <p className="text-muted-foreground text-sm">
                    Pulled from your chats. Save it as a goal to track it and
                    export it.
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No goal set yet. Set it here, or tell Chad in chat and he'll
                  build the plan around it.
                </p>
              )}
              <Button asChild className="h-11 gap-1.5 px-5" size="sm">
                <Link href="/goals/new">
                  <Plus className="size-3.5" />
                  Set your goal
                </Link>
              </Button>
            </div>
          </div>
        )}

        {pastGoals.length > 0 && (
          <section>
            <h2 className="mb-3 font-medium text-muted-foreground text-sm uppercase tracking-wide">
              Past goals ({pastGoals.length})
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              {pastGoals.map((g) => (
                <PastGoalItem goal={g} key={g.id} page />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <>
      <ModuleHeader
        icon={<Target className="size-4" />}
        title="Goals"
        tone="blood"
        viewHref={viewHref}
      />

      <CoherenceNotice
        calorieConflict={calorieConflict}
        overlapNouns={overlapNouns}
      />

      {goals.length > 0 ? (
        <div className="flex flex-col gap-2">
          {goals.map((g) => (
            <GoalItem
              currentWeight={currentWeight}
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
          {!quiet && (
            <Button
              asChild
              className="h-11 gap-1.5 px-4"
              size="sm"
              variant="outline"
            >
              <Link href="/goals/new">
                <Plus className="size-3.5" />
                Set your goal
              </Link>
            </Button>
          )}
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

      <ModuleFooter
        askChad={
          <AskChadButton
            className="h-11"
            prompt="Look at my goals and my progress toward them. Am I on track, and what should I focus on this week?"
          />
        }
      >
        {goals.length > 0 && (
          <Button
            asChild
            className="h-11 gap-1.5 px-4"
            size="sm"
            variant="outline"
          >
            <Link href="/goals/new">
              <Plus className="size-3.5" />
              Add goal
            </Link>
          </Button>
        )}
      </ModuleFooter>
    </>
  );
}
