"use client";

/**
 * TREND CHART (FIX-18): the "progress toward goal" chart type from audit doc
 * 05. Faint raw readings under a bold smoothed trend line (gap-aware EMA,
 * lib/chart/trend.ts), an emerald dashed goal reference, and a scrub tooltip.
 * The MacroFactor raw-under-trend treatment on a window-spanning axis.
 *
 * Axis law (DSH-60): the x-domain and ticks come from the ChartWindow, never
 * from the data extent. One weigh-in inside a 30-day window renders as one
 * dot at its true date on a full 30-day axis.
 *
 * Estimated-series law: the trend is a derived series; when both series draw,
 * the caller renders the legend via `trendChartLegend` so raw vs derived is
 * always distinguishable and labeled.
 */

import { useId, useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTip } from "@/components/dashboard/chart-tip";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { useMountReveal } from "@/hooks/use-mount-reveal";
import { formatTick, formatWeekdayTick } from "@/lib/chart/format";
import { TREND_TONE, type TrendTone } from "@/lib/chart/palette";
import { ema, type TrendRow } from "@/lib/chart/trend";
import {
  type ChartWindow,
  clampToWindow,
  windowTicks,
} from "@/lib/chart/window";
import { formatQuantity, type UnitId } from "@/lib/contracts/units";
import type { ChartLegendItem } from "./chart-frame";

const RAW_COLOR = "var(--muted-foreground)";

/**
 * Compact y ticks: 4-5 digit values ("54632") overflow the 40px axis gutter
 * and clip to misleading fragments ("546"); large quantities abbreviate the
 * category-standard way ("55k") instead. Values under 1,000 (weight, sleep
 * hours) render unchanged.
 */
function formatCompactTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 10_000) {
    return `${Math.round(value / 1000)}k`;
  }
  if (abs >= 1_000) {
    return `${Math.round(value / 100) / 10}k`;
  }
  return String(value);
}

/**
 * Tokenized direction glow for the trend line (additive, P56-A; the owner's
 * reward-glow direction). Derived from the same TREND_TONE tokens as the
 * stroke via color-mix, so the glow can never disagree with the line color.
 */
const TREND_GLOW: Record<TrendTone, string> = {
  toward:
    "[filter:drop-shadow(0_0_6px_color-mix(in_oklab,var(--chart-2)_45%,transparent))]",
  away: "[filter:drop-shadow(0_0_6px_color-mix(in_oklab,var(--chart-5)_55%,transparent))]",
  neutral:
    "[filter:drop-shadow(0_0_6px_color-mix(in_oklab,var(--chart-neutral)_35%,transparent))]",
};

/** The frame legend for a raw + trend drawing (estimated-series law).
 *  `color` mirrors the TrendChart color override (domain-accent charts). */
export function trendChartLegend(
  tone: TrendTone,
  labels: { raw: string; trend: string; goal?: string },
  color?: string
): ChartLegendItem[] {
  const items: ChartLegendItem[] = [
    { swatch: "dot", color: RAW_COLOR, label: labels.raw },
    { swatch: "line", color: color ?? TREND_TONE[tone], label: labels.trend },
  ];
  if (labels.goal) {
    items.push({ swatch: "dash", color: "var(--color-goal-line)", label: labels.goal });
  }
  return items;
}

