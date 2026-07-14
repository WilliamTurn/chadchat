/**
 * The nine cross-domain Progress overview sections (FIX-32, P56-A), each a
 * typed P2 panel role (rule 9: system-only composition). Sections take
 * pre-computed view models (built by app/progress/page.tsx from registered
 * metric sources, or by the fixture demo from personas) so every displayed
 * number is a registered metric computed in its one module.
 *
 * Every section renders in EVERY state: visible, explicitly empty, or
 * explicitly locked; a category never silently disappears (doc 04 empty and
 * sparse behavior). Insight slots stay structural: sections accept an
 * optional one-sentence `insight` and render nothing when absent (the
 * FIX-36A engine is P7 and deliberately not built here).
 *
 * Visual vocabulary, deliberately domain-diverse (directive 1a): Body = the
 * raw-under-trend line; Training = weekly session bars; Nutrition = a
 * categorical adherence calendar; Sleep = nightly bars against the goal;
 * Hydration = a days-at-goal ring; Consistency = the 12-week intensity
 * calendar; Goals = per-outcome progress bullets; Milestones = the reward
 * moment with glow; Reports = the latest review summary.
 */

import {
  Droplets,
  Dumbbell,
  FileText,
  Flame,
  Moon,
  Target,
  Trophy,
  UtensilsCrossed,
  Weight,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import {
  CalendarHeatmap,
  type HeatmapCell,
} from "@/components/charts/calendar-heatmap";
import { RingGauge } from "@/components/charts/ring-gauge";
import {
  type BarTarget,
  DailyBarsChart,
  WeeklyBarsChart,
} from "@/components/charts/slot-bars-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import {
  MilestonePanel,
  SummaryPanel,
  TrendPanel,
} from "@/components/panels/roles";
import { DOMAIN, type TrendTone } from "@/lib/chart/palette";
import type { ChartWindow, DaySlot, WeekSlot } from "@/lib/chart/window";
import type { PanelState } from "@/lib/contracts/data-state";

/* ----------------------------------------------------------------- shared */

/** Quiet start-here link for designed empty states (one action max). */
function quietAction(label: string, href: string) {
  return (
    <Link
      className="inline-flex min-h-11 items-center font-medium text-body-sm text-foreground underline-offset-4 hover:underline sm:min-h-0"
      href={href}
    >
      {label}
    </Link>
  );
}

/** Adherence calendar categories, stated without moral tone. A logged day
 * with NO target active that day is its own honest category (FIX-07 makes
 * this reachable), never colored as a miss. */
const ADHERENCE_CATEGORIES = [
  { color: "var(--chart-2)", label: "within target" },
  { color: "var(--chart-3)", label: "off target" },
  { color: "var(--chart-neutral)", label: "logged, no target that day" },
] as const;

/* ------------------------------------------------------------------- body */

export type BodySectionVM = {
  state: PanelState;
  /** Formatted trend weight ("208.8 lb"), the canonical current (LC-4). */
  headline: string | null;
  /** "1.7 lb down · last 30 days" (trend-direction claim, gated upstream). */
  changeText: string | null;
  /** "Goal 195 lb · 48% there" or null without a weight goal. */
  goalText: string | null;
  tone: TrendTone;
  points: { t: number; value: number }[];
  window: ChartWindow;
  unit: "lb" | "kg";
  goalWeight: number | null;
  coverageText: string;
  insight?: string;
};

export function BodySection({ vm }: { vm: BodySectionVM }) {
  return (
    <TrendPanel
      coverage={vm.coverageText}
      detailLink={{ label: "Body details", href: "/progress/body" }}
      empty={{
        absent: "No weigh-ins yet.",
        unlock:
          "Log your first weigh-in and your trend line starts here within a week.",
        action: quietAction("Log a weigh-in", "/progress/body#log-entry"),
      }}
      footer={{
        status: vm.insight,
        askChad: (
          <AskChadButton prompt="Review my body progress: my weight trend against my goal. What should I adjust?" />
        ),
        primary: { label: "Log a weigh-in", href: "/progress/body#log-entry" },
      }}
      headline={vm.headline ?? "Not logged"}
      icon={<Weight className="size-4" />}
      lockedCapability="Weight trend, measurements, and progress photos are a Pro feature."
      state={vm.state}
      targetContext={
        [vm.changeText, vm.goalText].filter(Boolean).join(" · ") || undefined
      }
      title="Body"
      tone="emerald"
      visual={
        <div style={{ height: 150 }}>
          <TrendChart
            compact
            glow
            goal={
              vm.goalWeight != null
                ? {
                    value: vm.goalWeight,
                    label: `Goal ${vm.goalWeight} ${vm.unit}`,
                  }
                : null
            }
            points={vm.points}
            rawLabel="Weighed in"
            tone={vm.tone}
            trendLabel="Trend"
            unit={vm.unit}
            window={vm.window}
          />
        </div>
      }
    />
  );
}

