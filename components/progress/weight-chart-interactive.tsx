"use client";

/**
 * The interactive weight-trend view. Built on Recharts via the shadcn chart
 * primitive (`components/ui/chart.tsx`) and the shared dashboard chart system
 * (`ChartCard`, `Kpi`, `useChartRange`, the pure `lib/chart` math). What it
 * gives a user in under three seconds: where am I (trend weight), which way and
 * how fast (change + rate), and will I hit my goal (remaining + projected date).
 *
 * Trend is a **gap-aware EMA** (TrendWeight/MacroFactor style) — smooth and
 * trustworthy right at today's edge, the part that matters most — riding over
 * the faint raw weigh-ins. Hover/scrub any day for that day's weigh-in and
 * trend. Honest sparse states: a lone weigh-in shows the number, not a broken
 * one-dot line; rate/projection stay hidden until there's enough data to be
 * truthful.
 *
 * Two variants share one chart body:
 *   - `full` (default) — the `/progress` centerpiece: own card chrome, KPI
 *     strip, range toggle, projection footer.
 *   - `compact` — the `/today` mini view: chart only (the page supplies the
 *     card + headline number), all history, shorter, no toggle/KPIs.
 */

import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "@/components/dashboard/chart-card";
import { Kpi, type KpiTone } from "@/components/dashboard/kpi";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { useChartRange } from "@/hooks/use-chart-range";
import { useMountReveal } from "@/hooks/use-mount-reveal";
import {
  formatRate,
  formatShortDate,
  formatSignedDelta,
  formatTick,
} from "@/lib/chart/format";
import {
  ema,
  projectToGoal,
  ratePerWeek,
  round1,
  type TrendRow,
} from "@/lib/chart/trend";

const ACCENT = "#a4161a"; // brand blood red
const GOAL_COLOR = "#10b981"; // emerald

// Data thresholds for honest sparse states (see spec §4.6).
const MIN_FOR_RATE = 5; // below this, a per-week rate is too noisy to show

const ASK_CHAD_PROMPT =
  "Review my progress — weight, body measurements, and photos. How am I doing, and what should I adjust?";

const chartConfig = {
  trend: { label: "Trend", color: ACCENT },
  weight: { label: "Weighed in", color: "var(--muted-foreground)" },
} satisfies ChartConfig;

