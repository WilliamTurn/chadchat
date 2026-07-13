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

import { Minus, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { type ReactNode, useId, useMemo } from "react";
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
import { ChartTip } from "@/components/dashboard/chart-tip";
import { Kpi, type KpiTone } from "@/components/dashboard/kpi";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { useUrlChartRange } from "@/hooks/use-url-chart-range";
import { useMountReveal } from "@/hooks/use-mount-reveal";
import {
  formatFullDate,
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
import { GOAL_EMERALD, TREND_TONE } from "@/lib/chart/palette";
import { computeGoalProgress } from "@/lib/goals/progress";
import { cn } from "@/lib/utils";

const GOAL_COLOR = GOAL_EMERALD;

// The trend line is direction-colored (owner reversal, s138 / DSH-50, undoing
// the s126 "always emerald" call): emerald when the trend is moving toward the
// goal, blood when it's moving away, and a deliberate cool slate when there's
// no goal or the trend is flat. Each state keeps its own glow so the neutral
// line still reads as the intentional, finished centerpiece (the s126 lesson:
// a flat unglowing line looks broken), and the KPI tones stay in agreement —
// the line and the Change/Rate numbers always tell one story.
const TREND_COLORS: Record<KpiTone, string> = {
  good: TREND_TONE.toward,
  bad: TREND_TONE.away,
  neutral: TREND_TONE.neutral,
};
const TREND_GLOWS: Record<KpiTone, string> = {
  good: "[filter:drop-shadow(0_0_6px_rgba(16,185,129,0.45))]",
  bad: "[filter:drop-shadow(0_0_6px_rgba(164,22,26,0.55))]",
  neutral: "[filter:drop-shadow(0_0_6px_rgba(148,163,184,0.35))]",
};

// Below this much trend movement (in display units) the window counts as
// "holding steady" — too small to honestly call a direction.
const STEADY_EPS = 0.2;

/** Which way is the trend moving relative to the goal over these rows? */
function directionTone(
  rows: TrendRow[],
  goalWeight: number | null
): KpiTone {
  if (goalWeight == null || rows.length < 2) {
    return "neutral";
  }
  const change = round1(rows[rows.length - 1].trend - rows[0].trend);
  if (Math.abs(change) < STEADY_EPS) {
    return "neutral";
  }
  const goingDown = change < 0;
  const goalIsBelow = goalWeight < rows[0].trend;
  return goingDown === goalIsBelow ? "good" : "bad";
}

// Data thresholds for honest sparse states (see spec §4.6).
const MIN_FOR_RATE = 5; // below this, a per-week rate is too noisy to show

const ASK_CHAD_PROMPT =
  "Review my Progress page: my weight trend line, body measurements, and progress photos. How am I trending against my goal weight, and what should I adjust?";

/** Projection date, with the year whenever it isn't this year — a slow pace
 *  can project years out, and a bare "Jun 19" then reads as a past date. */
function formatProjection(t: number): string {
  return new Date(t).getUTCFullYear() === new Date().getUTCFullYear()
    ? formatShortDate(t)
    : formatFullDate(t);
}

export function WeightChartInteractive({
  points,
  unit,
  goalWeight = null,
  goalStartWeight = null,
  variant = "full",
  urlState = false,
}: {
  points: { t: number; weight: number }[];
  unit: string;
  goalWeight?: number | null;
  /** The active weight goal's stored start weight, in `unit` (DSH-26 anchor). */
  goalStartWeight?: number | null;
  variant?: "full" | "compact";
  /** Sync the range (incl. custom from/to) to `?range=` for back/forward and
   * deep links (FIX-03). Only the page that owns those params opts in
   * (/progress); embedded mounts (/today, goal detail) stay URL-silent. */
  urlState?: boolean;
}) {
  // Trend is computed over the FULL history so the smoothing never restarts at a
  // range boundary; the range only narrows what's drawn.
  const allRows = useMemo<TrendRow[]>(() => ema(points, 10), [points]);

  const { rows, control } = useUrlChartRange(allRows, {
    minPoints: 8,
    enabled: urlState,
  });
  const n = points.length;

  // ---- Single source of truth: trend-based stats over the selected range ----
  const stats = useMemo(() => {
    // A custom window can hold 0–1 weigh-ins; there's nothing honest to
    // compute there (presets always fall back to >= 2 points).
    if (rows.length < 2) {
      return null;
    }
    const last = rows[rows.length - 1];
    const first = rows[0];
    const change = round1(last.trend - first.trend);
    const perWeek = round1(ratePerWeek(rows));

    // Toward-goal coloring: does the trend move in the goal's direction?
    // Shared with the line color (DSH-50) so the two can never disagree.
    const tone = directionTone(rows, goalWeight);

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

  // How far along the journey to the goal — the "you're 60% there" bar pro scale
  // apps lead with. Anchored on the goal's stored start weight and the smoothed
  // TREND weight (the canonical current, LC-4) via the SHARED calc
  // (`lib/goals/progress`), so this matches the `/today` goal card exactly
  // (DSH-26). Falls back to the first weigh-in for older goals with no stored
  // start.
  const goalProgress = useMemo(() => {
    if (points.length < 2) {
      return null;
    }
    const p = computeGoalProgress({
      startValue: goalStartWeight,
      targetValue: goalWeight,
      current: allRows[allRows.length - 1].trend,
      firstWeight: points[0].weight,
    });
    if (p == null || p.start === p.target) {
      return null; // started at goal — nothing meaningful to show
    }
    return { pct: p.pct / 100, reached: p.reached };
  }, [points, allRows, goalWeight, goalStartWeight]);

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
        tone={directionTone(allRows, goalWeight)}
        unit={unit}
      />
    );
  }

  const rangeLabel =
    control.range === "all"
      ? "all time"
      : control.range === "custom"
        ? "custom range"
        : control.range.toUpperCase();

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
            {/* "% there" moved up from the retired micro-bar (VF-15): the bar
                under the chart restated the To-goal KPI and this footer, so
                the one unique fact it carried now lives in this line. */}
            {!reached && goalProgress && (
              <>
                {" "}
                ·{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {Math.round(goalProgress.pct * 100)}% there
                </span>
              </>
            )}
            {reached ? (
              <>
                {" "}
                ·{" "}
                <span className="font-medium text-foreground">
                  reached 🎯
                </span>
              </>
            ) : stats?.projection ? (
              // A pace projection, not a promise: "at this pace" says exactly
              // what the date is (it shifts with the range window), where the
              // old "on track for" read as on-track-for-the-goal's-own-deadline
              // even when that deadline would be missed (LC-5).
              <>
                {" "}
                · at this pace:{" "}
                <span className="font-medium text-foreground">
                  ~{formatProjection(stats.projection.dateMs)}
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
                // Honest about the smoothing: the EMA averages weeks of
                // weigh-ins (tau = 10 days), so it deliberately LAGS the
                // latest scale readings. The old copy claimed it "sits
                // between your last couple of weigh-ins", which the number
                // next to it visibly violated (LC-14).
                <>
                  Your <span className="text-foreground">smoothed</span> weight,
                  not today's number on the scale. It averages your last few
                  weeks of weigh-ins (newer ones count more) so a salty meal or
                  a dehydrated morning doesn't fool you. It moves slowly on
                  purpose: after a real change it takes a week or two to catch
                  up, so it can sit above or below your latest weigh-ins for a
                  while.{" "}
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
                  <span className="text-blood">red</span> means away. Use the
                  range buttons (or the calendar for any custom window) to
                  change it.
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
                    ? `· ~${formatProjection(stats.projection.dateMs)}`
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
      {goalWeight != null && stats && (
        <VerdictLine
          change={stats.change}
          rangeLabel={rangeLabel}
          reached={reached}
          tone={stats.tone}
          unit={unit}
        />
      )}
      {rows.length < 2 ? (
        <p className="py-8 text-center text-muted-foreground text-sm">
          {rows.length === 0
            ? "No weigh-ins in this date range."
            : "Only one weigh-in in this date range — pick a wider window to see the trend."}
        </p>
      ) : (
        <WeightChartBody
          goalWeight={goalWeight}
          rows={rows}
          tone={stats?.tone ?? "neutral"}
          unit={unit}
        />
      )}
    </ChartCard>
  );
}

/**
 * The verdict, in words (DSH-52): pro scale apps say the conclusion instead of
 * making the user decode number colors. Toward-goal gets the win treatment
 * (emerald + trophy), away is called out honestly in blood, and a flat window
 * gets a truthful in-between instead of a fake verdict.
 */
function VerdictLine({
  tone,
  change,
  unit,
  rangeLabel,
  reached,
}: {
  tone: KpiTone;
  change: number;
  unit: string;
  rangeLabel: string;
  reached: boolean;
}) {
  const window =
    rangeLabel === "all time"
      ? "across your full history"
      : rangeLabel === "custom range"
        ? "in this date range"
        : `over the last ${
            (
              {
                "1W": "week",
                "1M": "month",
                "3M": "3 months",
                "6M": "6 months",
                "1Y": "year",
              } as Record<string, string>
            )[rangeLabel] ?? rangeLabel
          }`;
  const moved = `${Math.abs(change)} ${unit} ${change < 0 ? "down" : "up"} ${window}`;

  let icon: ReactNode;
  let text: string;
  let className: string;
  if (reached) {
    icon = <Trophy className="size-4" />;
    text = "You reached your goal. Time to set the next one.";
    className = "border-emerald-500/25 bg-emerald-500/10 text-emerald-500";
  } else if (tone === "good") {
    icon = <Trophy className="size-4" />;
    text = `Trending toward your goal: ${moved}.`;
    className = "border-emerald-500/25 bg-emerald-500/10 text-emerald-500";
  } else if (tone === "bad") {
    icon =
      change > 0 ? (
        <TrendingUp className="size-4" />
      ) : (
        <TrendingDown className="size-4" />
      );
    text = `Moving away from your goal: ${moved}.`;
    className = "border-blood/25 bg-blood-dim text-blood";
  } else {
    icon = <Minus className="size-4" />;
    text = `Holding steady: your weight has barely moved ${window}.`;
    className = "border-border bg-muted/40 text-muted-foreground";
  }

  return (
    <div
      className={cn(
        "mb-4 flex items-center gap-2 rounded-lg border px-3 py-2 font-medium text-sm",
        className
      )}
    >
      <span aria-hidden className="shrink-0">
        {icon}
      </span>
      <span>{text}</span>
    </div>
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
  tone,
  compact = false,
}: {
  rows: TrendRow[];
  unit: string;
  goalWeight: number | null;
  /** Direction verdict for the window shown — colors the line (DSH-50). */
  tone: KpiTone;
  compact?: boolean;
}) {
  // One-time draw-in on mount; scrub + range changes stay instant.
  const reveal = useMountReveal();
  const gradientId = useId();

  // Direction-colored, with a matching glow (DSH-50; see TREND_COLORS above).
  const lineColor = TREND_COLORS[tone];
  const glowClass = TREND_GLOWS[tone];

  const chartConfig = {
    trend: { label: "Trend", color: lineColor },
    weight: { label: "Weighed in", color: "var(--muted-foreground)" },
  } satisfies ChartConfig;

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

  // Compact (/today) y-ticks: just the three numbers that matter — where the
  // trend started, where it is, and the goal (VF-8; the mini chart had no
  // y-labels at all, so the line floated unanchored).
  const compactTicks = useMemo<number[] | undefined>(() => {
    if (!compact || rows.length === 0) {
      return undefined;
    }
    const vals = [
      Math.round(rows[0].trend),
      Math.round(rows[rows.length - 1].trend),
      goalWeight == null ? null : Math.round(goalWeight),
    ].filter((v): v is number => v != null);
    return [...new Set(vals)].sort((a, b) => a - b);
  }, [compact, rows, goalWeight]);

  return (
    <ChartContainer
      className={compact ? "h-[170px] w-full" : "h-[260px] w-full"}
      config={chartConfig}
    >
      <ComposedChart
        data={rows}
        margin={
          compact
            ? { top: 8, right: 8, bottom: 0, left: -8 }
            : { top: 8, right: 12, bottom: 0, left: -8 }
        }
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity={0.18} />
            <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
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
        {compact && (
          <YAxis
            axisLine={false}
            domain={yDomain}
            tickLine={false}
            tickMargin={4}
            ticks={compactTicks}
            width={40}
          />
        )}

        <ChartTooltip
          content={<WeightTooltip trendColor={lineColor} unit={unit} />}
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

        {/* The headline EMA trend, on top, with its matching glow. */}
        <Area
          activeDot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
          animationDuration={750}
          animationEasing="ease-out"
          className={glowClass}
          dataKey="trend"
          dot={false}
          fill={`url(#${gradientId})`}
          isAnimationActive={reveal}
          stroke={lineColor}
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
  trendColor,
}: {
  active?: boolean;
  payload?: { dataKey?: string | number; payload?: TrendRow }[];
  unit: string;
  trendColor: string;
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
          color: "var(--muted-foreground)",
          label: "Weighed in",
          value: `${row.weight} ${unit}`,
        },
        { color: trendColor, label: "Trend", value: `${row.trend} ${unit}` },
      ]}
      t={row.t}
    />
  );
}
