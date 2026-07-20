import { BedDouble, Dumbbell, Utensils } from "lucide-react";
import { SegmentStrip, type Segment } from "@/components/charts/segment-strip";
import { SummaryPanel } from "@/components/panels/roles";
import { ProgressRing, WeekBars } from "@/components/panels/visuals";
import { formatQuantity } from "@/lib/contracts/units";
import { formatCalendarDayMs } from "@/lib/date";
import type { GradedDay, WindowSummary } from "@/lib/progress/overview";
import { cn } from "@/lib/utils";

/**
 * PROGRESS HIGHLIGHTS ON TODAY (P56-E; 03-spec section 4). Compact, truthful
 * teasers that reward the week's accumulated effort and link into the named
 * Progress categories the P5 wave built. One tile grammar across domains
 * (the Apple Fitness Trends rule from the rule-8 teardown): headline value,
 * target-basis context, micro-visual, named destination. SummaryPanel role:
 * no actions; this band is a doorway, never a second analytics page.
 *
 * Every number is a registered metric graded through the overview's own
 * source symbols (lib/today/highlights.ts adapters): the tile and the
 * /progress section it opens can never disagree.
 */

export type TrainingHighlightData = {
  /** training.sessions.thisWeek (buildWorkoutWeek). */
  sessionsThisWeek: number;
  /** training.volume.week (volumeSinceLb). */
  volumeWeekLb: number;
  /** The week's session days, for the no-plan visual. */
  week: { t: number; logged: boolean; isToday: boolean; isFuture: boolean }[];
  /** training.plan.completion.week; null = no startable plan. */
  completion: { completedThisWeek: number; plannedPerWeek: number } | null;
};

export function TrainingHighlight({
  data,
  locked = false,
  className,
}: {
  /** null only when locked (no member data is fetched below Pro). */
  data: TrainingHighlightData | null;
  /** Entitlement gate: renders the locked teaser (no member data needed). */
  locked?: boolean;
  className?: string;
}) {
  const { sessionsThisWeek, volumeWeekLb, completion } = data ?? {
    sessionsThisWeek: 0,
    volumeWeekLb: 0,
    completion: null,
  };
  const week = data?.week ?? [];
  const planned = completion?.plannedPerWeek ?? 0;
  const complete = completion != null && planned > 0;
  const met = complete && completion.completedThisWeek >= planned;

  return (
    <SummaryPanel
      className={className}
      detailLink={{ label: "Training progress", href: "/progress/training" }}
      empty={{
        absent: "No workouts this week yet.",
        unlock: "Log a workout and your training week builds here.",
        visual: (
          <WeekBars
            days={week.map((d) => ({
              key: d.t,
              fraction: null,
              isToday: d.isToday,
              isFuture: d.isFuture,
            }))}
          />
        ),
      }}
      glow={met ? "emerald" : "blood"}
      headline={
        <span className="tabular-nums">
          {sessionsThisWeek} session{sessionsThisWeek === 1 ? "" : "s"}
        </span>
      }
      icon={<Dumbbell className="size-4" />}
      lockedCapability="Pro members see their training week: workouts, volume, and plan completion."
      state={locked ? "locked" : sessionsThisWeek > 0 ? "populated" : "empty"}
      targetContext={
        volumeWeekLb > 0
          ? `this week · ${formatQuantity(Math.round(volumeWeekLb), "lb")} moved`
          : "this week"
      }
      title="Training this week"
      tone="blood"
      wrapTitle
      visual={
        <div className="flex items-center justify-between gap-3">
          {complete ? (
            <p
              className={cn(
                "text-body-sm text-muted-foreground",
                met && "font-medium text-positive-text"
              )}
            >
              {completion.completedThisWeek} of {planned} plan sessions
              {met ? " · week complete" : ""}
            </p>
          ) : (
            <p className="text-body-sm text-muted-foreground">
              Session days this week
            </p>
          )}
          {complete ? (
            <ProgressRing
              className={met ? "text-positive-text" : "text-blood"}
              fraction={completion.completedThisWeek / planned}
              label={`${completion.completedThisWeek}/${planned}`}
              size={48}
            />
          ) : (
            <WeekBars
              barClassName="bg-blood"
              className="max-w-32"
              days={week.map((d) => ({
                key: d.t,
                fraction: d.logged ? 1 : null,
                isToday: d.isToday,
                isFuture: d.isFuture,
              }))}
            />
          )}
        </div>
      }
    />
  );
}

/* ------------------------------------------------------- graded-week tiles */