export function TrendChart({
  points,
  window: w,
  unit,
  goal,
  tone = "neutral",
  rawLabel = "Logged",
  trendLabel = "Trend",
  compact = false,
  glow = false,
  color,
  tau = 10,
}: {
  /** FULL history, oldest first ({t, value}); smoothing never restarts at a
   *  window edge, the window only crops what is drawn. */
  points: readonly { t: number; value: number }[];
  window: ChartWindow;
  unit: UnitId;
  goal?: { value: number; label: string } | null;
  /** Direction verdict for the drawn window; colors the trend (DSH-50). */
  tone?: TrendTone;
  rawLabel?: string;
  trendLabel?: string;
  compact?: boolean;
  /** Tone-matched drop-shadow on the trend line (reward-glow moments). */
  glow?: boolean;
  /**
   * Line-color override for DOMAIN-ACCENT charts (Color Law rule 1: a
   * training-domain series draws in the domain accent, e.g. volume in
   * blood), where the verdict tones do not apply. Pass the matching value
   * to trendChartLegend so line and legend cannot disagree.
   */
  color?: string;
  tau?: number;
}) {
  const reveal = useMountReveal();
  const gradientId = useId();
  const lineColor = color ?? TREND_TONE[tone];

  const rows = useMemo<TrendRow[]>(
    () =>
      clampToWindow(
        ema(
          points.map((p) => ({ t: p.t, weight: p.value })),
          tau
        ),
        w
      ),
    [points, tau, w]
  );

  const ticks = useMemo(
    () => windowTicks(w, compact ? 4 : 6),
    [w, compact]
  );
  const tickFormatter = w.days <= 14 ? formatWeekdayTick : formatTick;

  const yDomain = useMemo<[number, number]>(() => {
    const vals = rows.flatMap((r) => [r.weight, r.trend]);
    if (goal) {
      vals.push(goal.value);
    }
    if (vals.length === 0) {
      return [0, 1];
    }
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const spread = max - min;
    const pad = spread > 0 ? spread * 0.15 : Math.max(max * 0.02, 1);
    // Never pad below zero for all-positive data: a volume/weight axis
    // reading "-1.1K lb" is nonsense (flaws TRN-26).
    const lo = min >= 0 ? Math.max(0, Math.floor(min - pad)) : Math.floor(min - pad);
    return [lo, Math.ceil(max + pad)];
  }, [rows, goal]);

  const chartConfig = {
    trend: { label: trendLabel, color: lineColor },
    weight: { label: rawLabel, color: RAW_COLOR },
  } satisfies ChartConfig;

  // Sparse windows draw visible trend dots so a 1-to-3 point window reads as
  // real observations at true dates, never an accidental-looking fragment.
  const sparseDots = rows.length <= 4;

  return (
    <ChartContainer className="h-full w-full" config={chartConfig}>
      <ComposedChart
        data={rows}
        margin={{ top: 8, left: 12, bottom: 0, right: -8 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.16} />
            <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" vertical={false} />

        <XAxis
          axisLine={false}
          dataKey="t"
          domain={[w.startMs, w.endMs]}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          scale="time"
          tickFormatter={tickFormatter}
          tickLine={false}
          tickMargin={8}
          ticks={ticks}
          type="number"
        />
        {/* Right-aligned sparse axis: the MacroFactor/Linear convention, and
            the scale sits nearest the newest data. */}
        <YAxis
          axisLine={false}
          domain={yDomain}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          orientation="right"
          tickCount={compact ? 3 : 4}
          tickFormatter={formatCompactTick}
          tickLine={false}
          tickMargin={4}
          width={40}
        />

        <ChartTooltip
          content={
            <TrendTooltip
              rawLabel={rawLabel}
              trendColor={lineColor}
              trendLabel={trendLabel}
              unit={unit}
            />
          }
          cursor={{
            stroke: "var(--muted-foreground)",
            strokeDasharray: "4 4",
            strokeWidth: 1,
          }}
        />

        {/* Unlabeled goal line (MacroFactor convention): the ChartFrame header
            states "Goal 180 lb" and the legend carries the dash chip, so an
            inline label never collides with data near the target. */}
        {goal && (
          <ReferenceLine
            stroke="var(--color-goal-line)"
            strokeDasharray="5 4"
            strokeWidth={2}
            y={goal.value}
          />
        )}

        {/* Faint raw readings, underneath the trend. */}
        <Line
          activeDot={{ r: 4, fill: RAW_COLOR, strokeWidth: 0 }}
          animationDuration={750}
          animationEasing="ease-out"
          dataKey="weight"
          dot={{ r: 2, fillOpacity: 0.5, strokeWidth: 0 }}
          isAnimationActive={reveal}
          stroke={RAW_COLOR}
          strokeOpacity={0.3}
          strokeWidth={1}
          type="monotone"
        />

        {/* The headline smoothed trend, on top. */}
        <Area
          activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
          animationDuration={750}
          animationEasing="ease-out"
          className={glow ? TREND_GLOW[tone] : undefined}
          dataKey="trend"
          dot={sparseDots ? { r: 3, fill: lineColor, strokeWidth: 0 } : false}
          fill={`url(#${gradientId})`}
          isAnimationActive={reveal}
          stroke={lineColor}
          strokeWidth={2.5}
          type="monotone"
        />
      </ComposedChart>
    </ChartContainer>
  );
}

function TrendTooltip({
  active,
  payload,
  unit,
  trendColor,
  rawLabel,
  trendLabel,
}: {
  active?: boolean;
  payload?: { payload?: TrendRow }[];
  unit: UnitId;
  trendColor: string;
  rawLabel: string;
  trendLabel: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  return (
    <ChartTip
      rows={[
        {
          color: RAW_COLOR,
          label: rawLabel,
          value: formatQuantity(row.weight, unit),
        },
        {
          color: trendColor,
          label: trendLabel,
          value: formatQuantity(row.trend, unit),
        },
      ]}
      t={row.t}
    />
  );
}
