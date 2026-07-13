"use client";

/**
 * Daily hydration trend (the /hydration detail page), MIGRATED onto the
 * FIX-18 shared chart system (P2-Z): ChartFrame carries the grammar (title,
 * headline via units.ts, range control, goal text, coverage, sr summary) and
 * DailyBarsChart draws one bar per WINDOW day (DSH-60: the axis spans the
 * window, unlogged days are gaps, never zeros).
 *
 * The window-following stats (Avg / day, Days hit goal) compose OUTSIDE the
 * chart at page level from the same slots the chart draws — the "KPI strip
 * composes at panel level" rule (P2-C handoff): the chart system never grows
 * bespoke KPI slots.
 */

import { useMemo } from "react";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { ChartFrame } from "@/components/charts/chart-frame";
import { DailyBarsChart } from "@/components/charts/slot-bars-chart";
import { useChartWindow } from "@/components/charts/use-chart-window";
import { Kpi } from "@/components/dashboard/kpi";
import { DOMAIN } from "@/lib/chart/palette";
import { buildChartSummary } from "@/lib/chart/summary";
import { toDaySlots } from "@/lib/chart/window";
import {
  type Coverage,
  loggedReading,
  type MetricReading,
  unloggedReading,
} from "@/lib/contracts/data-state";
import { formatQuantity, mlToOz } from "@/lib/contracts/units";
import { DEFAULT_WATER_GOAL_ML } from "@/lib/today/water-units";

const ASK_CHAD_PROMPT =
  "Look at my hydration trend chart: how my daily water intake has tracked against my goal over the last couple of weeks. What's the pattern, and what would keep me consistent?";

type Point = { t: number; ml: number };

export function WaterTrendChart({
  days,
  goalMl = DEFAULT_WATER_GOAL_ML,
  todayMs,
}: {
  days: Point[];
  goalMl?: number;
  /** Member-local today anchor (todayAnchorInTz), for window determinism. */
  todayMs: number;
}) {
  const safeGoal = goalMl > 0 ? goalMl : DEFAULT_WATER_GOAL_ML;
  const goalOz = Math.round(mlToOz(safeGoal));

  const points = useMemo(
    () => days.map((d) => ({ t: d.t, value: d.ml })),
    [days]
  );
  const { window: w, control } = useChartWindow(points, {
    todayMs,
    minPoints: 7,
  });

  // Slots in the DISPLAY unit (oz): stored ml, spoken ounces (DSH-24/34).
  const slots = useMemo(
    () =>
      toDaySlots(w, points).map((s) => ({
        t: s.t,
        value: s.value == null ? null : Math.round(mlToOz(s.value)),
      })),
    [points, w]
  );

  const coverage = useMemo<Coverage>(() => {
    const loggedIdx = slots.flatMap((s, i) => (s.value != null ? [i] : []));
    return {
      loggedDays: loggedIdx.length,
      windowDays: slots.length,
      points: loggedIdx.length,
      spanDays:
        loggedIdx.length >= 2 ? loggedIdx[loggedIdx.length - 1] - loggedIdx[0] : 0,
    };
  }, [slots]);

  // Window-following stats from the SAME slots the chart draws (one source).
  const stats = useMemo(() => {
    const logged = slots.filter((s) => s.value != null) as {
      t: number;
      value: number;
    }[];
    if (logged.length === 0) {
      return null;
    }
    const avgOz = Math.round(
      logged.reduce((sum, s) => sum + s.value, 0) / logged.length
    );
    const hit = logged.filter((s) => s.value >= goalOz).length;
    // Denominator = every day in the window, unlogged included.
    return { avgOz, hit, total: slots.length };
  }, [slots, goalOz]);

  const target = {
    value: goalOz,
    label: `Goal ${formatQuantity(goalOz, "oz")}`,
    direction: "atLeast" as const,
  };

  const todayValue = slots[slots.length - 1]?.value;
  const reading: MetricReading<number> =
    todayValue != null
      ? loggedReading(todayValue, { coverage })
      : unloggedReading(coverage);

  const summary = buildChartSummary({
    title: "Water",
    rangeLabel: control.rangeLabel,
    reading,
    unit: "oz",
    goal: { value: goalOz, label: "Goal" },
  });

  if (days.length < 2) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <ChartFrame
        chrome={false}
        coverage={coverage}
        goalText={target.label}
        headlineLabel="today"
        height={200}
        range={control}
        reading={reading}
        state="populated"
        summary={summary}
        title="Water"
        unit="oz"
      >
        <DailyBarsChart
          axisSuffix="oz"
          color={DOMAIN.hydration}
          slots={slots}
          target={target}
          tipLabel="Water"
          unit="oz"
        />
      </ChartFrame>

      {/* Page-level KPI strip + Ask Chad (capability preserved from the old
          ChartCard); values follow the selected window above. */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-border border-t pt-4">
        {stats && (
          <div className="flex items-end gap-6">
            <Kpi
              label="Avg / day"
              size="lg"
              value={formatQuantity(stats.avgOz, "oz")}
            />
            <Kpi
              label="Days hit goal"
              tone={stats.hit > 0 ? "good" : "neutral"}
              value={`${stats.hit} / ${stats.total}`}
            />
          </div>
        )}
        <AskChadButton
          className="min-h-11 sm:min-h-8"
          prompt={ASK_CHAD_PROMPT}
        />
      </div>
    </section>
  );
}
