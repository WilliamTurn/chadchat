"use client";

/**
 * The interactive weight-trend view, MIGRATED onto the shared chart system
 * (P56-A, queued since P2-Z): ChartFrame carries the grammar (title, headline
 * trend weight, goal text, range, legend, coverage, sr summary, designed
 * states), TrendChart draws the plot on a window-spanning axis (DSH-60), and
 * the window-following stat tiles compose at panel level (the /hydration
 * pattern). What it gives a user in under three seconds: where am I (trend
 * weight), which way and how fast (change + rate), and will I hit my goal
 * (to-goal + projected date).
 *
 * Preserved from the pre-migration component, deliberately:
 *   - P34-B's URL state (FIX-03): ?range presets plus the DSH-52 custom
 *     ?range=custom&from&to window via useUrlChartRange (state only; the
 *     drawn window derives from lib/chart/window.ts, composing the two
 *     systems without forking either).
 *   - The DSH-50 direction-colored trend (TREND_TONE tokens) with its glow.
 *   - The KPI help popovers (s50), the verdict line (DSH-52), the goal
 *     footer facts (% there, at-this-pace date), and the Ask Chad hook.
 *
 * Two variants share the plot:
 *   - `full` (default): the /progress/body centerpiece.
 *   - `compact`: the /home mini view (bare plot, page supplies the card).
 */

import { Minus, TrendingDown, TrendingUp, Trophy } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { RangeToggle } from "@/components/dashboard/chart-card";
import { Kpi, KpiHelp, type KpiTone } from "@/components/dashboard/kpi";
import { ChartFrame } from "@/components/charts/chart-frame";
import { TrendChart, trendChartLegend } from "@/components/charts/trend-chart";
import { useUrlChartRange } from "@/hooks/use-url-chart-range";
import type { RangeKey } from "@/hooks/use-chart-range";
import {
  formatFullDate,
  formatRate,
  formatShortDate,
  formatSignedDelta,
} from "@/lib/chart/format";
import type { TrendTone } from "@/lib/chart/palette";
import { buildChartSummary } from "@/lib/chart/summary";
import {
  ema,
  MS_PER_DAY,
  projectToGoal,
  ratePerWeek,
  round1,
  type TrendRow,
} from "@/lib/chart/trend";
import {
  type ChartWindow,
  clampToWindow,
  windowEndingAt,
  windowFromExtent,
} from "@/lib/chart/window";
import {
  type Coverage,
  loggedReading,
  type MetricReading,
  unloggedReading,
} from "@/lib/contracts/data-state";
import { computeGoalProgress } from "@/lib/goals/progress";
import { cn } from "@/lib/utils";

// Below this much trend movement (in display units) the window counts as
// "holding steady": too small to honestly call a direction.
const STEADY_EPS = 0.2;

// Data thresholds for honest sparse states (see spec section 4.6).
const MIN_FOR_RATE = 5; // below this, a per-week rate is too noisy to show

// Chart staleness matches the metric registry (body.weight.trend, 10 days).
const STALE_AFTER_DAYS = 10;

const ASK_CHAD_PROMPT =
  "Review my Body page: my weight trend line, body measurements, and progress photos. How am I trending against my goal weight, and what should I adjust?";

/** Legacy preset key -> window length in days (all/custom resolve elsewhere). */
const RANGE_DAYS: Partial<Record<RangeKey, number>> = {
  "1w": 7,
  "1m": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
};

/** Member phrase for the active window (frame range line + summary). */
function memberRangeLabel(range: RangeKey): string {
  switch (range) {
    case "1w":
      return "last 7 days";
    case "1m":
      return "last 30 days";
    case "3m":
      return "last 3 months";
    case "6m":
      return "last 6 months";
    case "1y":
      return "last year";
    case "custom":
      return "custom range";
    default:
      return "all time";
  }
}

/** The verdict's window phrase ("over the last month"). */
function verdictWindowPhrase(range: RangeKey): string {
  switch (range) {
    case "1w":
      return "over the last week";
    case "1m":
      return "over the last month";
    case "3m":
      return "over the last 3 months";
    case "6m":
      return "over the last 6 months";
    case "1y":
      return "over the last year";
    case "custom":
      return "in this date range";
    default:
      return "across your full history";
  }
}

