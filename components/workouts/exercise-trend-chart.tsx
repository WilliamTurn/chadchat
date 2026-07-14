"use client";

/**
 * Estimated-1RM trend for a single exercise, migrated onto the P2 chart
 * system (FIX-33; queued since P2-Z). The x-axis spans the WINDOW, never
 * just the data extent (DSH-60), and sessions that set a record draw a GOLD
 * DOT on the line: the record rendered as a moment in time (the Strava
 * gold-dot pattern; evidence-p56b/benchmark-teardown.md section 2d).
 *
 * Rendered inside a caller-owned ChartFrame (compact embed) or panel that
 * carries title/headline/summary, so this is the plot only. Strength is a
 * step-function of PRs, not a noisy daily signal, so raw session values are
 * plotted without smoothing.
 */

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceDot,
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
import { DOMAIN } from "@/lib/chart/palette";
import {
  type ChartWindow,
  clampToWindow,
  windowFromExtent,
  windowTicks,
} from "@/lib/chart/window";

const ACCENT = DOMAIN.training; // brand blood red (VF-7: the brand domain)
const PR_GOLD = "var(--chart-3)"; // amber: the record marker hue

const chartConfig = {
  value: { label: "Est. 1RM", color: ACCENT },
} satisfies ChartConfig;

type Point = { t: number; value: number };

export function ExerciseTrendChart({
  points,
  window: windowProp,
  unit = "lb",
  target,
  prTs = [],
}: {
  /** Per-session best est-1RM, oldest first ({t, value}). */
  points: Point[];
  /** The selected window; the axis spans it (DSH-60). Omitted (the goal-card
   *  embeds), the window is the full data extent, still axis-spanning. */
  window?: ChartWindow;
  unit?: string;
  /** Optional goal line (e.g. a lift-goal target 1RM), drawn dashed. */
  target?: number | null;
  /** Session timestamps that set an est-1RM record (gold-dot markers). */
  prTs?: number[];
}) {
  const reveal = useMountReveal();

  const w = useMemo<ChartWindow>(
    () =>
      windowProp ??
      windowFromExtent(points, Math.max(...points.map((p) => p.t), 0)),
    [windowProp, points]
  );
  const rows = useMemo(() => clampToWindow(points, w), [points, w]);
  const prSet = useMemo(() => new Set(prTs), [prTs]);

  const ticks = useMemo(() => windowTicks(w, 5), [w]);
  const tickFormatter = w.days <= 14 ? formatWeekdayTick : formatTick;

  const yDomain = useMemo<[number, number]>(() => {
    if (rows.length === 0) {
      return [0, 1];
    }
    // Include the target so its line is always in view, even before the client
    // is anywhere near it.
    const vs = rows.map((p) => p.value);
    if (target != null) {
      vs.push(target);
    }
    const min = Math.min(...vs);
    const max = Math.max(...vs);
    const spread = max - min;
    const pad = spread > 0 ? spread * 0.15 : Math.max(max * 0.05, 1);
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [rows, target]);

  if (rows.length === 0) {
    return null;
  }

  const latest = rows.at(-1);
  const sparseDots = rows.length <= 4;

  return (
    <ChartContainer className="h-full w-full" config={chartConfig}>
      <ComposedChart
        data={rows}
        margin={{ top: 16, right: 16, bottom: 0, left: -8 }}
      >
        <defs>
          <linearGradient id="oneRmTrendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.18} />
            <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
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
        <YAxis
          axisLine={false}
          domain={yDomain}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          orientation="right"
          tickCount={5}
          tickLine={false}
          tickMargin={4}
          width={40}
        />

        <ChartTooltip
          content={<OneRmTooltip prSet={prSet} unit={unit} />}
          cursor={{
            stroke: "var(--muted-foreground)",
            strokeDasharray: "4 4",
            strokeWidth: 1,
          }}
        />

        {/* Unlabeled goal line (MacroFactor convention): the surrounding
            frame states the goal in text. */}
        {target != null && (
          <ReferenceLine
            stroke="var(--color-goal-line)"
            strokeDasharray="5 5"
            strokeWidth={2}
            y={target}
          />
        )}

        <Area
          activeDot={{ r: 5, fill: ACCENT, stroke: "var(--background)", strokeWidth: 1.5 }}
          animationDuration={750}
          animationEasing="ease-out"
          dataKey="value"
          dot={
            sparseDots
              ? { r: 3, fill: ACCENT, stroke: "var(--background)", strokeWidth: 1 }
              : false
          }
          fill="url(#oneRmTrendFill)"
          isAnimationActive={reveal}
          stroke={ACCENT}
          strokeWidth={2.5}
          type="monotone"
        />

        {/* Gold dots: the sessions that set a new estimated-1RM record. */}
        {rows
          .filter((p) => prSet.has(p.t))
          .map((p) => (
            <ReferenceDot
              fill={PR_GOLD}
              key={`pr-${p.t}`}
              r={4.5}
              stroke="var(--background)"
              strokeWidth={1.5}
              x={p.t}
              y={p.value}
            />
          ))}

        {latest && (
          <ReferenceDot
            fill={ACCENT}
            label={{
              value: `${latest.value} ${unit}`,
              position: "top",
              fill: "var(--foreground)",
              fontSize: 13,
              fontWeight: 600,
            }}
            r={4.5}
            stroke="var(--background)"
            strokeWidth={1.5}
            x={latest.t}
            y={latest.value}
          />
        )}
      </ComposedChart>
    </ChartContainer>
  );
}

function OneRmTooltip({
  active,
  payload,
  unit,
  prSet,
}: {
  active?: boolean;
  payload?: { payload?: Point }[];
  unit: string;
  prSet: Set<number>;
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
          color: prSet.has(row.t) ? "var(--chart-3)" : ACCENT,
          label: prSet.has(row.t) ? "Est. 1RM · new record" : "Est. 1RM",
          value: `${row.value} ${unit}`,
        },
      ]}
      t={row.t}
    />
  );
}
