"use client";

/**
 * Training-volume trend, migrated onto the P2 chart system (FIX-33; queued
 * since P2-Z). ChartFrame carries the grammar (title, headline via units.ts,
 * range, coverage, text summary, designed states); the plot is the shared
 * TrendChart: raw per-day volume dots under a gap-aware smoothed trend on a
 * WINDOW-spanning axis (DSH-60), the filled-trend form the benchmark
 * teardown ranked over bar walls (TrainingPeaks fitness curve;
 * evidence-p56b/benchmark-teardown.md section 2c).
 *
 * URL state (FIX-03, preserved from P34-B): `?range=` presets AND the
 * DSH-52 custom from/to window restore across back/forward and deep links,
 * via useUrlChartRange + the exported RangeToggle in the frame's rangeSlot.
 * This chart mounts only on /workouts, which owns the param.
 */

import { useMemo } from "react";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { ChartFrame } from "@/components/charts/chart-frame";
import { TrendChart, trendChartLegend } from "@/components/charts/trend-chart";
import { RangeToggle } from "@/components/dashboard/chart-card";
import { useUrlChartRange } from "@/hooks/use-url-chart-range";
import { buildChartSummary } from "@/lib/chart/summary";
import { formatShortDate } from "@/lib/chart/format";
import { MS_PER_DAY } from "@/lib/chart/trend";
import {
  type ChartWindow,
  clampToWindow,
  windowEndingAt,
  windowFromExtent,
} from "@/lib/chart/window";
import type { Coverage } from "@/lib/contracts/data-state";
import { loggedReading, unloggedReading } from "@/lib/contracts/data-state";
import { formatQuantity } from "@/lib/contracts/units";

const ASK_CHAD_PROMPT =
  "Look at my training volume trend chart: total weight moved per workout over time. Am I progressively overloading, stalling, or backing off, and what should I do about it?";

const RANGE_DAYS: Record<string, number> = {
  "1w": 7,
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
};

type Point = { t: number; volume: number };

/** UTC anchor of today, the fallback when no member anchor is threaded. */
function utcTodayAnchorMs(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

export function VolumeChart({
  points,
  todayMs,
}: {
  /** Daily volume (lb), member-local day anchors, oldest first
   *  (training.volume.dailyTrend). */
  points: Point[];
  /** 00:00-UTC anchor of the member-local today (window math, DSH-60). */
  todayMs?: number;
}) {
  const endDayMs = todayMs ?? utcTodayAnchorMs();

  // URL-synced range STATE (presets + the DSH-52 custom window); the drawn
  // window derives from lib/chart/window.ts so the axis spans the window.
  const { control } = useUrlChartRange(points, { minPoints: 6 });

  const window = useMemo<ChartWindow>(() => {
    if (control.range === "custom" && control.custom) {
      const { from, to } = control.custom;
      return {
        startMs: from,
        endMs: to,
        days: Math.max(1, Math.round((to - from) / MS_PER_DAY)),
      };
    }
    const days = RANGE_DAYS[control.range];
    if (days != null) {
      return windowEndingAt(endDayMs, days);
    }
    return windowFromExtent(points, endDayMs);
  }, [control.range, control.custom, points, endDayMs]);

  const windowPoints = useMemo(
    () => clampToWindow(points, window),
    [points, window]
  );

  const coverage = useMemo<Coverage>(() => {
    const spanDays =
      windowPoints.length >= 2
        ? Math.round(
            (windowPoints[windowPoints.length - 1].t - windowPoints[0].t) /
              MS_PER_DAY
          )
        : 0;
    return {
      loggedDays: windowPoints.length,
      windowDays: window.days,
      points: windowPoints.length,
      spanDays,
    };
  }, [windowPoints, window]);

  const latest = windowPoints.at(-1) ?? null;
  const top = useMemo(
    () =>
      windowPoints.reduce<Point | null>(
        (best, p) => (best === null || p.volume > best.volume ? p : best),
        null
      ),
    [windowPoints]
  );

  const reading =
    latest === null
      ? unloggedReading(coverage)
      : loggedReading(latest.volume, {
          coverage,
          ageDays: Math.max(0, Math.round((endDayMs - latest.t) / MS_PER_DAY)),
        });

  const state =
    points.length === 0
      ? "empty"
      : windowPoints.length < 3
        ? "sparse"
        : "populated";

  const summary = buildChartSummary({
    title: "Training volume",
    rangeLabel: rangePhrase(control.range, window),
    reading,
    unit: "lb",
    extra:
      top !== null
        ? [
            `Biggest day ${formatQuantity(top.volume, "lb")} on ${formatShortDate(top.t)}`,
          ]
        : [],
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <AskChadButton prompt={ASK_CHAD_PROMPT} />
      </div>
      <ChartFrame
        caption={
          top !== null && state === "populated"
            ? `Biggest day ${formatQuantity(top.volume, "lb")} · ${formatShortDate(top.t)}`
            : undefined
        }
        coverage={coverage}
        emptyMessage="Finish a workout with weights logged and your volume trend starts here."
        headlineLabel="Latest logged day"
        height={240}
        legend={trendChartLegend(
          "neutral",
          { raw: "Daily volume", trend: "Trend (smoothed)" },
          // RC-3 (TRN-21): the volume trend is progress toward heavier
          // training, not a warning; emerald, not blood.
          "var(--progress)"
        )}
        rangeSlot={<RangeToggle {...control} />}
        reading={reading}
        state={state}
        summary={summary}
        title="Training volume"
        unit="lb"
      >
        {windowPoints.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl bg-surface-inset px-6 text-center">
            <p className="text-body text-muted-foreground">
              No workouts in this date range. Pick a wider window to see the
              trend.
            </p>
          </div>
        ) : (
          <TrendChart
            color="var(--progress)"
            points={points.map((p) => ({ t: p.t, value: p.volume }))}
            rawLabel="Daily volume"
            tone="neutral"
            trendLabel="Trend"
            unit="lb"
            window={window}
          />
        )}
      </ChartFrame>
    </div>
  );
}

/** Member phrase for the active range ("last 30 days" / a custom span). */
function rangePhrase(range: string, w: ChartWindow): string {
  switch (range) {
    case "1w":
      return "last 7 days";
    case "1m":
      return "last 30 days";
    case "3m":
      return "last 3 months";
    case "6m":
      return "last 6 months";
    case "1y":
      return "last year";
    case "custom":
      return `${formatShortDate(w.startMs)} to ${formatShortDate(w.endMs)}`;
    default:
      return "all time";
  }
}