/* --------------------------------------------------------------- training */

export type TrainingSectionVM = {
  state: PanelState;
  /** "2 sessions this week" (training.sessions.thisWeek). */
  headline: string;
  /** "7 personal records · 12,400 lb this week" style context. */
  context: string | null;
  weekSlots: WeekSlot[];
  /** Plan sessions/week when a structured plan exists (FIX-28). */
  target: BarTarget | null;
  coverageText: string;
  insight?: string;
};

export function TrainingSection({ vm }: { vm: TrainingSectionVM }) {
  return (
    <TrendPanel
      coverage={vm.coverageText}
      detailLink={{ label: "Training progress", href: "/progress/training" }}
      empty={{
        absent: "No workouts logged yet.",
        unlock:
          "Log your first session and your frequency, volume, and records build from there.",
        action: quietAction("Log a workout", "/workouts/new"),
      }}
      footer={{
        status: vm.insight,
        askChad: (
          <AskChadButton prompt="Review my training progress: session frequency, volume, and records. Where am I slipping?" />
        ),
      }}
      headline={vm.headline}
      icon={<Dumbbell className="size-4" />}
      lockedCapability="Training analytics with records and milestone timelines are a Pro feature."
      state={vm.state}
      targetContext={vm.context ?? undefined}
      title="Training"
      tone="blood"
      visual={
        <div style={{ height: 150 }}>
          <WeeklyBarsChart
            color={DOMAIN.training}
            slots={vm.weekSlots}
            target={vm.target}
            tipLabel="Sessions"
          />
        </div>
      }
    />
  );
}

/* -------------------------------------------------------------- nutrition */

export type NutritionSectionVM = {
  state: PanelState;
  /** "4 of 6 logged days within target" (nutrition.adherence.window). */
  headline: string;
  /** "avg 2,150 kcal · last 28 days" context. */
  context: string | null;
  cells: HeatmapCell[];
  todayMs: number;
};

export function NutritionSection({ vm }: { vm: NutritionSectionVM }) {
  return (
    <SummaryPanel
      detailLink={{ label: "Nutrition details", href: "/nutrition" }}
      empty={{
        absent: "No meals logged in this window.",
        unlock: "Log meals and each day grades against that day's target.",
        action: quietAction("Log a meal", "/nutrition#log-meal"),
      }}
      headline={vm.headline}
      icon={<UtensilsCrossed className="size-4" />}
      lockedCapability="Nutrition tracking with per-day target grading is a Pro feature."
      state={vm.state}
      targetContext={vm.context ?? undefined}
      title="Nutrition"
      tone="amber"
      visual={
        <CalendarHeatmap
          categories={ADHERENCE_CATEGORIES}
          cells={vm.cells}
          tipLabel="calories"
          todayMs={vm.todayMs}
        />
      }
    />
  );
}

/* ------------------------------------------------------------------ sleep */

export type SleepSectionVM = {
  state: PanelState;
  /** "7h 12m average" (sleep.avg.window). */
  headline: string;
  /** "5 of 9 nights at goal · last 14 nights shown". */
  context: string | null;
  slots: DaySlot[];
  target: BarTarget | null;
};

export function SleepSection({ vm }: { vm: SleepSectionVM }) {
  return (
    <SummaryPanel
      detailLink={{ label: "Sleep trends", href: "/sleep" }}
      empty={{
        absent: "No sleep logged in this window.",
        unlock: "Log last night and your nightly pattern builds here.",
        action: quietAction("Log sleep", "/sleep"),
      }}
      headline={vm.headline}
      icon={<Moon className="size-4" />}
      lockedCapability="Sleep tracking with nightly goal grading is a Pro feature."
      state={vm.state}
      targetContext={vm.context ?? undefined}
      title="Sleep"
      tone="violet"
      visual={
        <div style={{ height: 72 }}>
          <DailyBarsChart
            color={DOMAIN.sleep}
            compact
            slots={vm.slots}
            target={vm.target}
            tipLabel="Sleep"
            unit="duration"
          />
        </div>
      }
    />
  );
}

