"use client";

/**
 * Interactive estimated-1RM trend for a single exercise. Built on Recharts via
 * the shadcn chart primitive + the shared `lib/chart` formatters — the same
 * engine as the weight tracker — so strength history scrubs and reads like the
 * rest of the dashboards. Each point is one session's best estimated 1RM (lb),
 * oldest → newest; hover/scrub any session for its date and value, with the
 * latest value labelled on the line.
 *
 * Rendered inside the Personal-records drill-down panel, which already owns the
 * card chrome and title — so this is the chart only, no ChartCard wrapper (no
 * double chrome). Strength is a step-function of PRs, not a noisy daily signal,
 * so we plot the raw session values (no EMA smoothing).
 */

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  ReferenceDot,
  XAxis,
  YAxis,
} from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { useMountReveal } from "@/hooks/use-mount-reveal";
import { formatTick } from "@/lib/chart/format";

const ACCENT = "#a4161a"; // brand blood red

const chartConfig = {
  value: { label: "Est. 1RM", color: ACCENT },
} satisfies ChartConfig;

type Point = { t: number; value: number };

export function ExerciseTrendChart({
  points,
  unit = "lb",
}: {
  points: Point[];
  unit?: string;
}) {
  const reveal = useMountReveal();
  const yDomain = useMemo<[number, number]>(() => {
    if (points.length === 0) {
      return [0, 1];
    }
    const vs = points.map((p) => p.value);
    const min = Math.min(...vs);
    const max = Math.max(...vs);
    const spread = max - min;
    const pad = spread > 0 ? spread * 0.15 : Math.max(max * 0.05, 1);
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [points]);

  if (points.length === 0) {
    return null;
  }

  const latest = points.at(-1);

  return (
    <ChartContainer className="h-[220px] w-full" config={chartConfig}>
      <ComposedChart
        data={points}
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
          domain={["dataMin", "dataMax"]}
          minTickGap={32}
          scale="time"
          tickFormatter={formatTick}
          tickLine={false}
          tickMargin={8}
          type="number"
        />
        <YAxis
          axisLine={false}
          domain={yDomain}
          tickCount={5}
          tickLine={false}
          tickMargin={4}
          width={40}
        />

        <ChartTooltip
          content={<OneRmTooltip unit={unit} />}
          cursor={{
            stroke: "var(--muted-foreground)",
            strokeDasharray: "4 4",
            strokeWidth: 1,
          }}
        />

        <Area
          activeDot={{ r: 5, fill: ACCENT, stroke: "var(--background)", strokeWidth: 1.5 }}
          animationDuration={750}
          animationEasing="ease-out"
          dataKey="value"
          dot={{ r: 3, fill: ACCENT, stroke: "var(--background)", strokeWidth: 1 }}
          fill="url(#oneRmTrendFill)"
          isAnimationActive={reveal}
          stroke={ACCENT}
          strokeWidth={2.5}
          type="monotone"
        />

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
}: {
  active?: boolean;
  payload?: { payload?: Point }[];
  unit: string;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  return (
    <div className="min-w-[10rem] rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <div className="mb-1.5 font-medium">{formatTick(row.t)}</div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-[2px]"
            style={{ backgroundColor: ACCENT }}
          />
          <span className="text-muted-foreground">Est. 1RM</span>
        </div>
        <span className="ml-auto font-medium text-foreground tabular-nums">
          {row.value} {unit}
        </span>
      </div>
    </div>
  );
}
