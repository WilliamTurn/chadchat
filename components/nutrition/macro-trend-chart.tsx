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

import Link from "next/link";
import { useMemo } from "react";
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
import { ChartTip } from "@/components/dashboard/chart-tip";
import { Kpi } from "@/components/dashboard/kpi";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { useUrlChartRange } from "@/hooks/use-url-chart-range";
import { useUrlParam } from "@/hooks/use-url-state";
import { useMountReveal } from "@/hooks/use-mount-reveal";
import { enumParam } from "@/lib/url-state";
import { formatTick, niceScale } from "@/lib/chart/format";
import { GOAL_EMERALD, MACRO } from "@/lib/chart/palette";
import { ema } from "@/lib/chart/trend";
import type { DailyMacros } from "@/lib/nutrition/daily-macros";
import { cn } from "@/lib/utils";

type MetricKey = "calories" | "protein" | "carbs" | "fat";

// Series colors come from the governed palette (VF-7): calories draw in the
// amber nutrition accent, not blood — a red calorie bar read as "over/danger"
// on a perfectly on-target day.
const METRICS: Record<
  MetricKey,
  { label: string; short: string; unit: string; color: string }
> = {
  calories: {
    label: "Calories",
    short: "Cal",
    unit: "cal",
    color: MACRO.calories,
  },
  protein: {
    label: "Protein",
    short: "Protein",
    unit: "g",
    color: MACRO.protein,
  },
  carbs: { label: "Carbs", short: "Carbs", unit: "g", color: MACRO.carbs },
  fat: { label: "Fat", short: "Fat", unit: "g", color: MACRO.fat },
};

const METRIC_ORDER: MetricKey[] = ["calories", "protein", "carbs", "fat"];

// `?metric=` grammar (FIX-03): calories is the default and stays out of the
// URL; invalid values fall back to it.
const METRIC_PARAM = enumParam<MetricKey>(METRIC_ORDER, "calories");

const ASK_CHAD_PROMPT =
  "Review my nutrition trend chart: daily calories and protein against my targets over the last few weeks, not just today. What's the pattern, and what should I change?";

const chartConfig = {
  value: { label: "Daily", color: MACRO.calories },
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
  // URL-synced (FIX-03): `?metric=` + `?range=` restore across back/forward
  // and deep links. This chart mounts only on /nutrition, which owns them.
  const [metric, setMetric] = useUrlParam("metric", METRIC_PARAM);
  const reveal = useMountReveal();
  const { rows, control } = useUrlChartRange(days, { minPoints: 5 });

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

  // Round ascending y-ticks (VF-1, now the shared VF-8 helper): peak includes
  // the target so its line always sits inside the domain.
  const { max: yMax, ticks: yTicks } = useMemo(
    () =>
      niceScale(Math.max(1, ...data.map((r) => r[metric]), targetValue ?? 0)),
    [data, metric, targetValue]
  );

  if (days.length < 2) {
    return null; // page shows nothing until there's a trend to draw
  }

  const lastT = data.at(-1)?.t;
  // Two points can't carry a smoothed trend: a line through both just
  // re-draws the bars edge-to-edge and reads as fake precision (VF-1).
  const showTrendLine = rows.length >= 3;

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
            ·{" "}
            {showTrendLine
              ? "bars are each day, line is your trend"
              : "bars are each day"}
          </span>
        ) : (
          <span>
            Set a daily target on{" "}
            <Link
              className="font-medium text-foreground underline-offset-4 hover:underline"
              href="/today"
            >
              /today
            </Link>{" "}
            to see it on the chart.
          </span>
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
      {/* Metric switch — min-h-9 keeps each chip a real touch target on
          phones (the 25px-tall chips were easy to mis-tap). */}
      <div className="mb-4 inline-flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
        {METRIC_ORDER.map((key) => (
          <button
            className={cn(
              "min-h-9 rounded-md px-3 py-1.5 font-medium text-xs transition-colors",
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
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
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
            tickFormatter={(v: number) => v.toLocaleString()}
            tickLine={false}
            tickMargin={4}
            ticks={yTicks}
            width={46}
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
              stroke={GOAL_EMERALD}
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
          {showTrendLine && (
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
          )}
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
    <ChartTip
      rows={METRIC_ORDER.map((key) => ({
        color: METRICS[key].color,
        em: key === activeMetric,
        label: METRICS[key].label,
        value: `${row[key].toLocaleString()} ${METRICS[key].unit}`,
      }))}
      t={row.t}
    />
  );
}
