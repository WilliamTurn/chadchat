"use client";

/**
 * Nightly sleep trend (the /sleep detail page), MIGRATED onto the FIX-18
 * shared chart system (P2-Z): ChartFrame carries the grammar and
 * DailyBarsChart draws one bar per WINDOW night (DSH-60: the axis spans the
 * window; unlogged nights are gaps, never zeros).
 *
 * One window, one denominator (LC-9): BOTH stats count only the nights the
 * user actually logged in the selected range. A night with no log is
 * unknown, not a miss; the chart's gaps already show it. The stats compose
 * at page level from the same slots the chart draws (the "KPI strip composes
 * at panel level" rule; the chart system has no bespoke KPI slots).
 *
 * Per-night quality stays on this page in the "Sleep history" list; the
 * shared chart tooltip speaks duration only.
 */

import { useMemo } from "react";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { ChartFrame } from "@/components/charts/chart-frame";
import { DailyBarsChart } from "@/components/charts/slot-bars-chart";
import { useUrlChartWindow } from "@/hooks/use-url-chart-range";
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
import { formatMinutesAsDuration } from "@/lib/contracts/units";
import { SLEEP_GOAL_MINUTES } from "@/lib/validation/sleep";

const ASK_CHAD_PROMPT =
  "Look at my sleep trend chart: the night-to-night pattern over the last couple of weeks, not just one night. Is my sleep consistent enough to recover and make progress, and what would smooth it out?";

type Point = { t: number; minutes: number; quality: number | null };

export function SleepTrendChart({
  days,
  goalMinutes = SLEEP_GOAL_MINUTES,
  todayMs,
}: {
  days: Point[];
  /** The user's nightly target (DSH-40); defaults to the recommended 7h. */
  goalMinutes?: number;
  /** Member-local today anchor (todayAnchorInTz), for window determinism. */
  todayMs: number;
}) {
  const isDefaultGoal = goalMinutes === SLEEP_GOAL_MINUTES;
  const goalLabel = formatMinutesAsDuration(goalMinutes);

  const points = useMemo(
    () => days.map((d) => ({ t: d.t, value: d.minutes })),
    [days]
  );
  // URL-synced (FIX-03): `?range=` restores across back/forward and deep
  // links. This chart mounts only on /sleep, which owns the param.
  const { window: w, control } = useUrlChartWindow(points, {
    todayMs,
    minPoints: 7,
  });

  const slots = useMemo(() => toDaySlots(w, points), [points, w]);

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

  // Window-following stats, logged nights only (LC-9), from the same slots.
  const stats = useMemo(() => {
    const logged = slots.filter((s) => s.value != null) as {
      t: number;
      value: number;
    }[];
    if (logged.length === 0) {
      return null;
    }
    const avg = Math.round(
      logged.reduce((sum, s) => sum + s.value, 0) / logged.length
    );
    const hit = logged.filter((s) => s.value >= goalMinutes).length;
    return { avg, hit, logged: logged.length };
  }, [slots, goalMinutes]);

  const target = {
    value: goalMinutes,
    label: `Goal ${goalLabel}`,
    direction: "atLeast" as const,
  };

  const lastNight = slots[slots.length - 1]?.value;
  const reading: MetricReading<number> =
    lastNight != null
      ? loggedReading(lastNight, { coverage })
      : unloggedReading(coverage);

  const summary = buildChartSummary({
    title: "Sleep",
    rangeLabel: control.rangeLabel,
    reading,
    unit: "duration",
    goal: { value: goalMinutes, label: "Goal" },
  });

  if (days.length < 2) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <ChartFrame
        caption={`${goalLabel}+ a night ${
          isDefaultGoal ? "recommended" : "is your goal"
        }`}
        chrome={false}
        coverage={coverage}
        goalText={target.label}
        headlineLabel="last night"
        height={200}
        range={control}
        reading={reading}
        state="populated"
        summary={summary}
        title="Sleep"
        unit="duration"
      >
        <DailyBarsChart
          color={DOMAIN.sleep}
          formatAxisTick={(v) => `${Math.round(v / 60)}h`}
          formatValue={(v) => formatMinutesAsDuration(v)}
          slots={slots}
          target={target}
          tipLabel="Sleep"
          unit="duration"
          yScale={{ unit: 60, steps: [1, 2, 3, 4, 6, 12] }}
        />
      </ChartFrame>

      {/* Page-level KPI strip + Ask Chad; values follow the selected window. */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-border border-t pt-4">
        {stats && (
          <div className="flex items-end gap-6">
            <Kpi
              help="Your average across the nights you logged in this range. Nights you didn't log aren't counted."
              label="Avg / night"
              size="lg"
              value={formatMinutesAsDuration(stats.avg)}
            />
            <Kpi
              help={`How many of the nights you logged in this range hit ${
                isDefaultGoal
                  ? "the recommended 7 hours"
                  : `your ${goalLabel} goal`
              }. Nights you didn't log show as gaps in the chart and don't count against you.`}
              label={`Nights with ${goalLabel}+`}
              sub="of logged nights"
              tone={stats.hit > 0 ? "good" : "neutral"}
              value={`${stats.hit} / ${stats.logged}`}
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
