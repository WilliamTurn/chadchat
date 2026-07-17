"use client";

/**
 * PROGRESS > TRAINING (FIX-33): the client composition. One GLOBAL range
 * control drives every windowed view (the Hevy pattern; per-card range
 * chrome is the failure state the teardown names), URL-synced as `?range`
 * per the mount contract. Sections follow the spec order (doc 03): status,
 * frequency/consistency, plan adherence, volume, muscle focus, strength +
 * records, then the records-and-milestones timeline (the wave's signature
 * reward surface, rewards-timeline.tsx).
 *
 * Every displayed number is a registered metric computed by
 * lib/workouts/training-data.ts getTrainingAnalytics (one-canonical-value
 * law); this file is presentation and windowing only.
 */

import { ArrowUpRight, Dumbbell, Trophy } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { CalendarHeatmap } from "@/components/charts/calendar-heatmap";
import { BreakdownBars } from "@/components/charts/breakdown-bars";
import { ChartFrame } from "@/components/charts/chart-frame";
import { ChartRangeControl } from "@/components/charts/chart-range-control";
import { RingGauge } from "@/components/charts/ring-gauge";
import { TrendChart, trendChartLegend } from "@/components/charts/trend-chart";
import { useChartWindow } from "@/components/charts/use-chart-window";
import { PersonalRecords } from "@/components/workouts/personal-records";
import { KpiHelp } from "@/components/dashboard/kpi";
import { MetricValue } from "@/components/dashboard/metric-value";
import { GoalProgressBar, WeekBars } from "@/components/panels/visuals";
import { Button } from "@/components/ui/button";
import { useUrlChartWindow } from "@/hooks/use-url-chart-range";
import { buildChartSummary } from "@/lib/chart/summary";
import { MS_PER_DAY } from "@/lib/chart/trend";
import { clampToWindow } from "@/lib/chart/window";
import { DOMAIN, GOAL_EMERALD } from "@/lib/chart/palette";
import {
  type Coverage,
  loggedReading,
  type MetricReading,
  unloggedReading,
} from "@/lib/contracts/data-state";
import type { TrainingAnalytics } from "@/lib/workouts/training-data";
import { RewardsTimeline } from "./rewards-timeline";

/** Coverage over window days from per-day session anchors. */
function sessionCoverage(
  days: readonly { t: number }[],
  windowDays: number
): Coverage {
  const distinct = new Set(days.map((d) => d.t));
  const ts = [...distinct];
  return {
    loggedDays: distinct.size,
    windowDays,
    points: days.length,
    spanDays:
      ts.length >= 2 ? Math.round((Math.max(...ts) - Math.min(...ts)) / MS_PER_DAY) : 0,
  };
}

