"use client";

/**
 * CHART SYSTEM DEMOS (P2-C harness renderers). One real domain instance per
 * shared chart type, fed ONLY by the deterministic fixture personas, rendered
 * by /dev/fixtures/charts. Same conventions as the P2-B panel demos: the
 * matrix forces a target state; each demo renders that state the way the
 * live dashboard would for this persona, and a data-bearing state with no
 * data falls back to the designed empty treatment.
 */

import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  EMPTY_COVERAGE,
  loggedReading,
  type MetricReading,
  type PanelState,
  unloggedReading,
} from "@/lib/contracts/data-state";
import {
  formatMinutesAsDuration,
  formatQuantity,
  formatVsTargetCompact,
  mlToOz,
} from "@/lib/contracts/units";
import { formatShortDate } from "@/lib/chart/format";
import { DOMAIN, type TrendTone } from "@/lib/chart/palette";
import { ema, round1 } from "@/lib/chart/trend";
import { buildChartSummary } from "@/lib/chart/summary";
import {
  type ChartWindow,
  clampToWindow,
  type DaySlot,
  toDaySlots,
  toWeekSlots,
  windowEndingAt,
} from "@/lib/chart/window";
import {
  fixtureDayAnchorMs,
  type Persona,
} from "@/tests/fixtures/dashboard-states";
import { ChartFrame } from "../chart-frame";
import { DailyBarsChart, WeeklyBarsChart } from "../slot-bars-chart";
import { TrendChart, trendChartLegend } from "../trend-chart";
import { useChartWindow } from "../use-chart-window";

const TODAY = fixtureDayAnchorMs(0);

export type ChartDemoProps = {
  persona: Persona;
  state: PanelState;
  compact?: boolean;
};

/** Data states need data; a persona without any renders the designed empty. */
function effectiveState(state: PanelState, hasData: boolean): PanelState {
  const dataStates: PanelState[] = ["sparse", "stale", "populated"];
  return dataStates.includes(state) && !hasData ? "empty" : state;
}

function logAction(label: string, href: string) {
  return (
    <Button asChild className="min-h-11 sm:min-h-8" size="sm" variant="outline">
      <Link href={href}>{label}</Link>
    </Button>
  );
}

function coverageOf(
  slots: readonly DaySlot[],
  points = slots.filter((s) => s.value != null).length
) {
  const loggedIdx = slots.flatMap((s, i) => (s.value != null ? [i] : []));
  return {
    loggedDays: loggedIdx.length,
    windowDays: slots.length,
    points,
    spanDays: loggedIdx.length >= 2 ? loggedIdx[loggedIdx.length - 1] - loggedIdx[0] : 0,
  };
}

/* ------------------------------------------------------------ weight trend */

export function WeightTrendChartDemo({ persona, state, compact }: ChartDemoProps) {
  const points = useMemo(
    () => persona.weighIns.map((p) => ({ t: p.t, value: p.weight })),
    [persona.weighIns]
  );
  const { window: w, rows, control } = useChartWindow(points, {
    todayMs: TODAY,
    minPoints: 8,
  });

  const trendRows = useMemo(
    () =>
      clampToWindow(
        ema(points.map((p) => ({ t: p.t, weight: p.value }))),
        w
      ),
    [points, w]
  );

  const goal = persona.goal
    ? {
        value: persona.goal.targetValue,
        label: `Goal ${formatQuantity(persona.goal.targetValue, "lb")}`,
      }
    : null;

  const tone: TrendTone = useMemo(() => {
    if (!persona.goal || trendRows.length < 2) {
      return "neutral";
    }
    const change = trendRows[trendRows.length - 1].trend - trendRows[0].trend;
    if (Math.abs(change) < 0.2) {
      return "neutral";
    }
    const goalIsBelow = persona.goal.targetValue < trendRows[0].trend;
    return (change < 0) === goalIsBelow ? "toward" : "away";
  }, [persona.goal, trendRows]);

  const last = persona.weighIns.at(-1);
  const ageDays = last ? Math.round((TODAY - last.t) / 86_400_000) : 0;
  const reading: MetricReading<number> =
    trendRows.length > 0
      ? loggedReading(round1(trendRows[trendRows.length - 1].trend), {
          coverage: {
            loggedDays: rows.length,
            windowDays: w.days,
            points: rows.length,
            spanDays: 0,
          },
          estimated: true,
          ageDays,
        })
      : unloggedReading(EMPTY_COVERAGE);

  const s = effectiveState(state, points.length > 0);
  const summary = buildChartSummary({
    title: "Weight trend",
    rangeLabel: control.rangeLabel,
    reading,
    unit: "lb",
    // The summary builder prefixes the label word before the formatted value.
    goal: goal ? { value: goal.value, label: "Goal" } : null,
  });

  return (
    <ChartFrame
      caption={
        s === "stale" && last
          ? `Last logged ${formatShortDate(last.t)}`
          : undefined
      }
      chrome={!compact}
      compact={compact}
      coverage={reading.status === "logged" ? reading.coverage : undefined}
      emptyAction={logAction("Log a weigh-in", "/progress")}
      emptyMessage="Log your first weigh-in and your trend line starts here."
      goalText={goal?.label}
      headlineLabel="Trend weight"
      height={compact ? 110 : 260}
      legend={trendChartLegend(tone, {
        raw: "Weighed in",
        trend: "Trend (smoothed)",
        goal: goal ? "Goal" : undefined,
      })}
      lockedCapability="Weight trend charts with goal tracking are a Pro feature."
      onRetry={() => undefined}
      range={compact ? undefined : control}
      reading={reading}
      state={s}
      summary={summary}
      title="Weight trend"
      unit="lb"
    >
      <TrendChart
        compact={compact}
        goal={goal}
        points={points}
        rawLabel="Weighed in"
        tone={tone}
        trendLabel="Trend"
        unit="lb"
        window={w}
      />
    </ChartFrame>
  );
}

