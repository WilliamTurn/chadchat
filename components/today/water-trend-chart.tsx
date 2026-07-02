"use client";

/**
 * Daily hydration trend (the /hydration detail page) — each bar is one day's
 * total water intake, oldest → newest, with a dashed goal line and a scrub
 * tooltip. Built on Recharts via the shadcn chart primitive and the shared
 * dashboard chart system (ChartCard / Kpi / useChartRange), so it matches the
 * weight and volume trends. Days that hit the goal are drawn in full-strength
 * sky; misses are faded.
 *
 * Honest axis (audit P2-5): unlogged days render as empty slots instead of
 * silently vanishing — the series is gap-filled per calendar day, so "days hit
 * goal" counts every real day in the window, misses included.
 */

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { useChartRange } from "@/hooks/use-chart-range";
import { useMountReveal } from "@/hooks/use-mount-reveal";
import { formatTick, niceScale } from "@/lib/chart/format";
import { DOMAIN } from "@/lib/chart/palette";
import { fillDailyGaps } from "@/lib/chart/trend";
import {
  DEFAULT_WATER_GOAL_ML,
  formatOz,
  formatOzAxis,
  formatVolume,
  ML_PER_OZ,
} from "@/lib/today/water-units";

const SKY = DOMAIN.hydration;

const ASK_CHAD_PROMPT =
  "Look at my water intake over the last couple of weeks. Am I hitting my hydration goal consistently, and what would help me stay on top of it?";

const chartConfig = {
  ml: { label: "Water", color: SKY },
} satisfies ChartConfig;

type Point = { t: number; ml: number };
type Row = Point & { logged: boolean };

export function WaterTrendChart({
  days,
  goalMl = DEFAULT_WATER_GOAL_ML,
}: {
  days: Point[];
  goalMl?: number;
}) {
  const safeGoal = goalMl > 0 ? goalMl : DEFAULT_WATER_GOAL_ML;
  const reveal = useMountReveal();

  // Gap-fill unlogged days so the date axis stays honest (bars are evenly
  // spaced bands — without the fill, missing days silently vanish).
  const filled = useMemo<Row[]>(
    () =>
      fillDailyGaps<Row>(
        days.map((d) => ({ ...d, logged: true })),
        (t) => ({ t, ml: 0, logged: false })
      ),
    [days]
  );
  const { rows, control } = useChartRange(filled, { minPoints: 7 });

  const stats = useMemo(() => {
    const loggedRows = rows.filter((r) => r.logged);
    if (loggedRows.length === 0) {
      return null;
    }
    const sum = loggedRows.reduce((s, r) => s + r.ml, 0);
    const avg = Math.round(sum / loggedRows.length);
    const hit = loggedRows.filter((r) => r.ml >= safeGoal).length;
    // Denominator = every day in the window, unlogged included.
    return { avg, hit, total: rows.length };
  }, [rows, safeGoal]);

  // Round ascending ticks in the DISPLAY unit (VF-8): data is stored in ml but
  // the axis reads in oz, so the steps are whole ounces, never a raw ml max.
  const { max: yMax, ticks: yTicks } = useMemo(
    () =>
      niceScale(Math.max(...rows.map((r) => r.ml), safeGoal), {
        unit: ML_PER_OZ,
      }),
    [rows, safeGoal]
  );

  if (days.length < 2) {
    return null;
  }

  return (
    <ChartCard
      askChadPrompt={ASK_CHAD_PROMPT}
      footer={
        <span>
          Goal{" "}
          <span className="font-medium text-sky-400">
            {formatVolume(safeGoal)}
          </span>{" "}
          a day · each bar is one day's total · gaps are unlogged days
        </span>
      }
      kpis={
        stats && (
          <>
            <Kpi label="Avg / day" size="lg" value={formatOz(stats.avg)} />
            <Kpi
              label="Days hit goal"
              tone={stats.hit > 0 ? "good" : "neutral"}
              value={`${stats.hit} / ${stats.total}`}
            />
          </>
        )
      }
      range={control}
      title="Hydration trend"
    >
      <ChartContainer className="h-[200px] w-full" config={chartConfig}>
        <BarChart
          data={rows}
          margin={{ top: 8, right: 8, bottom: 0, left: -8 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="t"
            minTickGap={32}
            tickFormatter={formatTick}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            axisLine={false}
            domain={[0, yMax]}
            tickFormatter={formatOzAxis}
            tickLine={false}
            tickMargin={4}
            ticks={yTicks}
            width={56}
          />
          <ChartTooltip
            content={<WaterTooltip goalMl={safeGoal} />}
            cursor={{ fill: "var(--muted-foreground)", fillOpacity: 0.08 }}
          />
          <ReferenceLine
            stroke={SKY}
            strokeDasharray="5 4"
            strokeOpacity={0.7}
            strokeWidth={1.5}
            y={safeGoal}
          />
          <Bar
            animationDuration={750}
            animationEasing="ease-out"
            dataKey="ml"
            isAnimationActive={reveal}
            maxBarSize={34}
            radius={[3, 3, 0, 0]}
          >
            {rows.map((r) => (
              <Cell
                fill={SKY}
                fillOpacity={r.logged ? (r.ml >= safeGoal ? 0.9 : 0.35) : 0}
                key={r.t}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

function WaterTooltip({
  active,
  payload,
  goalMl,
}: {
  active?: boolean;
  payload?: { payload?: Row }[];
  goalMl: number;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  const hit = row.ml >= goalMl;
  const pctOfGoal = goalMl > 0 ? Math.round((row.ml / goalMl) * 100) : 0;
  return (
    <ChartTip
      rows={
        row.logged
          ? [{ color: SKY, label: "Water", value: formatOz(row.ml) }]
          : []
      }
      t={row.t}
    >
      {row.logged ? (
        <div className="mt-1 flex items-center justify-between gap-4 text-muted-foreground">
          <span>{pctOfGoal}% of goal</span>
          <span className={hit ? "font-medium text-emerald-500" : ""}>
            {hit ? "goal hit" : `${formatOz(Math.max(0, goalMl - row.ml))} short`}
          </span>
        </div>
      ) : (
        <div className="text-muted-foreground">Not logged</div>
      )}
    </ChartTip>
  );
}