/* -------------------------------------------------------------- hydration */

export type HydrationSectionVM = {
  state: PanelState;
  /** "9 of 12 logged days at goal" (hydration.daysAtGoal.window). */
  headline: string;
  /** "avg 96 oz per logged day · last 30 days". */
  context: string | null;
  /** daysAtGoal / gradable days, 0..1 (LC-9); null = nothing gradable. */
  fraction: number | null;
  /** Center value ("96 oz"). */
  centerValue: string | null;
};

export function HydrationSection({ vm }: { vm: HydrationSectionVM }) {
  return (
    <SummaryPanel
      detailLink={{ label: "Hydration details", href: "/hydration" }}
      empty={{
        absent: "No water logged in this window.",
        unlock: "Log water and your days-at-goal ring fills here.",
        action: quietAction("Log water", "/hydration"),
      }}
      headline={vm.headline}
      icon={<Droplets className="size-4" />}
      lockedCapability="Hydration tracking with daily goal grading is a Pro feature."
      state={vm.state}
      targetContext={vm.context ?? undefined}
      title="Hydration"
      tone="sky"
      visual={
        <div className="flex items-center gap-4">
          {vm.fraction != null && (
            <RingGauge
              color={DOMAIN.hydration}
              fraction={vm.fraction}
              size={76}
            >
              <span className="font-semibold text-sm tabular-nums">
                {Math.round(vm.fraction * 100)}%
              </span>
            </RingGauge>
          )}
          {vm.centerValue && (
            <div className="min-w-0">
              <div className="font-semibold text-lg tabular-nums">
                {vm.centerValue}
              </div>
              <div className="text-muted-foreground text-xs">
                average per logged day
              </div>
            </div>
          )}
        </div>
      }
    />
  );
}

/* ------------------------------------------------------------ consistency */

export type ConsistencySectionVM = {
  state: PanelState;
  /** "12 day streak" (engagement.streak.days). */
  headline: string;
  /** "58 of 84 days logged · last 12 weeks" (engagement.consistency.window). */
  context: string | null;
  cells: HeatmapCell[];
  maxLevel: number;
  todayMs: number;
  /** Streak alive = the reward glow moment (owner reward law). */
  glowing: boolean;
};

export function ConsistencySection({ vm }: { vm: ConsistencySectionVM }) {
  return (
    <SummaryPanel
      detailLink={{ label: "Dashboard", href: "/today" }}
      empty={{
        absent: "Nothing logged yet.",
        unlock:
          "Log anything, in any domain, and every active day lights up here.",
      }}
      glow={vm.glowing ? "emerald" : undefined}
      headline={vm.headline}
      icon={<Flame className="size-4" />}
      lockedCapability="The consistency calendar and streaks are a Pro feature."
      state={vm.state}
      targetContext={vm.context ?? undefined}
      title="Consistency"
      tone="emerald"
      visual={
        <CalendarHeatmap
          cells={vm.cells}
          color="var(--chart-2)"
          maxLevel={vm.maxLevel}
          tipLabel="domains logged"
          todayMs={vm.todayMs}
        />
      }
    />
  );
}

/* ------------------------------------------------------------- milestones */

export type MilestoneSectionVM = {
  state: PanelState;
  /** "Bench Press record" or "7-day streak" (the latest real achievement). */
  headline: string;
  /** "225 lb est. 1RM · Jul 2" detail line. */
  detail: string | null;
  /** Progress toward the NEXT milestone when none is reached yet. */
  nextText: string | null;
};

export function MilestoneSection({ vm }: { vm: MilestoneSectionVM }) {
  return (
    <MilestonePanel
      detailLink={{ label: "Training progress", href: "/progress/training" }}
      empty={{
        absent: "No milestones yet.",
        unlock:
          vm.nextText ??
          "Your first record or streak milestone lands here the moment it happens.",
      }}
      glow={vm.state === "populated" ? "amber" : undefined}
      headline={vm.headline}
      icon={<Trophy className="size-4" />}
      lockedCapability="Records and milestone rewards are a Pro feature."
      state={vm.state}
      title="Milestones"
      tone="amber"
      visual={
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500 [filter:drop-shadow(0_0_8px_color-mix(in_oklab,var(--chart-3)_45%,transparent))]"
          >
            <Trophy className="size-5" />
          </span>
          <div className="min-w-0 text-body-sm text-muted-foreground">
            {vm.detail ?? vm.nextText}
          </div>
        </div>
      }
    />
  );
}