/* ------------------------------------------------------- daily bars: kcal */

export function CaloriesBarsChartDemo({ persona, state, compact }: ChartDemoProps) {
  const w = windowEndingAt(TODAY, 7);
  const slots = useMemo(
    () =>
      toDaySlots(
        w,
        persona.meals.map((m) => ({ t: m.recordedAt.getTime(), value: m.calories }))
      ),
    [persona.meals, w]
  );
  const target = persona.nutritionTarget
    ? {
        value: persona.nutritionTarget.calories,
        label: `Target ${formatQuantity(persona.nutritionTarget.calories, "kcal")}`,
        direction: "atMost" as const,
      }
    : null;

  const coverage = coverageOf(slots, persona.meals.length);
  const todayValue = slots[slots.length - 1]?.value;
  const reading: MetricReading<number> =
    todayValue != null
      ? loggedReading(todayValue, { coverage })
      : unloggedReading(coverage);

  const s = effectiveState(state, coverage.loggedDays > 0);
  const summary = buildChartSummary({
    title: "Calories",
    rangeLabel: "last 7 days",
    reading,
    unit: "kcal",
    goal: target ? { value: target.value, label: "Target" } : null,
  });

  return (
    <ChartFrame
      chrome={!compact}
      compact={compact}
      coverage={coverage}
      emptyAction={logAction("Log a meal", "/nutrition")}
      emptyMessage="Log your first meal to see your daily calories here."
      goalText={
        target && todayValue != null
          ? formatVsTargetCompact(todayValue, target.value, "kcal")
          : target
            ? target.label
            : undefined
      }
      headlineLabel="today"
      height={compact ? 120 : 200}
      lockedCapability="Daily calorie charts against your target are a Pro feature."
      onRetry={() => undefined}
      rangeLabel="last 7 days"
      reading={reading}
      state={s}
      summary={summary}
      title="Calories"
      unit="kcal"
    >
      <DailyBarsChart
        color={DOMAIN.nutrition}
        compact={compact}
        formatAxisTick={(v) => (v >= 1000 ? `${round1(v / 1000)}k` : `${v}`)}
        slots={slots}
        target={target}
        tipLabel="Calories"
        unit="kcal"
      />
    </ChartFrame>
  );
}

/* ------------------------------------------------------ daily bars: water */

export function HydrationBarsChartDemo({ persona, state, compact }: ChartDemoProps) {
  const w = windowEndingAt(TODAY, 7);
  const goalOz = Math.round(mlToOz(persona.waterGoalMl));
  const slots = useMemo(
    () =>
      toDaySlots(
        w,
        persona.waterDaily.map((d) => ({ t: d.t, value: d.ml }))
      ).map((s) => ({
        t: s.t,
        value: s.value == null ? null : Math.round(mlToOz(s.value)),
      })),
    [persona.waterDaily, w]
  );

  const target = {
    value: goalOz,
    label: `Goal ${formatQuantity(goalOz, "oz")}`,
    direction: "atLeast" as const,
  };
  const coverage = coverageOf(slots);
  const todayValue = slots[slots.length - 1]?.value;
  const reading: MetricReading<number> =
    todayValue != null
      ? loggedReading(todayValue, { coverage })
      : unloggedReading(coverage);

  const s = effectiveState(state, coverage.loggedDays > 0);
  const summary = buildChartSummary({
    title: "Water",
    rangeLabel: "last 7 days",
    reading,
    unit: "oz",
    goal: { value: goalOz, label: "Goal" },
  });

  return (
    <ChartFrame
      chrome={!compact}
      compact={compact}
      coverage={coverage}
      emptyAction={logAction("Log water", "/hydration")}
      emptyMessage="Log your first glass to see your week here."
      goalText={
        todayValue != null
          ? formatVsTargetCompact(todayValue, goalOz, "oz")
          : target.label
      }
      headlineLabel="today"
      height={compact ? 120 : 200}
      lockedCapability="Hydration charts against your daily goal are a Pro feature."
      onRetry={() => undefined}
      rangeLabel="last 7 days"
      reading={reading}
      state={s}
      summary={summary}
      title="Water"
      unit="oz"
    >
      <DailyBarsChart
        axisSuffix="oz"
        color={DOMAIN.hydration}
        compact={compact}
        slots={slots}
        target={target}
        tipLabel="Water"
        unit="oz"
      />
    </ChartFrame>
  );
}