/** Which way is the trend moving relative to the goal over these rows? */
function directionTone(rows: TrendRow[], goalWeight: number | null): KpiTone {
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

/** KpiTone (stat tiles) -> TrendTone (chart line tokens). One verdict. */
const TONE_TO_TREND: Record<KpiTone, TrendTone> = {
  good: "toward",
  bad: "away",
  neutral: "neutral",
};

/** Projection date, with the year whenever it isn't this year: a slow pace
 *  can project years out, and a bare "Jun 19" then reads as a past date. */
function formatProjection(t: number): string {
  return new Date(t).getUTCFullYear() === new Date().getUTCFullYear()
    ? formatShortDate(t)
    : formatFullDate(t);
}

/** 00:00-UTC day anchor fallback when the page passes no member-local one. */
function utcTodayAnchorMs(): number {
  return Math.floor(Date.now() / MS_PER_DAY) * MS_PER_DAY;
}

export function WeightChartInteractive({
  points,
  unit,
  goalWeight = null,
  goalStartWeight = null,
  variant = "full",
  urlState = false,
  todayMs,
}: {
  points: { t: number; weight: number }[];
  unit: "lb" | "kg";
  goalWeight?: number | null;
  /** The active weight goal's stored start weight, in `unit` (DSH-26 anchor). */
  goalStartWeight?: number | null;
  variant?: "full" | "compact";
  /** Sync the range (incl. custom from/to) to `?range=` for back/forward and
   * deep links (FIX-03). Only the page that owns those params opts in
   * (/progress/body); embedded mounts (/home, goal detail) stay URL-silent. */
  urlState?: boolean;
  /** 00:00-UTC anchor of the member-local today (window math, DSH-60). The
   * owning page passes it; embedded mounts fall back to the UTC day. */
  todayMs?: number;
}) {
  const endDayMs = todayMs ?? utcTodayAnchorMs();

  // Trend is computed over the FULL history so the smoothing never restarts at
  // a range boundary; the window only crops what's drawn.
  const allRows = useMemo<TrendRow[]>(() => ema(points, 10), [points]);

  // Default preset: the tightest TODAY-ANCHORED window actually holding
  // enough points. The legacy hook's own default reasons over the data
  // extent, which lands a stale member on an empty "last 7 days" (round-1
  // finding); windows here end at today (DSH-60), so the default must too.
  const defaultRange = useMemo<RangeKey>(() => {
    for (const key of ["1w", "1m", "3m", "6m", "1y"] as const) {
      const days = RANGE_DAYS[key];
      if (
        days != null &&
        clampToWindow(allRows, windowEndingAt(endDayMs, days)).length >= 8
      ) {
        return key;
      }
    }
    return "all";
  }, [allRows, endDayMs]);

  // URL-synced range STATE (presets + DSH-52 custom window); the drawn window
  // below derives from lib/chart/window.ts so the axis spans the window.
  const { control } = useUrlChartRange(allRows, {
    minPoints: 8,
    enabled: urlState,
    defaultRange,
  });

  const window = useMemo<ChartWindow>(() => {
    if (control.range === "custom" && control.custom) {
      const { from, to } = control.custom;
      return {
        startMs: from,
        endMs: to,
        days: Math.max(1, Math.round((to - from) / MS_PER_DAY)),
      };
    }
    const days = RANGE_DAYS[control.range];
    if (days != null) {
      return windowEndingAt(endDayMs, days);
    }
    return windowFromExtent(points, endDayMs);
  }, [control.range, control.custom, points, endDayMs]);

  const windowRows = useMemo(
    () => clampToWindow(allRows, window),
    [allRows, window]
  );

  const n = points.length;

  const coverage = useMemo<Coverage>(() => {
    const inWindow = points.filter(
      (p) => p.t >= window.startMs && p.t <= window.endMs
    );
    const days = new Set(inWindow.map((p) => Math.floor(p.t / MS_PER_DAY)));
    const spanDays =
      inWindow.length >= 2
        ? Math.round(
            (inWindow[inWindow.length - 1].t - inWindow[0].t) / MS_PER_DAY
          )
        : 0;
    return {
      loggedDays: days.size,
      windowDays: window.days,
      points: inWindow.length,
      spanDays,
    };
  }, [points, window]);

  // ---- Single source of truth: trend-based stats over the selected range ----
  const stats = useMemo(() => {
    // A custom window can hold 0 or 1 weigh-ins; there's nothing honest to
    // compute there (presets always fall back to >= 2 points).
    if (windowRows.length < 2) {
      return null;
    }
    const last = windowRows[windowRows.length - 1];
    const first = windowRows[0];
    const change = round1(last.trend - first.trend);
    const perWeek = round1(ratePerWeek(windowRows));

    // Toward-goal coloring: does the trend move in the goal's direction?
    // Shared with the line color (DSH-50) so the two can never disagree.
    const tone = directionTone(windowRows, goalWeight);

    // Projection: only when we have enough data and a real rate toward goal.
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
  }, [windowRows, goalWeight, n]);

  // How far along the journey to the goal, anchored on the goal's stored start
  // weight and the smoothed TREND weight (the canonical current, LC-4) via the
  // SHARED calc (lib/goals/progress), so this matches the /home goal card
  // exactly (DSH-26). Falls back to the first weigh-in for older goals with no
  // stored start.
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
      return null; // started at goal, nothing meaningful to show
    }
    return { pct: p.pct / 100, reached: p.reached };
  }, [points, allRows, goalWeight, goalStartWeight]);

  if (n === 0) {
    return null; // page renders the empty-state prompt
  }

  const ageDays = Math.max(
    0,
    Math.floor((endDayMs - points[n - 1].t) / MS_PER_DAY)
  );
  const trendTone = TONE_TO_TREND[stats?.tone ?? "neutral"];

  // ---- Compact /home mini view: bare plot, the page supplies the card ------
  if (variant === "compact") {
    if (n === 1) {
      return (
        <p className="py-6 text-center text-muted-foreground text-sm">
          Log another weigh-in to see your trend line.
        </p>
      );
    }
    const compactWindow = windowFromExtent(points, endDayMs);
    const compactTone = TONE_TO_TREND[directionTone(allRows, goalWeight)];
    const reading: MetricReading<number> = loggedReading(
      round1(allRows[allRows.length - 1].trend),
      { coverage, estimated: true, ageDays }
    );
    return (
      <ChartFrame
        chrome={false}
        compact
        height={170}
        reading={reading}
        state={windowRows.length >= 2 ? "populated" : "sparse"}
        summary={buildChartSummary({
          title: "Weight trend",
          rangeLabel: "all time",
          reading,
          unit,
          goal: goalWeight != null ? { value: goalWeight, label: "Goal" } : null,
        })}
        title="Weight trend"
        unit={unit}
      >
        <TrendChart
          compact
          glow
          goal={
            goalWeight != null
              ? { value: goalWeight, label: `Goal ${goalWeight} ${unit}` }
              : null
          }
          points={points.map((p) => ({ t: p.t, value: p.weight }))}
          rawLabel="Weighed in"
          tone={compactTone}
          trendLabel="Trend"
          unit={unit}
          window={compactWindow}
        />
      </ChartFrame>
    );
  }

  // ---- Full /progress/body centerpiece --------------------------------------
  const reached = stats?.toGo != null && Math.abs(stats.toGo) < 0.1;
  const showRate = n >= MIN_FOR_RATE && stats != null;
  const rangeLabel = memberRangeLabel(control.range);

  const reading: MetricReading<number> =
    windowRows.length > 0
      ? loggedReading(round1(windowRows[windowRows.length - 1].trend), {
          coverage,
          estimated: true,
          ageDays,
        })
      : unloggedReading(coverage);

  const state =
    ageDays > STALE_AFTER_DAYS
      ? "stale"
      : windowRows.length >= 2
        ? "populated"
        : "sparse";

  // Goal facts, stated once in the frame's goal line: target, % there, pace.
  const goalText =
    goalWeight == null
      ? undefined
      : [
          `Goal ${goalWeight} ${unit}`,
          reached
            ? "reached 🎯"
            : goalProgress
              ? `${Math.round(goalProgress.pct * 100)}% there`
              : null,
          // A pace projection, not a promise: "at this pace" says exactly
          // what the date is (it shifts with the range window), where the old
          // "on track for" read as on-track-for-the-goal's-own-deadline even
          // when that deadline would be missed (LC-5).
          !reached && stats?.projection
            ? `at this pace: ~${formatProjection(stats.projection.dateMs)}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

  const verdictText =
    goalWeight != null && stats
      ? verdictContent({
          tone: stats.tone,
          change: stats.change,
          unit,
          windowPhrase: verdictWindowPhrase(control.range),
          reached,
        }).text
      : null;

  const summary = buildChartSummary({
    title: "Weight trend",
    rangeLabel,
    reading,
    unit,
    goal: goalWeight != null ? { value: goalWeight, label: "Goal" } : null,
    extra: verdictText ? [verdictText] : undefined,
  });

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Window-following stat tiles, composed at panel level (the /hydration
          pattern); trend weight itself is the frame headline, stated once. */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatTile>
            <Kpi
              help={
                <>
                  How much your trend weight has moved over the selected time
                  window. <span className="text-emerald-500">Green</span> means
                  it's heading toward your goal,{" "}
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
          </StatTile>
          {showRate && (
            <StatTile>
              <Kpi
                help={
                  <>
                    Your average pace: how fast the trend is moving per week
                    over this window. For steady fat loss,{" "}
                    <span className="text-foreground">
                      0.5 to 1% of bodyweight per week
                    </span>{" "}
                    is the usual healthy target.
                  </>
                }
                label="Rate"
                tone={stats.tone}
                value={formatRate(stats.perWeek, unit)}
              />
            </StatTile>
          )}
          {goalWeight != null && stats.toGo != null && (
            <StatTile>
              <Kpi
                help={
                  <>
                    How far your trend weight still is from your goal of{" "}
                    <span className="text-foreground">
                      {goalWeight} {unit}
                    </span>
                    . Once there's enough data, the goal line under the chart
                    shows when you'll reach it if you hold this pace.
                  </>
                }
                label="To goal"
                sub={
                  stats.projection && !reached
                    ? `· ~${formatProjection(stats.projection.dateMs)}`
                    : undefined
                }
                tone={reached ? "good" : "neutral"}
                value={reached ? "Reached 🎯" : `${Math.abs(stats.toGo)} ${unit}`}
              />
            </StatTile>
          )}
        </div>
      )}

      {/* The verdict, in words (DSH-52), with the Ask Chad hook beside it. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {goalWeight != null && stats ? (
          <VerdictLine
            change={stats.change}
            reached={reached}
            tone={stats.tone}
            unit={unit}
            windowPhrase={verdictWindowPhrase(control.range)}
          />
        ) : (
          <span aria-hidden className="min-w-0" />
        )}
        <AskChadButton prompt={ASK_CHAD_PROMPT} />
      </div>

      <ChartFrame
        caption={
          state === "stale"
            ? `Last logged ${formatShortDate(points[n - 1].t)}`
            : undefined
        }
        coverage={coverage}
        goalText={goalText}
        headlineLabel={
          <span className="inline-flex items-center gap-1">
            Trend weight
            <KpiHelp label="Trend weight">
              Your <span className="text-foreground">smoothed</span> weight,
              not today's number on the scale. It averages your last few weeks
              of weigh-ins (newer ones count more) so a salty meal or a
              dehydrated morning doesn't fool you. It moves slowly on purpose:
              after a real change it takes a week or two to catch up, so it can
              sit above or below your latest weigh-ins for a while.{" "}
              <span className="text-foreground">
                This is the number to actually watch.
              </span>
            </KpiHelp>
          </span>
        }
        height={260}
        legend={trendChartLegend(trendTone, {
          raw: "Weighed in",
          trend: "Trend (smoothed)",
          goal: goalWeight != null ? "Goal" : undefined,
        })}
        rangeLabel={rangeLabel}
        rangeSlot={<RangeToggle {...control} />}
        reading={reading}
        state={state}
        summary={summary}
        title="Weight trend"
        unit={unit}
      >
        {windowRows.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-xl bg-surface-inset px-6 text-center">
            <p className="text-body text-muted-foreground">
              No weigh-ins in this date range. Pick a wider window to see the
              trend.
            </p>
          </div>
        ) : (
          <TrendChart
            glow
            goal={
              goalWeight != null
                ? { value: goalWeight, label: `Goal ${goalWeight} ${unit}` }
                : null
            }
            points={points.map((p) => ({ t: p.t, value: p.weight }))}
            rawLabel="Weighed in"
            tone={trendTone}
            trendLabel="Trend"
            unit={unit}
            window={window}
          />
        )}
      </ChartFrame>
    </div>
  );
}

/** The /workouts and /hydration stat-tile treatment: a shared Kpi in a card. */
function StatTile({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5">
      {children}
    </div>
  );
}

/** The verdict's icon/text/tint, shared by the banner and the sr summary. */
function verdictContent({
  tone,
  change,
  unit,
  windowPhrase,
  reached,
}: {
  tone: KpiTone;
  change: number;
  unit: string;
  windowPhrase: string;
  reached: boolean;
}): { icon: ReactNode; text: string; className: string } {
  const moved = `${Math.abs(change)} ${unit} ${change < 0 ? "down" : "up"} ${windowPhrase}`;

  if (reached) {
    return {
      icon: <Trophy className="size-4" />,
      text: "You reached your goal. Time to set the next one.",
      className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-500",
    };
  }
  if (tone === "good") {
    return {
      icon: <Trophy className="size-4" />,
      text: `Trending toward your goal: ${moved}.`,
      className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-500",
    };
  }
  if (tone === "bad") {
    return {
      icon:
        change > 0 ? (
          <TrendingUp className="size-4" />
        ) : (
          <TrendingDown className="size-4" />
        ),
      text: `Moving away from your goal: ${moved}.`,
      className: "border-blood/25 bg-blood-dim text-blood",
    };
  }
  return {
    icon: <Minus className="size-4" />,
    text: `Holding steady: your weight has barely moved ${windowPhrase}.`,
    className: "border-border bg-muted/40 text-muted-foreground",
  };
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
  windowPhrase,
  reached,
}: {
  tone: KpiTone;
  change: number;
  unit: string;
  windowPhrase: string;
  reached: boolean;
}) {
  const { icon, text, className } = verdictContent({
    tone,
    change,
    unit,
    windowPhrase,
    reached,
  });

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-lg border px-3 py-2 font-medium text-sm",
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