export function TrainingAnalyticsView({
  data,
  urlState = true,
}: {
  data: TrainingAnalytics;
  /** false on harness mounts that render several personas on one page. */
  urlState?: boolean;
}) {
  // THE global range control (one per page; every windowed section below
  // consumes this window). URL-synced ?range per the mount contract.
  const urlWindow = useUrlChartWindow(data.sessionDays, {
    todayMs: data.todayMs,
    minPoints: 6,
  });
  const plainWindow = useChartWindow(data.sessionDays, {
    todayMs: data.todayMs,
    minPoints: 6,
  });
  const { window: w, control } = urlState ? urlWindow : plainWindow;

  const windowedSessionDays = useMemo(
    () => clampToWindow(data.sessionDays, w),
    [data.sessionDays, w]
  );
  const windowedVolume = useMemo(
    () => clampToWindow(data.volumePoints, w),
    [data.volumePoints, w]
  );
  const windowedPrEvents = useMemo(
    () =>
      data.prEvents.filter((e) => {
        const t = new Date(e.performedAt).getTime();
        return t >= w.startMs && t <= w.endMs + MS_PER_DAY - 1;
      }),
    [data.prEvents, w]
  );

  const coverage = sessionCoverage(windowedSessionDays, w.days);

  const empty = data.totalSessions === 0;

  return (
    <div className="flex flex-col gap-8 pb-24">
      {/* ------------------------------------------------------ status band */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <StatTile>
          <MetricValue
            captionFirst
            help="Every workout you have ever finished, all time. The header counts real saved workouts, never estimates."
            label="Workouts logged"
            layout="pieces"
            scope="all time"
            unit="count"
            value={data.totalSessions}
            valueClassName="sm:text-2xl"
          />
        </StatTile>
        <StatTile>
          <MetricValue
            captionFirst
            help="Workouts you logged this calendar week, Sunday through Saturday, in your time zone. Resets every Sunday."
            label={
              data.adherence
                ? `Workouts · ${data.adherence.plannedPerWeek} planned`
                : "Workouts"
            }
            layout="pieces"
            scope="this week"
            unit="count"
            value={data.sessionsThisWeek}
            valueClassName="sm:text-2xl"
          />
        </StatTile>
        <StatTile>
          <MetricValue
            captionFirst
            help="Volume is the total weight you moved: weight times reps, added up across every set. This is your total for this calendar week."
            label="Volume"
            layout="pieces"
            scope="this week"
            unit="lb"
            value={data.volumeThisWeek}
            valueClassName="sm:text-2xl"
          />
        </StatTile>
        <StatTile
          help="Session-count milestones are earned at real thresholds (10th, 25th, 50th workout and up). This is your progress toward the next one."
          label={
            data.nextMilestone
              ? `Next milestone · ${ordinalLabel(data.nextMilestone.threshold)} workout`
              : "Milestones"
          }
        >
          <div className="font-semibold text-xl tracking-tight tabular-nums sm:text-2xl">
            {data.nextMilestone ? (
              <div className="flex w-full flex-col gap-1.5">
                <span className="tabular-nums">
                  {data.nextMilestone.remaining} to go
                </span>
                <GoalProgressBar
                  className="bg-[var(--chart-3)]"
                  fraction={
                    (data.nextMilestone.threshold -
                      data.nextMilestone.remaining) /
                    data.nextMilestone.threshold
                  }
                />
              </div>
            ) : (
              <span className="tabular-nums">{data.milestones.length}</span>
            )}
          </div>
        </StatTile>
      </div>

      {/* ------------------------------------------- global range + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-body-sm text-muted-foreground">
          {windowedSessionDays.length > 0
            ? `${windowedSessionDays.length} ${windowedSessionDays.length === 1 ? "session" : "sessions"} ${inRange(control.rangeLabel)}`
            : `No sessions ${inRange(control.rangeLabel)}`}
        </p>
        <ChartRangeControl control={control} />
      </div>

      {/* -------------------------------------- consistency + plan adherence */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <ChartFrame
          className="min-w-0 xl:col-span-7"
          coverage={coverage}
          emptyMessage="Finish your first workout and your training calendar starts filling in."
          emptyAction={<StartWorkoutButton />}
          headlineLabel={
            windowedSessionDays.length > 0 ? "sessions in range" : undefined
          }
          height={204}
          rangeLabel={control.rangeLabel}
          reading={countReading(windowedSessionDays.length, coverage)}
          state={empty ? "empty" : "populated"}
          summary={buildChartSummary({
            title: "Training consistency",
            rangeLabel: control.rangeLabel,
            reading: countReading(windowedSessionDays.length, coverage),
            unit: "count",
            extra: [
              `Calendar of training days; ${coverage.loggedDays} of ${coverage.windowDays} days trained`,
            ],
          })}
          title="Training consistency"
          unit="count"
        >
          <div className="flex h-full flex-col justify-between gap-4">
            <CalendarHeatmap
              cells={heatmapCells(data, w)}
              color={DOMAIN.training}
              maxLevel={2}
              tipLabel="sessions"
              todayMs={data.todayMs}
            />
            {/* The 7-day strip: the habit-streak reward, never removed
                (owner law s181); the calendar is the chart beside it. */}
            <div>
              <WeekBars
                barClassName="bg-[var(--chart-5)]"
                className="h-8"
                days={data.week.map((d) => ({
                  key: d.t,
                  fraction: d.count > 0 ? Math.min(d.count / 2 + 0.5, 1) : null,
                  isToday: d.isToday,
                  isFuture: d.isFuture,
                }))}
              />
              <div className="mt-1 flex gap-1.5">
                {data.week.map((d) => (
                  <span
                    className={`flex-1 text-center text-meta leading-none ${d.isToday ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                    key={d.t}
                  >
                    {d.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </ChartFrame>

        <AdherenceCard adherence={data.adherence} className="min-w-0 xl:col-span-5" />
      </div>

      {/* --------------------------------------------- volume + muscle focus */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <ChartFrame
          className="min-w-0 xl:col-span-7"
          coverage={coverage}
          emptyMessage="Log weights in a workout and your volume trend starts here."
          emptyAction={<StartWorkoutButton />}
          headlineLabel="Latest logged day"
          height={240}
          legend={trendChartLegend(
            "neutral",
            { raw: "Daily volume", trend: "Trend (smoothed)" },
            DOMAIN.training
          )}
          rangeLabel={control.rangeLabel}
          reading={volumeReading(windowedVolume, coverage, data.todayMs)}
          state={
            empty || data.volumePoints.length === 0
              ? "empty"
              : windowedVolume.length < 3
                ? "sparse"
                : "populated"
          }
          summary={buildChartSummary({
            title: "Training volume",
            rangeLabel: control.rangeLabel,
            reading: volumeReading(windowedVolume, coverage, data.todayMs),
            unit: "lb",
          })}
          title="Training volume"
          unit="lb"
        >
          {windowedVolume.length === 0 ? (
            <div className="flex h-full items-center justify-center rounded-xl bg-surface-inset px-6 text-center">
              <p className="text-body text-muted-foreground">
                No weighted sessions in this range. Pick a wider window to see
                the trend.
              </p>
            </div>
          ) : (
            <TrendChart
              color={DOMAIN.training}
              points={data.volumePoints.map((p) => ({ t: p.t, value: p.volume }))}
              rawLabel="Daily volume"
              tone="neutral"
              trendLabel="Trend"
              unit="lb"
              window={w}
            />
          )}
        </ChartFrame>

        <MuscleFocusCard
          className="min-w-0 xl:col-span-5"
          data={data}
          empty={empty}
        />
      </div>

      {/* ------------------------------------------------ strength + records */}
      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
            <Trophy className="size-4 text-amber-500" />
            Strength and records
            <KpiHelp label="Strength and records">
              Your best performance on each lift, with records merged across
              name variants of the same exercise. "est. 1RM" is your
              estimated one-rep max, calculated from a set's weight and reps
              with the Epley formula. Tap a lift for its strength trend; gold
              dots mark record sessions, and every record links to the
              workout that set it.
            </KpiHelp>
          </h2>
          <Link
            className="inline-flex min-h-11 items-center gap-1 text-muted-foreground text-xs underline-offset-4 hover:underline sm:min-h-0"
            href="/workouts/exercises"
          >
            Exercise library
            <ArrowUpRight aria-hidden className="size-3.5" />
          </Link>
        </div>
        {data.strength.length > 0 ? (
          <PersonalRecords
            prMarkers={prMarkersByExercise(data)}
            records={data.strength}
            todayMs={data.todayMs}
          />
        ) : (
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 rounded-xl bg-surface-inset px-6 py-8 text-center">
            <p className="max-w-sm text-body text-muted-foreground">
              Lift something and your records land here: best sets, estimated
              1RM, and the strength trend for every exercise.
            </p>
            <StartWorkoutButton />
          </div>
        )}
      </section>

      {/* --------------------------- records & milestones (signature reward) */}
      <RewardsTimeline
        milestones={data.milestones}
        nextMilestone={data.nextMilestone}
        prEvents={windowedPrEvents}
        rangeLabel={control.rangeLabel}
        todayMs={data.todayMs}
        totalPrEvents={data.prEvents.length}
      />

      {/* Secondary return action only (rule: analytics never force execution). */}
      <div className="flex flex-wrap items-center gap-4">
        <Button
          asChild
          className="pointer-coarse:min-h-11"
          variant="outline"
        >
          <Link href="/workouts">
            <Dumbbell aria-hidden className="size-4" />
            Start a workout
          </Link>
        </Button>
        <Link
          className="inline-flex min-h-11 items-center gap-1 text-muted-foreground text-sm underline-offset-4 hover:underline sm:min-h-0"
          href="/workouts/history"
        >
          Full workout history
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- sub-cards */

function AdherenceCard({
  adherence,
  className,
}: {
  adherence: TrainingAnalytics["adherence"];
  className?: string;
}) {
  const reading = adherence
    ? loggedReading(adherence.completedThisWeek, {
        coverage: {
          loggedDays: adherence.completedThisWeek,
          windowDays: 7,
          points: adherence.completedThisWeek,
          spanDays: 0,
        },
      })
    : unloggedReading();

  const recentWeeks = adherence ? adherence.weekly.slice(-8) : [];

  return (
    <ChartFrame
      className={className}
      emptyMessage="Adherence unlocks when a structured training plan is active: each week scores your completed sessions against the plan."
      goalText={
        adherence ? `Plan: ${adherence.plannedPerWeek} sessions a week` : undefined
      }
      headlineLabel={
        adherence ? `of ${adherence.plannedPerWeek} planned this week` : undefined
      }
      height={204}
      rangeLabel="this week"
      reading={reading}
      state={adherence ? "populated" : "empty"}
      summary={
        adherence
          ? buildChartSummary({
              title: "Plan adherence",
              rangeLabel: "this week",
              reading,
              unit: "count",
              extra: [
                `${adherence.completedThisWeek} of ${adherence.plannedPerWeek} planned sessions completed`,
                `${recentWeeks.filter((w) => w.planned > 0 && w.completed >= w.planned).length} perfect weeks in the last ${recentWeeks.length}`,
              ],
            })
          : "Plan adherence: no structured training plan active."
      }
      title="Plan adherence"
      unit="count"
    >
      {adherence ? (
        <div className="flex h-full flex-col justify-center gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <RingGauge
            color={
              adherence.completedThisWeek >= adherence.plannedPerWeek
                ? GOAL_EMERALD
                : DOMAIN.training
            }
            fraction={
              adherence.plannedPerWeek > 0
                ? adherence.completedThisWeek / adherence.plannedPerWeek
                : 0
            }
            size={120}
            strokeWidth={11}
          >
            <div className="flex flex-col items-center leading-none">
              <span className="font-semibold text-2xl tabular-nums">
                {adherence.completedThisWeek}
                <span className="text-muted-foreground text-sm">
                  /{adherence.plannedPerWeek}
                </span>
              </span>
              <span className="mt-1 text-meta text-muted-foreground uppercase tracking-wide">
                this week
              </span>
            </div>
          </RingGauge>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="text-meta text-muted-foreground">
              {recentWeeks.length === 1
                ? "This week"
                : `Last ${recentWeeks.length} weeks`}
            </span>
            <div className="flex flex-wrap items-end gap-1.5">
              {recentWeeks.map((week) => {
                const perfect = week.planned > 0 && week.completed >= week.planned;
                return (
                  <div
                    className="flex flex-1 flex-col items-center gap-1"
                    key={week.t}
                    title={`Week of ${new Date(week.t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}: ${week.completed} of ${week.planned}`}
                  >
                    <RingGauge
                      color={perfect ? GOAL_EMERALD : DOMAIN.training}
                      fraction={week.planned > 0 ? week.completed / week.planned : 0}
                      size={26}
                      strokeWidth={4}
                    />
                  </div>
                );
              })}
            </div>
            <span className="text-meta text-muted-foreground">
              A full ring is a perfect plan week.
            </span>
          </div>
        </div>
      ) : (
        <div />
      )}
    </ChartFrame>
  );
}

function MuscleFocusCard({
  data,
  empty,
  className,
}: {
  data: TrainingAnalytics;
  empty: boolean;
  className?: string;
}) {
  const specified = data.muscleGroups.filter(
    (g) => g.muscleGroup !== "unspecified"
  );
  const unspecified = data.muscleGroups.find(
    (g) => g.muscleGroup === "unspecified"
  );
  const totalSets = data.muscleGroups.reduce((s, g) => s + g.sets, 0);
  // Claims discipline (metric derivation): show the split only when
  // muscle-tagged rows dominate; otherwise the split would misread.
  const supported =
    specified.length >= 2 &&
    totalSets > 0 &&
    (unspecified?.sets ?? 0) / totalSets <= 0.4;

  const coverage: Coverage = {
    loggedDays: 0,
    windowDays: 0,
    points: totalSets,
    spanDays: 0,
  };
  const reading =
    totalSets > 0
      ? loggedReading(totalSets, { coverage })
      : unloggedReading(coverage);

  return (
    <ChartFrame
      className={className}
      caption={
        supported && unspecified
          ? `${unspecified.sets} sets have no muscle tag and are counted under Other.`
          : undefined
      }
      emptyMessage={
        empty
          ? "Train and your working sets get counted per muscle group here."
          : "Not enough muscle-tagged sets yet to show a trustworthy split. Pick exercises from the library and this fills in."
      }
      headlineLabel="working sets, all time"
      height={200}
      reading={reading}
      state={supported ? "populated" : "empty"}
      summary={buildChartSummary({
        title: "Muscle focus",
        rangeLabel: "all time",
        reading,
        unit: "count",
        extra: specified
          .slice(0, 3)
          .map((g) => `${muscleLabel(g.muscleGroup)} ${g.sets} sets`),
      })}
      title="Muscle focus"
      unit="count"
    >
      <BreakdownBars
        color={DOMAIN.training}
        formatValue={(v) => `${v} ${v === 1 ? "set" : "sets"}`}
        maxRows={6}
        rows={[
          ...specified.map((g) => ({
            label: muscleLabel(g.muscleGroup),
            value: g.sets,
          })),
          ...(unspecified
            ? [{ label: "Other", value: unspecified.sets }]
            : []),
        ]}
      />
    </ChartFrame>
  );
}

/* ---------------------------------------------------------------- helpers */

/** The status-band tile shell. Numeric tiles pass a scope-required
 *  {@link MetricValue} (RC-8) as their only child; the milestone tile, which
 *  renders a progress bar rather than a single number, keeps `label`/`help`. */
function StatTile({
  label,
  help,
  children,
}: {
  label?: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-1 rounded-xl border border-border bg-surface-card px-4 py-3.5">
      {label != null && (
        <div className="flex items-center gap-1 text-muted-foreground text-xs">
          {label}
          {help && <KpiHelp label={label}>{help}</KpiHelp>}
        </div>
      )}
      {children}
    </div>
  );
}

function StartWorkoutButton() {
  return (
    <Button
      asChild
      className="pointer-coarse:min-h-11"
      size="sm"
      variant="outline"
    >
      <Link href="/workouts">Start a workout</Link>
    </Button>
  );
}

function countReading(
  count: number,
  coverage: Coverage
): MetricReading<number> {
  // Counts of logged events render zero truthfully (registry carve-out).
  return loggedReading(count, { coverage });
}

function volumeReading(
  windowedVolume: readonly { t: number; volume: number }[],
  coverage: Coverage,
  todayMs: number
): MetricReading<number> {
  const latest = windowedVolume.at(-1);
  if (!latest) {
    return unloggedReading(coverage);
  }
  return loggedReading(latest.volume, {
    coverage,
    ageDays: Math.max(0, Math.round((todayMs - latest.t) / MS_PER_DAY)),
  });
}

function heatmapCells(data: TrainingAnalytics, w: { startMs: number; endMs: number }) {
  const counts = new Map<number, number>();
  for (const d of data.sessionDays) {
    counts.set(d.t, (counts.get(d.t) ?? 0) + 1);
  }
  const cells = [];
  for (let t = w.startMs; t <= w.endMs; t += MS_PER_DAY) {
    const count = counts.get(t);
    cells.push({ t, level: count == null ? null : Math.min(count, 2) });
  }
  return cells;
}

function prMarkersByExercise(data: TrainingAnalytics): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const e of data.prEvents) {
    if (!e.beatE1rm) {
      continue;
    }
    const t = new Date(e.performedAt).getTime();
    const list = (out[e.exerciseName] ??= []);
    if (!list.includes(t)) {
      list.push(t);
    }
  }
  return out;
}

/** "in the last 30 days" / "all time" (never "in the all time"). */
function inRange(rangeLabel: string): string {
  return rangeLabel === "all time" ? "all time" : `in the ${rangeLabel}`;
}

function ordinalLabel(n: number): string {
  const tail = n % 100;
  if (tail >= 11 && tail <= 13) {
    return `${n}th`;
  }
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

function muscleLabel(slug: string): string {
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}