/* ------------------------------------------------------ daily bars: sleep */

export function SleepBarsChartDemo({ persona, state, compact }: ChartDemoProps) {
  const w = windowEndingAt(TODAY, 7);
  const slots = useMemo(
    () =>
      toDaySlots(
        w,
        persona.sleepDaily.map((n) => ({ t: n.t, value: n.minutes }))
      ),
    [persona.sleepDaily, w]
  );
  const target = persona.sleepGoalMinutes
    ? {
        value: persona.sleepGoalMinutes,
        label: `Goal ${formatMinutesAsDuration(persona.sleepGoalMinutes)}`,
        direction: "atLeast" as const,
      }
    : null;

  const coverage = coverageOf(slots);
  const lastNight = slots[slots.length - 1]?.value;
  const reading: MetricReading<number> =
    lastNight != null
      ? loggedReading(lastNight, { coverage })
      : unloggedReading(coverage);

  const s = effectiveState(state, coverage.loggedDays > 0);
  const summary = buildChartSummary({
    title: "Sleep",
    rangeLabel: "last 7 days",
    reading,
    unit: "duration",
    goal: target ? { value: target.value, label: "Goal" } : null,
  });

  return (
    <ChartFrame
      chrome={!compact}
      compact={compact}
      coverage={coverage}
      emptyAction={logAction("Log last night", "/sleep")}
      emptyMessage="Log last night's sleep to see your week here."
      goalText={target?.label}
      headlineLabel="last night"
      height={compact ? 120 : 200}
      lockedCapability="Sleep duration charts against your goal are a Pro feature."
      onRetry={() => undefined}
      rangeLabel="last 7 days"
      reading={reading}
      state={s}
      summary={summary}
      title="Sleep"
      unit="duration"
    >
      <DailyBarsChart
        color={DOMAIN.sleep}
        compact={compact}
        formatAxisTick={(v) => `${Math.round(v / 60)}h`}
        formatValue={(v) => formatMinutesAsDuration(v)}
        slots={slots}
        target={target}
        tipLabel="Sleep"
        unit="duration"
        yScale={{ unit: 60, steps: [1, 2, 3] }}
      />
    </ChartFrame>
  );
}

/* ------------------------------------------------- weekly bars: frequency */

export function TrainingFrequencyChartDemo({ persona, state, compact }: ChartDemoProps) {
  const w = windowEndingAt(TODAY, 28);
  const events = useMemo(
    () =>
      persona.workouts.map((wk) => ({ t: new Date(wk.performedAt).getTime() })),
    [persona.workouts]
  );
  const slots = useMemo(() => toWeekSlots(w, events), [w, events]);
  const target = {
    value: 3,
    label: "Plan 3 sessions",
    direction: "atLeast" as const,
  };

  const thisWeek = slots[slots.length - 1]?.value ?? 0;
  // Session counts are the missing-renders-as-zero carve-out: 0 is a fact.
  const coverage = {
    loggedDays: events.filter((e) => e.t >= w.startMs).length,
    windowDays: w.days,
    points: events.length,
    spanDays: 0,
  };
  const reading = loggedReading(thisWeek, { coverage });

  const s = effectiveState(state, persona.workouts.length > 0);
  const summary = buildChartSummary({
    title: "Workouts per week",
    rangeLabel: "last 4 weeks",
    reading,
    unit: "count",
    extra: ["Plan 3 sessions per week"],
  });

  return (
    <ChartFrame
      chrome={!compact}
      compact={compact}
      emptyAction={logAction("Start a workout", "/workouts")}
      emptyMessage="Finish your first workout to see your training weeks here."
      goalText={target.label}
      headline={`${thisWeek} of 3`}
      headlineLabel="sessions this week"
      height={compact ? 120 : 200}
      lockedCapability="Training frequency charts are a Pro feature."
      onRetry={() => undefined}
      rangeLabel="last 4 weeks"
      reading={reading}
      state={s}
      summary={summary}
      title="Workouts per week"
      unit="count"
    >
      <WeeklyBarsChart
        color={DOMAIN.training}
        compact={compact}
        formatValue={(v) => `${v} session${v === 1 ? "" : "s"}`}
        slots={slots}
        target={target}
        tipLabel="Workouts"
      />
    </ChartFrame>
  );
}
