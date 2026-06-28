"use client";

/**
 * Daily hydration trend — each bar is one day's total water intake, oldest →
 * newest, with a dashed goal line and a scrub tooltip. Built on Recharts via the
 * shadcn chart primitive and the shared dashboard chart system (ChartCard / Kpi
 * / useChartRange), so it matches the weight and volume trends. Days that hit
 * the goal are drawn in full-strength sky; misses are faded. KPIs report the
 * average per day and how many days hit the goal over the selected range.
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
import { Kpi } from "@/components/dashboard/kpi";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { useChartRange } from "@/hooks/use-chart-range";
import { useMountReveal } from "@/hooks/use-mount-reveal";
import { formatTick } from "@/lib/chart/format";

const SKY = "#0ea5e9";
const GLASS_ML = 250;

const ASK_CHAD_PROMPT =
  "Look at my water intake over the last couple of weeks. Am I hitting my hydration goal consistently, and what would help me stay on top of it?";

const chartConfig = {
  ml: { label: "Water", color: SKY },
} satisfies ChartConfig;

type Point = { t: number; ml: number };

/** "1.25 L" / "750 ml". */
function formatMl(ml: number): string {
  if (ml >= 1000) {
    const liters = ml / 1000;
    const text = liters.toFixed(ml % 1000 === 0 ? 0 : 2).replace(/\.?0+$/, "");
    return `${text} L`;
  }
  return `${Math.round(ml)} ml`;
}

/** Compact axis number in litres, e.g. "1.5L". */
function fmtAxis(ml: number): string {
  return `${Math.round(ml / 100) / 10}L`;
}

export function WaterTrendChart({
  days,
  goalMl = 2000,
}: {
  days: Point[];
  goalMl?: number;
}) {
  const safeGoal = goalMl > 0 ? goalMl : 2000;
  const reveal = useMountReveal();
  const { rows, control } = useChartRange(days, { minPoints: 7 });

  const stats = useMemo(() => {
    if (rows.length === 0) {
      return null;
    }
    const sum = rows.reduce((s, r) => s + r.ml, 0);
    const avg = Math.round(sum / rows.length);
    const hit = rows.filter((r) => r.ml >= safeGoal).length;
    return { avg, hit, total: rows.length };
  }, [rows, safeGoal]);

  const yMax = useMemo(() => {
    if (rows.length === 0) {
      return safeGoal * 1.15;
    }
    return Math.max(...rows.map((r) => r.ml), safeGoal) * 1.15;
  }, [rows, safeGoal]);

  if (days.length < 2) {
    return null;
  }

  return (
    <ChartCard
      askChadPrompt={ASK_CHAD_PROMPT}
      footer={
        <span>
          Goal{" "}
          <span className="font-medium text-sky-400">{formatMl(safeGoal)}</span>{" "}
          a day · each bar is one day's total
        </span>
      }
      kpis={
        stats && (
          <>
            <Kpi label="Avg / day" size="lg" value={formatMl(stats.avg)} />
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
            tickFormatter={fmtAxis}
            tickLine={false}
            tickMargin={4}
            width={36}
          />
          <ChartTooltip
            content={<WaterTooltip goalMl={safeGoal} />}
            cursor={{ fill: "var(--muted-foreground)", fillOpacity: 0.08 }}
          />
          <ReferenceLine
            stroke="#0ea5e9"
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
                fillOpacity={r.ml >= safeGoal ? 0.9 : 0.35}
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
  payload?: { payload?: Point }[];
  goalMl: number;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  const glasses = Math.round(row.ml / GLASS_ML);
  const hit = row.ml >= goalMl;
  return (
    <div className="min-w-[11rem] rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <div className="mb-1.5 font-medium">{formatTick(row.t)}</div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: SKY }}
            />
            <span className="text-muted-foreground">Water</span>
          </div>
          <span className="ml-auto font-medium text-foreground tabular-nums">
            {formatMl(row.ml)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-muted-foreground">
          <span>{glasses} glasses</span>
          <span className={hit ? "font-medium text-emerald-500" : ""}>
            {hit
              ? "goal hit"
              : `${formatMl(Math.max(0, goalMl - row.ml))} short`}
          </span>
        </div>
      </div>
    </div>
  );
}