function gradedSegments(days: GradedDay[], noun: string): Segment[] {
  return days.map((d) => {
    const date = formatCalendarDayMs(d.t, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const status =
      d.status === "hit"
        ? ("done" as const)
        : d.status === "missed"
          ? ("missed" as const)
          : d.status === "logged"
            ? ("logged" as const)
            : ("unlogged" as const);
    const phrase =
      d.status === "hit"
        ? `met its ${noun}`
        : d.status === "missed"
          ? `missed its ${noun}`
          : d.status === "logged"
            ? `logged, no ${noun} set`
            : "not logged";
    return { key: d.t, status, label: `${date}: ${phrase}` };
  });
}

const EMPTY_SUMMARY: WindowSummary = {
  days: [],
  loggedDays: 0,
  daysAtTarget: 0,
  gradableDays: 0,
  average: null,
  coverage: { loggedDays: 0, windowDays: 0, points: 0, spanDays: 0 },
};

export function NutritionHighlight({
  summary: summaryProp,
  locked = false,
  className,
}: {
  /** nutrition.adherence.window over the elapsed week; null only when locked. */
  summary: WindowSummary | null;
  /** Entitlement gate: renders the locked teaser (no member data needed). */
  locked?: boolean;
  className?: string;
}) {
  const summary = summaryProp ?? EMPTY_SUMMARY;
  const met =
    summary.gradableDays > 0 &&
    summary.daysAtTarget === summary.gradableDays;
  return (
    <SummaryPanel
      className={className}
      detailLink={{ label: "Nutrition progress", href: "/progress" }}
      empty={{
        absent: "No meals logged this week yet.",
        unlock: "Log your days and calorie adherence grades here.",
        visual: (
          <SegmentStrip
            accent="amber"
            label="Calorie adherence week"
            segments={gradedSegments(summary.days, "calorie target")}
          />
        ),
      }}
      glow={met ? "emerald" : "amber"}
      headline={
        summary.gradableDays > 0 ? (
          <span className={cn("tabular-nums", met && "text-positive-text")}>
            {summary.daysAtTarget} of {summary.gradableDays} logged days
          </span>
        ) : (
          <span className="tabular-nums">
            {summary.loggedDays} day{summary.loggedDays === 1 ? "" : "s"} logged
          </span>
        )
      }
      icon={<Utensils className="size-4" />}
      lockedCapability="Pro members see how many days landed within their calorie target."
      state={locked ? "locked" : summary.loggedDays > 0 ? "populated" : "empty"}
      targetContext={
        summary.gradableDays > 0
          ? "within calorie target this week"
          : "this week · no daily target to grade against"
      }
      title="Nutrition adherence"
      tone="amber"
      wrapTitle
      visual={
        <SegmentStrip
          accent="amber"
          label="Calorie adherence week"
          segments={gradedSegments(summary.days, "calorie target")}
        />
      }
    />
  );
}

export function RecoveryHighlight({
  sleep: sleepProp,
  hydration: hydrationProp,
  locked = false,
  className,
}: {
  /** sleep.nightsAtGoal.window over the elapsed week; null only when locked. */
  sleep: WindowSummary | null;
  /** hydration.daysAtGoal.window over the elapsed week; null only when locked. */
  hydration: WindowSummary | null;
  /** Entitlement gate: renders the locked teaser (no member data needed). */
  locked?: boolean;
  className?: string;
}) {
  const sleep = sleepProp ?? EMPTY_SUMMARY;
  const hydration = hydrationProp ?? EMPTY_SUMMARY;
  const logged = sleep.loggedDays > 0 || hydration.loggedDays > 0;
  const met =
    sleep.gradableDays > 0 &&
    sleep.daysAtTarget === sleep.gradableDays &&
    hydration.gradableDays > 0 &&
    hydration.daysAtTarget === hydration.gradableDays;

  return (
    <SummaryPanel
      className={className}
      detailLink={{ label: "Recovery progress", href: "/progress" }}
      empty={{
        absent: "No sleep or water logged this week yet.",
        unlock: "Log nights and water and your recovery week grades here.",
        visual: (
          <SegmentStrip
            accent="emerald"
            label="Sleep week"
            segments={gradedSegments(sleep.days, "sleep goal")}
          />
        ),
      }}
      glow={met ? "emerald" : "indigo"}
      headline={
        sleep.gradableDays > 0 ? (
          <span className="tabular-nums">
            {sleep.daysAtTarget} of {sleep.gradableDays} logged nights
          </span>
        ) : (
          <span className="tabular-nums">
            {sleep.loggedDays} night{sleep.loggedDays === 1 ? "" : "s"} logged
          </span>
        )
      }
      icon={<BedDouble className="size-4" />}
      lockedCapability="Pro members see sleep and hydration graded against their goals each week."
      state={locked ? "locked" : logged ? "populated" : "empty"}
      targetContext={
        sleep.gradableDays > 0
          ? "at your sleep goal this week"
          : "this week"
      }
      title="Recovery consistency"
      tone="indigo"
      wrapTitle
      visual={
        <div className="flex min-w-0 flex-col gap-2">
          <LabeledStrip
            label="Sleep"
            right={
              sleep.gradableDays > 0
                ? `${sleep.daysAtTarget} of ${sleep.gradableDays} at goal`
                : `${sleep.loggedDays} logged`
            }
            strip={
              <SegmentStrip
                accent="emerald"
                label="Sleep week"
                segments={gradedSegments(sleep.days, "sleep goal")}
              />
            }
          />
          <LabeledStrip
            label="Hydration"
            right={
              hydration.gradableDays > 0
                ? `${hydration.daysAtTarget} of ${hydration.gradableDays} at goal`
                : `${hydration.loggedDays} logged`
            }
            strip={
              <SegmentStrip
                accent="emerald"
                label="Hydration week"
                segments={gradedSegments(hydration.days, "water goal")}
              />
            }
          />
        </div>
      }
    />
  );
}

function LabeledStrip({
  label,
  right,
  strip,
}: {
  label: string;
  right: string;
  strip: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-foreground text-meta">{label}</span>
        <span className="text-meta text-muted-foreground tabular-nums">
          {right}
        </span>
      </div>
      {strip}
    </div>
  );
}