export function WeightChartInteractive({
  points,
  unit,
  goalWeight = null,
  variant = "full",
}: {
  points: { t: number; weight: number }[];
  unit: string;
  goalWeight?: number | null;
  variant?: "full" | "compact";
}) {
  // Trend is computed over the FULL history so the smoothing never restarts at a
  // range boundary; the range only narrows what's drawn.
  const allRows = useMemo<TrendRow[]>(() => ema(points, 10), [points]);

  const { rows, control } = useChartRange(allRows, { minPoints: 8 });
  const n = points.length;

  // ---- Single source of truth: trend-based stats over the selected range ----
  const stats = useMemo(() => {
    if (rows.length === 0) {
      return null;
    }
    const last = rows[rows.length - 1];
    const first = rows[0];
    const change = round1(last.trend - first.trend);
    const perWeek = round1(ratePerWeek(rows));

    // Toward-goal coloring: does the trend move in the goal's direction?
    let tone: KpiTone = "neutral";
    if (goalWeight != null && change !== 0) {
      const goingDown = change < 0;
      const goalIsBelow = goalWeight < first.trend;
      tone = goingDown === goalIsBelow ? "good" : "bad";
    }

    // Projection — only when we have enough data and a real rate toward goal.
    let projection: { dateMs: number } | null = null;
    if (goalWeight != null && n >= MIN_FOR_RATE) {
      projection = projectToGoal(last.trend, perWeek / 7, goalWeight, last.t);
    }

    return {
      trendWeight: last.trend,
      change,
      perWeek,
      tone,
      projection,
      toGo: goalWeight == null ? null : round1(last.trend - goalWeight),
    };
  }, [rows, goalWeight, n]);

  // How far along the journey from the very first weigh-in to the goal — the
  // "you're 60% there" bar pro scale apps lead with. Computed over ALL history
  // (not the range) so it answers "how close am I overall?".
  const goalProgress = useMemo(() => {
    if (goalWeight == null || allRows.length < 2) {
      return null;
    }
    const start = allRows[0].trend;
    const current = allRows[allRows.length - 1].trend;
    const total = start - goalWeight; // signed distance to cover
    if (Math.abs(total) < 0.1) {
      return null; // started at goal — nothing meaningful to show
    }
    const done = start - current; // signed progress made so far
    const pct = Math.max(0, Math.min(1, done / total));
    return { pct, reached: pct >= 0.999 };
  }, [allRows, goalWeight]);

  if (n === 0) {
    return null; // page renders the empty-state prompt
  }

  // ---- Compact /today mini view: chart only, all history, no chrome ---------
  if (variant === "compact") {
    if (n === 1) {
      return (
        <p className="py-6 text-center text-muted-foreground text-sm">
          Log another weigh-in to see your trend line.
        </p>
      );
    }
    return (
      <WeightChartBody
        compact
        goalWeight={goalWeight}
        rows={allRows}
        unit={unit}
      />
    );
  }

  const rangeLabel =
    control.range === "all" ? "all time" : control.range.toUpperCase();

  // ---- Single lonely weigh-in: show the number, never a one-dot line --------
  if (n === 1) {
    return (
      <ChartCard
        askChadPrompt={ASK_CHAD_PROMPT}
        kpis={
          <Kpi
            label="Current"
            size="lg"
            value={`${round1(points[0].weight)} ${unit}`}
          />
        }
        title="Weight trend"
      >
        <p className="py-8 text-center text-muted-foreground text-sm">
          Log another weigh-in and your trend line shows up here.
        </p>
      </ChartCard>
    );
  }

  const showRate = n >= MIN_FOR_RATE && stats != null;
  const reached = stats?.toGo != null && Math.abs(stats.toGo) < 0.1;

  return (
    <ChartCard
      askChadPrompt={ASK_CHAD_PROMPT}
      footer={
        goalWeight == null ? undefined : (
          <span>
            Goal{" "}
            <span className="font-medium text-emerald-500">
              {goalWeight} {unit}
            </span>
            {reached ? (
              <>
                {" "}
                ·{" "}
                <span className="font-medium text-foreground">
                  reached 🎯
                </span>
              </>
            ) : stats?.projection ? (
              <>
                {" "}
                · on track for{" "}
                <span className="font-medium text-foreground">
                  {formatShortDate(stats.projection.dateMs)}
                </span>
              </>
            ) : null}
          </span>
        )
      }
      kpis={
        stats && (
          <>
            <Kpi
              help={
                <>
                  Your <span className="text-foreground">smoothed</span> weight —
                  not today's number on the scale. It blends your recent weigh-ins
                  so a salty meal or a dehydrated morning doesn't fool you. That's
                  why it's a decimal: e.g. {stats.trendWeight} sits between your
                  last couple of weigh-ins, weighted toward the most recent one.{" "}
                  <span className="text-foreground">This is the number to
                  actually watch.</span>
                </>
              }
              label="Trend weight"
              size="lg"
              value={`${stats.trendWeight} ${unit}`}
            />
            <Kpi
              help={
                <>
                  How much your trend weight has moved over the selected time
                  window.{" "}
                  <span className="text-emerald-500">Green</span> means it's
                  heading toward your goal,{" "}
                  <span className="text-blood">red</span> means away. Use the{" "}
                  <span className="text-foreground">1W / 1M / All</span> buttons to
                  change the window.
                </>
              }
              label="Change"
              sub={`· ${rangeLabel}`}
              tone={stats.tone}
              value={formatSignedDelta(stats.change, unit)}
            />
            {showRate && (
              <Kpi
                help={
                  <>
                    Your average pace — how fast the trend is moving per week over
                    this window. For steady fat loss,{" "}
                    <span className="text-foreground">
                      0.5–1% of bodyweight per week
                    </span>{" "}
                    is the usual healthy target.
                  </>
                }
                label="Rate"
                tone={stats.tone}
                value={formatRate(stats.perWeek, unit)}
              />
            )}
            {goalWeight != null && stats.toGo != null && (
              <Kpi
                help={
                  <>
                    How far your trend weight still is from your goal of{" "}
                    <span className="text-foreground">
                      {goalWeight} {unit}
                    </span>
                    . Once there's enough data, the date below is when you'll reach
                    it if you hold this pace.
                  </>
                }
                label="To goal"
                sub={
                  stats.projection
                    ? `· ${formatShortDate(stats.projection.dateMs)}`
                    : undefined
                }
                tone={reached ? "good" : "neutral"}
                value={
                  reached ? "Reached 🎯" : `${Math.abs(stats.toGo)} ${unit}`
                }
              />
            )}
          </>
        )
      }
      range={control}
      title="Weight trend"
    >
      <WeightChartBody goalWeight={goalWeight} rows={rows} unit={unit} />
      {goalProgress && (
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress to goal</span>
            <span className="font-medium tabular-nums">
              {goalProgress.reached
                ? "Reached 🎯"
                : `${Math.round(goalProgress.pct * 100)}%`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.max(2, goalProgress.pct * 100)}%` }}
            />
          </div>
        </div>
      )}
    </ChartCard>
  );
}

/**
 * The shared Recharts body: faint raw weigh-ins under the headline EMA trend,
 * a dashed goal line, and a scrub crosshair + tooltip. `compact` drops the
 * Y-axis and goal label and shrinks the height for the `/today` mini view.
 */
function WeightChartBody({
  rows,
  unit,
  goalWeight,
  compact = false,
}: {
  rows: TrendRow[];
  unit: string;
  goalWeight: number | null;
  compact?: boolean;
}) {
  // One-time draw-in on mount; scrub + range changes stay instant.
  const reveal = useMountReveal();

  // Padded y-domain that always keeps the goal line on screen.
  const yDomain = useMemo<[number, number]>(() => {
    const ws = rows.map((r) => r.weight);
    const vals = goalWeight == null ? ws : [...ws, goalWeight];
    if (vals.length === 0) {
      return [0, 1];
    }
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const spread = max - min;
    const pad = spread > 0 ? spread * 0.15 : Math.max(max * 0.02, 1);
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [rows, goalWeight]);

  return (
    <ChartContainer
      className={compact ? "h-[170px] w-full" : "h-[260px] w-full"}
      config={chartConfig}
    >
      <ComposedChart
        data={rows}
        margin={
          compact
            ? { top: 8, right: 8, bottom: 0, left: 8 }
            : { top: 8, right: 12, bottom: 0, left: -8 }
        }
      >
        <defs>
          <linearGradient id="weightTrendFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={ACCENT} stopOpacity={0.18} />
            <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" vertical={false} />

        <XAxis
          axisLine={false}
          dataKey="t"
          domain={["dataMin", "dataMax"]}
          minTickGap={compact ? 48 : 32}
          scale="time"
          tickFormatter={formatTick}
          tickLine={false}
          tickMargin={8}
          type="number"
        />
        {!compact && (
          <YAxis
            axisLine={false}
            domain={yDomain}
            tickCount={5}
            tickLine={false}
            tickMargin={4}
            width={40}
          />
        )}
        {compact && <YAxis domain={yDomain} hide />}

        <ChartTooltip
          content={<WeightTooltip unit={unit} />}
          cursor={{
            stroke: "var(--muted-foreground)",
            strokeDasharray: "4 4",
            strokeWidth: 1,
          }}
        />

        {goalWeight != null && (
          <ReferenceLine
            label={
              compact
                ? undefined
                : {
                    value: `Goal ${goalWeight} ${unit}`,
                    position: "insideTopRight",
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                  }
            }
            stroke={GOAL_COLOR}
            strokeDasharray="5 4"
            strokeWidth={1.5}
            y={goalWeight}
          />
        )}

        {/* Faint raw daily weigh-ins, underneath the trend. */}
        <Line
          activeDot={{ r: 4, fill: "var(--muted-foreground)", strokeWidth: 0 }}
          animationDuration={750}
          animationEasing="ease-out"
          dataKey="weight"
          dot={{ r: 2, fillOpacity: 0.5, strokeWidth: 0 }}
          isAnimationActive={reveal}
          stroke="var(--muted-foreground)"
          strokeOpacity={0.3}
          strokeWidth={1}
          type="monotone"
        />

        {/* The headline EMA trend, on top. */}
        <Area
          activeDot={{ r: 4, fill: ACCENT, strokeWidth: 0 }}
          animationDuration={750}
          animationEasing="ease-out"
          dataKey="trend"
          dot={false}
          fill="url(#weightTrendFill)"
          isAnimationActive={reveal}
          stroke={ACCENT}
          strokeWidth={2.5}
          type="monotone"
        />
      </ComposedChart>
    </ChartContainer>
  );
}

/**
 * Custom tooltip: bold UTC-stable date, then the raw weigh-in and the trend with
 * a comfortable label↔value gap (the POC's default tooltip was cramped).
 */
function WeightTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; payload?: TrendRow }[];
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
    <div className="min-w-[11rem] rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <div className="mb-1.5 font-medium">{formatTick(row.t)}</div>
      <div className="flex flex-col gap-1">
        <TooltipRow
          color="var(--muted-foreground)"
          label="Weighed in"
          value={`${row.weight} ${unit}`}
        />
        <TooltipRow color={ACCENT} label="Trend" value={`${row.trend} ${unit}`} />
      </div>
    </div>
  );
}

function TooltipRow({
  color,
  label,
  value,
}: {
  color: string;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1.5">
        <span
          className="size-2 shrink-0 rounded-[2px]"
          style={{ backgroundColor: color }}
        />
        <span className="text-muted-foreground">{label}</span>
      </div>
      <span className="ml-auto font-medium text-foreground tabular-nums">
        {value}
      </span>
    </div>
  );
}
