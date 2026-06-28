"use client";

/**
 * Nightly sleep trend — each bar is one night's time asleep, oldest → newest,
 * with a dashed 7-hour target line and a scrub tooltip. Built on Recharts via
 * the shadcn chart primitive and the shared dashboard chart system (ChartCard /
 * Kpi / useChartRange), so it matches the weight, volume and water trends.
 * Nights that hit the target are full-strength indigo; short nights are faded.
 * KPIs report the average per night and how many nights hit the target.
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
import { SLEEP_GOAL_MINUTES } from "@/lib/validation/sleep";

const INDIGO = "#818cf8";

const ASK_CHAD_PROMPT =
  "Look at my sleep over the last couple of weeks. Am I getting enough sleep to recover and make progress, and what would help me sleep more consistently?";

const chartConfig = {
  minutes: { label: "Sleep", color: INDIGO },
} satisfies ChartConfig;

type Point = { t: number; minutes: number; quality: number | null };

/** "7h 30m" / "45m". */
function formatDuration(minutes: number): string {
  if (minutes <= 0) {
    return "0h";
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) {
    return `${m}m`;
  }
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}m`;
}

/** Compact axis label in hours, e.g. "7h". */
function fmtAxis(minutes: number): string {
  return `${Math.round(minutes / 60)}h`;
}

export function SleepTrendChart({ days }: { days: Point[] }) {
  const reveal = useMountReveal();
  const { rows, control } = useChartRange(days, { minPoints: 7 });

  const stats = useMemo(() => {
    if (rows.length === 0) {
      return null;
    }
    const sum = rows.reduce((s, r) => s + r.minutes, 0);
    const avg = Math.round(sum / rows.length);
    const hit = rows.filter((r) => r.minutes >= SLEEP_GOAL_MINUTES).length;
    return { avg, hit, total: rows.length };
  }, [rows]);

  const yMax = useMemo(() => {
    if (rows.length === 0) {
      return SLEEP_GOAL_MINUTES * 1.3;
    }
    return Math.max(...rows.map((r) => r.minutes), SLEEP_GOAL_MINUTES) * 1.15;
  }, [rows]);

  if (days.length < 2) {
    return null;
  }

  return (
    <ChartCard
      askChadPrompt={ASK_CHAD_PROMPT}
      footer={
        <span>
          Target{" "}
          <span className="font-medium text-indigo-400">
            {formatDuration(SLEEP_GOAL_MINUTES)}
          </span>{" "}
          a night · each bar is one night
        </span>
      }
      kpis={
        stats && (
          <>
            <Kpi
              label="Avg / night"
              size="lg"
              value={formatDuration(stats.avg)}
            />
            <Kpi
              label="Nights hit target"
              tone={stats.hit > 0 ? "good" : "neutral"}
              value={`${stats.hit} / ${stats.total}`}
            />
          </>
        )
      }
      range={control}
      title="Sleep trend"
    >
      <ChartContainer className="h-[200px] w-full" config={chartConfig}>
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
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
            content={<SleepTooltip />}
            cursor={{ fill: "var(--muted-foreground)", fillOpacity: 0.08 }}
          />
          <ReferenceLine
            stroke={INDIGO}
            strokeDasharray="5 4"
            strokeOpacity={0.7}
            strokeWidth={1.5}
            y={SLEEP_GOAL_MINUTES}
          />
          <Bar
            animationDuration={750}
            animationEasing="ease-out"
            dataKey="minutes"
            isAnimationActive={reveal}
            maxBarSize={34}
            radius={[3, 3, 0, 0]}
          >
            {rows.map((r) => (
              <Cell
                fill={INDIGO}
                fillOpacity={r.minutes >= SLEEP_GOAL_MINUTES ? 0.9 : 0.4}
                key={r.t}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

const QUALITY_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "OK",
  4: "Good",
  5: "Great",
};

function SleepTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: Point }[];
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  const hit = row.minutes >= SLEEP_GOAL_MINUTES;
  return (
    <div className="min-w-[11rem] rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <div className="mb-1.5 font-medium">{formatTick(row.t)}</div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: INDIGO }}
            />
            <span className="text-muted-foreground">Sleep</span>
          </div>
          <span className="ml-auto font-medium text-foreground tabular-nums">
            {formatDuration(row.minutes)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-muted-foreground">
          <span>{row.quality == null ? "—" : QUALITY_LABELS[row.quality]}</span>
          <span className={hit ? "font-medium text-emerald-500" : ""}>
            {hit
              ? "target hit"
              : `${formatDuration(SLEEP_GOAL_MINUTES - row.minutes)} short`}
          </span>
        </div>
      </div>
    </div>
  );
}
