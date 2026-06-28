"use client";

/**
 * Daily nutrition trend — calories or a macro, day by day, over the diary
 * history. Built on Recharts via the shadcn chart primitive and the shared
 * dashboard chart system (ChartCard / Kpi / useChartRange), so it looks and
 * behaves like the weight tracker. Bars are each day's total; a gap-aware EMA
 * trend line smooths the daily noise; a dashed line marks the target when one
 * is set. A segmented control switches between Calories / Protein / Carbs / Fat
 * (all four are always in the scrub tooltip). Range toggle + honest "avg/day"
 * KPI over the selected window.
 */

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/dashboard/chart-card";
import { Kpi } from "@/components/dashboard/kpi";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { useChartRange } from "@/hooks/use-chart-range";
import { useMountReveal } from "@/hooks/use-mount-reveal";
import { formatTick } from "@/lib/chart/format";
import { ema } from "@/lib/chart/trend";
import type { DailyMacros } from "@/lib/nutrition/daily-macros";
import { cn } from "@/lib/utils";

type MetricKey = "calories" | "protein" | "carbs" | "fat";

const METRICS: Record<
  MetricKey,
  { label: string; short: string; unit: string; color: string }
> = {
  calories: { label: "Calories", short: "Cal", unit: "kcal", color: "#a4161a" },
  protein: { label: "Protein", short: "Protein", unit: "g", color: "#38bdf8" },
  carbs: { label: "Carbs", short: "Carbs", unit: "g", color: "#fbbf24" },
  fat: { label: "Fat", short: "Fat", unit: "g", color: "#a78bfa" },
};

const METRIC_ORDER: MetricKey[] = ["calories", "protein", "carbs", "fat"];

const ASK_CHAD_PROMPT =
  "Review my nutrition trend over the last few weeks — calories and protein day to day against my targets. What's the pattern, and what should I change?";

const chartConfig = {
  value: { label: "Daily", color: "#a4161a" },
} satisfies ChartConfig;

export type MacroTarget = {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
};

export function MacroTrendChart({
  days,
  target,
}: {
  days: DailyMacros[];
  target: MacroTarget | null;
}) {
  const [metric, setMetric] = useState<MetricKey>("calories");
  const reveal = useMountReveal();
  const { rows, control } = useChartRange(days, { minPoints: 5 });

  const meta = METRICS[metric];
  const targetValue = target?.[metric] ?? null;

  // Merge a gap-aware EMA of the selected metric into each row for the trend
  // line that rides over the daily bars.
  const data = useMemo(() => {
    const trend = ema(
      rows.map((r) => ({ t: r.t, weight: r[metric] })),
      7
    );
    return rows.map((r, i) => ({ ...r, trend: trend[i]?.trend ?? r[metric] }));
  }, [rows, metric]);

  const avg = useMemo(() => {
    if (rows.length === 0) {
      return 0;
    }
    const sum = rows.reduce((s, r) => s + r[metric], 0);
    return Math.round(sum / rows.length);
  }, [rows, metric]);

  const yMax = useMemo(() => {
    if (data.length === 0) {
      return 1;
    }
    const peak = Math.max(...data.map((r) => r[metric]), targetValue ?? 0);
    return Math.max(peak * 1.15, 1);
  }, [data, metric, targetValue]);

  if (days.length < 2) {
    return null; // page shows nothing until there's a trend to draw
  }

  const lastT = data.at(-1)?.t;

  return (
    <ChartCard
      askChadPrompt={ASK_CHAD_PROMPT}
      footer={
        targetValue != null ? (
          <span>
            Target{" "}
            <span className="font-medium text-foreground">
              {targetValue.toLocaleString()} {meta.unit}
            </span>{" "}
            · bars are each day, line is your trend
          </span>
        ) : (
          <span>Set a daily target on /today to see it on the chart.</span>
        )
      }
      kpis={
        <>
          <Kpi
            label={`Avg ${meta.label.toLowerCase()} / day`}
            size="lg"
            value={`${avg.toLocaleString()} ${meta.unit}`}
          />
          <Kpi label="Days logged" value={String(rows.length)} />
        </>
      }
      range={control}
      title="Nutrition trend"
    >
      {/* Metric switch */}
      <div className="mb-4 inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
        {METRIC_ORDER.map((key) => (
          <button
            className={cn(
              "rounded-md px-2.5 py-1 font-medium text-xs transition-colors",
              metric === key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            key={key}
            onClick={() => setMetric(key)}
            type="button"
          >
            {METRICS[key].short}
          </button>
        ))}
      </div>

      <ChartContainer className="h-[230px] w-full" config={chartConfig}>
        <ComposedChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
        >
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
            domain={[0, yMax]}
            tickCount={4}
            tickLine={false}
            tickMargin={4}
            width={40}
          />
          <ChartTooltip
            content={<MacroTooltip activeMetric={metric} />}
            cursor={{ fill: "var(--muted-foreground)", fillOpacity: 0.08 }}
          />

          {targetValue != null && (
            <ReferenceLine
              label={{
                value: `Target ${targetValue.toLocaleString()}`,
                position: "insideTopRight",
                fill: "var(--muted-foreground)",
                fontSize: 11,
              }}
              stroke="#10b981"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              y={targetValue}
            />
          )}

          <Bar
            animationDuration={750}
            animationEasing="ease-out"
            dataKey={metric}
            isAnimationActive={reveal}
            maxBarSize={34}
            radius={[3, 3, 0, 0]}
          >
            {data.map((r) => (
              <Cell
                fill={meta.color}
                fillOpacity={r.t === lastT ? 0.85 : 0.32}
                key={r.t}
              />
            ))}
          </Bar>
          <Line
            animationDuration={750}
            animationEasing="ease-out"
            dataKey="trend"
            dot={false}
            isAnimationActive={reveal}
            stroke={meta.color}
            strokeWidth={2.5}
            type="monotone"
          />
        </ComposedChart>
      </ChartContainer>
    </ChartCard>
  );
}

function MacroTooltip({
  active,
  payload,
  activeMetric,
}: {
  active?: boolean;
  payload?: { payload?: DailyMacros }[];
  activeMetric: MetricKey;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  return (
    <div className="min-w-[12rem] rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <div className="mb-1.5 font-medium">{formatTick(row.t)}</div>
      <div className="flex flex-col gap-1">
        {METRIC_ORDER.map((key) => {
          const m = METRICS[key];
          return (
            <div className="flex items-center gap-4" key={key}>
              <div className="flex items-center gap-1.5">
                <span
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: m.color }}
                />
                <span
                  className={cn(
                    "text-muted-foreground",
                    key === activeMetric && "font-medium text-foreground"
                  )}
                >
                  {m.label}
                </span>
              </div>
              <span className="ml-auto font-medium text-foreground tabular-nums">
                {row[key].toLocaleString()} {m.unit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
