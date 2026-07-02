"use client";

/**
 * Nightly sleep trend (the /sleep detail page) — each bar is one night's time
 * asleep, oldest → newest, with a dashed 7-hour recommended line and a scrub
 * tooltip. Built on Recharts via the shadcn chart primitive and the shared
 * dashboard chart system (ChartCard / Kpi / useChartRange), so it matches the
 * weight, volume and water trends. Nights that reach 7h are full-strength
 * indigo; short nights are faded.
 *
 * Honest axis (audit P2-5): unlogged nights render as empty slots instead of
 * silently vanishing — the series is gap-filled per calendar day, so "3 of 7
 * nights" means 3 of the 7 real nights in the window, misses included.
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
  formatSleepDuration,
  QUALITY_LABELS,
} from "@/components/today/sleep-log-form";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { useChartRange } from "@/hooks/use-chart-range";
import { useMountReveal } from "@/hooks/use-mount-reveal";
import { formatTick } from "@/lib/chart/format";
import { fillDailyGaps } from "@/lib/chart/trend";
import { SLEEP_GOAL_MINUTES } from "@/lib/validation/sleep";

const INDIGO = "#818cf8";

const ASK_CHAD_PROMPT =
  "Look at my sleep over the last couple of weeks. Am I getting enough sleep to recover and make progress, and what would help me sleep more consistently?";

const chartConfig = {
  minutes: { label: "Sleep", color: INDIGO },
} satisfies ChartConfig;

type Point = { t: number; minutes: number; quality: number | null };
type Row = Point & { logged: boolean };

/** Compact axis label in hours, e.g. "7h". */
function fmtAxis(minutes: number): string {
  return `${Math.round(minutes / 60)}h`;
}

export function SleepTrendChart({ days }: { days: Point[] }) {
  const reveal = useMountReveal();

  // Gap-fill unlogged nights so the date axis stays honest (bars are evenly
  // spaced bands — without the fill, missing days silently vanish).
  const filled = useMemo<Row[]>(
    () =>
      fillDailyGaps<Row>(
        days.map((d) => ({ ...d, logged: true })),
        (t) => ({ t, minutes: 0, quality: null, logged: false })
      ),
    [days]
  );
  const { rows, control } = useChartRange(filled, { minPoints: 7 });

  const stats = useMemo(() => {
    const loggedRows = rows.filter((r) => r.logged);
    if (loggedRows.length === 0) {
      return null;
    }
    const sum = loggedRows.reduce((s, r) => s + r.minutes, 0);
    const avg = Math.round(sum / loggedRows.length);
    const hit = loggedRows.filter(
      (r) => r.minutes >= SLEEP_GOAL_MINUTES
    ).length;
    // Denominator = every night in the window, unlogged included — a missed
    // log is a night that didn't hit 7h, not a night that didn't happen.
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
          <span className="font-medium text-indigo-400">
            {formatSleepDuration(SLEEP_GOAL_MINUTES)}+
          </span>{" "}
          a night recommended · each bar is one night · gaps are unlogged
          nights
        </span>
      }
      kpis={
        stats && (
          <>
            <Kpi
              label="Avg / night"
              size="lg"
              value={formatSleepDuration(stats.avg)}
            />
            <Kpi
              label="Nights with 7h+"
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
            minTickGap={32}
            tickFormatter={formatTick}
            tickLine={false}
            tickMargin={8}
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
                fillOpacity={
                  r.logged ? (r.minutes >= SLEEP_GOAL_MINUTES ? 0.9 : 0.4) : 0
                }
                key={r.t}
              />
            ))}
          </Bar>
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

function SleepTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: Row }[];
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
      {row.logged ? (
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
              {formatSleepDuration(row.minutes)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-muted-foreground">
            <span>
              {row.quality == null ? "—" : QUALITY_LABELS[row.quality]}
            </span>
            <span className={hit ? "font-medium text-emerald-500" : ""}>
              {hit
                ? "7h+ reached"
                : `${formatSleepDuration(SLEEP_GOAL_MINUTES - row.minutes)} short of 7h`}
            </span>
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground">Not logged</div>
      )}
    </div>
  );
}
