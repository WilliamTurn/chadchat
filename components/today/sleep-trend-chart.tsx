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
 * silently vanishing — the series is gap-filled per calendar day.
 *
 * One window, one denominator (LC-9): BOTH stats count only the nights the
 * user actually logged in the selected range. The average was always
 * per-logged-night; the "Nights with 7h+" denominator used to be every night
 * in the window (so honest logging gaps read as failed nights, and the two
 * stats silently used different denominators on one card). A night with no
 * log is unknown, not a miss — the chart's empty slots already show the gaps.
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
import { formatTick, niceScale } from "@/lib/chart/format";
import { DOMAIN } from "@/lib/chart/palette";
import { fillDailyGaps } from "@/lib/chart/trend";
import { SLEEP_GOAL_MINUTES } from "@/lib/validation/sleep";

const INDIGO = DOMAIN.sleep;

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
    // Denominator = logged nights only (LC-9): same basis as the average, so
    // the two stats can't disagree about what a "night" is. Unlogged nights
    // are unknowns, shown as gaps in the chart, not counted as misses.
    return { avg, hit, logged: loggedRows.length };
  }, [rows]);

  // Even whole-hour ticks (VF-8): 0h/2h/4h…, never the irregular 0h/3h/7h/9h
  // a raw-max domain produced. Data is minutes; steps are display hours.
  const { max: yMax, ticks: yTicks } = useMemo(
    () =>
      niceScale(
        Math.max(...rows.map((r) => r.minutes), SLEEP_GOAL_MINUTES),
        { steps: [1, 2, 3, 4, 6, 12], unit: 60 }
      ),
    [rows]
  );

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
              help="Your average across the nights you logged in this range. Nights you didn't log aren't counted."
              label="Avg / night"
              size="lg"
              value={formatSleepDuration(stats.avg)}
            />
            <Kpi
              help="How many of the nights you logged in this range hit the recommended 7 hours. Nights you didn't log show as gaps in the chart and don't count against you."
              label="Nights with 7h+"
              sub="of logged nights"
              tone={stats.hit > 0 ? "good" : "neutral"}
              value={`${stats.hit} / ${stats.logged}`}
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
            tickFormatter={fmtAxis}
            tickLine={false}
            tickMargin={4}
            ticks={yTicks}
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
    <ChartTip
      rows={
        row.logged
          ? [
              {
                color: INDIGO,
                label: "Sleep",
                value: formatSleepDuration(row.minutes),
              },
            ]
          : []
      }
      t={row.t}
    >
      {row.logged ? (
        <div className="mt-1 flex items-center justify-between gap-4 text-muted-foreground">
          <span>{row.quality == null ? "—" : QUALITY_LABELS[row.quality]}</span>
          <span className={hit ? "font-medium text-emerald-500" : ""}>
            {hit
              ? "7h+ reached"
              : `${formatSleepDuration(SLEEP_GOAL_MINUTES - row.minutes)} short of 7h`}
          </span>
        </div>
      ) : (
        <div className="text-muted-foreground">Not logged</div>
      )}
    </ChartTip>
  );
}