/* ---------------------------------------------------------------- reports */

export type ReportsSectionVM = {
  state: PanelState;
  /** "Week of Jul 6" (the latest report's period). */
  headline: string;
  /** "Generated Jul 7 · your weekly cross-domain review." */
  context: string | null;
};

export function ReportsSection({ vm }: { vm: ReportsSectionVM }) {
  return (
    <SummaryPanel
      detailLink={{ label: "Weekly report", href: "/reports" }}
      empty={{
        absent: "No weekly report yet.",
        unlock:
          "Your first report arrives after a week of logging: training, nutrition, body, and recovery reviewed in one place.",
      }}
      headline={vm.headline}
      icon={<FileText className="size-4" />}
      lockedCapability="The weekly cross-domain report is a Chad Elite feature."
      state={vm.state}
      targetContext={vm.context ?? undefined}
      lockedCta="Compare plans"
      title="Weekly report"
      tone="sky"
      visual={
        <p className="text-body-sm text-muted-foreground">
          Training, nutrition, body, and recovery, reviewed together with an
          eye on next week.
        </p>
      }
    />
  );
}

/* ------------------------------------------------------------------ goals */

export type GoalOutcomeVM = {
  label: string;
  supported: boolean;
  /** Formatted current value, from the outcome metric's one source module. */
  currentText: string | null;
  targetText: string | null;
  /** 0..1 progress when start/target/current are all known; else null. */
  fraction: number | null;
  reached: boolean;
};

export type GoalSectionVM = {
  id: string;
  title: string;
  /** "48% there" / "Reached" / "2 outcomes tracked". */
  headline: string;
  outcomes: GoalOutcomeVM[];
  state: PanelState;
};

function OutcomeBullet({ o }: { o: GoalOutcomeVM }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-body-sm text-foreground">{o.label}</span>
        <span className="shrink-0 text-meta text-muted-foreground tabular-nums">
          {o.currentText ?? (o.supported ? "Not logged" : "Tracked by hand")}
          {o.targetText ? ` / ${o.targetText}` : ""}
        </span>
      </div>
      {o.fraction != null ? (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-inset">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round(Math.min(1, Math.max(0, o.fraction)) * 100)}%`,
              backgroundColor: "var(--chart-2)",
              opacity: o.reached ? 1 : 0.7,
            }}
          />
        </div>
      ) : (
        <div className="mt-1 h-1.5 rounded-full border border-border/70 border-dashed" />
      )}
    </div>
  );
}

export function GoalSection({ vm }: { vm: GoalSectionVM }) {
  return (
    <SummaryPanel
      detailLink={{ label: "Goal details", href: `/goals/${vm.id}` }}
      empty={{
        absent: "No measurable outcomes yet.",
        unlock: "Link an outcome and its live progress renders here.",
      }}
      headline={vm.headline}
      icon={<Target className="size-4" />}
      lockedCapability="Goal outcome tracking is included with your plan."
      state={vm.state}
      title={vm.title}
      tone="emerald"
      visual={
        <div className="flex flex-col gap-2.5">
          {vm.outcomes.slice(0, 3).map((o) => (
            <OutcomeBullet key={o.label} o={o} />
          ))}
          {vm.outcomes.length > 3 && (
            <p className="text-meta text-muted-foreground">
              {vm.outcomes.length - 3} more in goal details
            </p>
          )}
        </div>
      }
    />
  );
}

/** The designed no-goals state: one explicit panel, never a missing section. */
export function GoalsEmptySection() {
  return (
    <SummaryPanel
      detailLink={{ label: "Goals", href: "/goals" }}
      empty={{
        absent: "No active goals.",
        unlock:
          "Set a goal and every linked outcome tracks here automatically.",
        action: quietAction("Set a goal", "/goals/new"),
      }}
      headline="No active goals"
      icon={<Target className="size-4" />}
      lockedCapability="Goals are included with your plan."
      state="empty"
      title="Goals"
      tone="emerald"
      visual={<span />}
    />
  );
}

/* ------------------------------------------------------------ section band */

/** Uncluttered section heading row for the overview's grid groups. */
export function OverviewBand({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="col-span-4 flex items-baseline justify-between gap-3 md:col-span-8 xl:col-span-12">
      <h2 className="text-muted-foreground text-section-title">{title}</h2>
      {children}
    </div>
  );
}
