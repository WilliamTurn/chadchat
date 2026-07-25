"use client";

/**
 * PROGRESS > TRAINING (W3 overhaul, 2026-07-25): the client composition,
 * rebuilt to the stats/progress recipe (comp-canon 05 §7) on the ds token
 * layer (globals.css W2 port; this surface is the first member consumer of
 * --f-display per the port plan).
 *
 * Skeleton (comp-canon 05 §7): one global range control governing every
 * windowed view (05 #64, URL-synced as `?range`) → ONE hero insight with a
 * plain-sentence interpretation (05 #61, #65) → an uncontained key-facts
 * band (05 #63) → supporting chart+context zones, each an assembled unit
 * (05 #62) → strength records → the records-and-milestones timeline →
 * links out (05 #67). Zones separate by whitespace and quiet headers only
 * (01 #11 rungs 1-3; gap table 06 #8, --zone-gap); no zone is boxed -
 * static info displays pass no container-earning test (01 §4, north star).
 *
 * The plan-adherence card that used to sit beside consistency was DELETED
 * by owner ruling Q-G, 2026-07-17 ("remove it, no replacement"; register
 * TRN-16) - executed here. The data assembly still computes adherence for
 * its other consumers; this surface no longer renders it.
 *
 * Every displayed number is a registered metric computed by
 * lib/workouts/training-data.ts getTrainingAnalytics (one-canonical-value
 * law); this file is presentation and windowing only.
 */

import { ArrowUpRight, Dumbbell } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { CalendarHeatmap } from "@/components/charts/calendar-heatmap";
import { BreakdownBars } from "@/components/charts/breakdown-bars";
import { ChartFrame } from "@/components/charts/chart-frame";
import { ChartRangeControl } from "@/components/charts/chart-range-control";
import { TrendChart, trendChartLegend } from "@/components/charts/trend-chart";
import { useChartWindow } from "@/components/charts/use-chart-window";
import { PersonalRecords } from "@/components/workouts/personal-records";
import { KpiHelp } from "@/components/dashboard/kpi";
import { MetricValue } from "@/components/dashboard/metric-value";
import { GoalProgressBar, WeekBars } from "@/components/panels/visuals";
import { Button } from "@/components/ui/button";
import { useUrlChartWindow } from "@/hooks/use-url-chart-range";
import { formatShortDate } from "@/lib/chart/format";
import { buildChartSummary } from "@/lib/chart/summary";
import { MS_PER_DAY } from "@/lib/chart/trend";
import { clampToWindow } from "@/lib/chart/window";
import { DOMAIN } from "@/lib/chart/palette";
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
  // consumes this window - comp-canon 05 #64). URL-synced ?range per the
  // mount contract.
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
    <div className="flex flex-col gap-[var(--zone-gap)] pb-24">
      {/* ------------------------------------------------- hero insight zone
          One hero, display scale, with its interpreting sentence (05 #61,
          #65) and the range control that governs the whole surface (05 #64).
          The serif numeral is the ds display face: serif = measured result
          (06 #33/#35); it is the screen's only display element (06 #34). */}
      <section className="flex flex-col items-start gap-4">
        {/* The range control opens the surface (05 §7 skeleton: control at
            top, governing everything below) and stays proximity-bound to
            the hero at every width (F-11/F-17, composition audit). */}
        {!empty && <ChartRangeControl control={control} />}
        {empty ? (
          /* First-run: the empty state takes the hero's position - teach
             content, no display-scale zero (canon 03 §62; 05 #68). Strings:
             member-copy-writer W3. */
          <div className="min-w-0">
            <h2 className="text-card-title">No workouts logged yet</h2>
            <p className="mt-2 max-w-prose text-body text-muted-foreground">
              Finish your first workout and your training numbers start here:
              how often you train, your volume, and every record you set.
            </p>
            <div className="mt-4">
              <StartWorkoutButton />
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            {/* Caps only for the label; the scope stays sentence case
               (Q-DS-4; canon 05 #25). Strings: member-copy-writer W3. */}
            <p className="text-muted-foreground">
              <span className="text-eyebrow">Workouts logged</span>
              <span className="text-meta"> · {control.rangeLabel}</span>
            </p>
            <p className="mt-1 text-display-hero">
              {windowedSessionDays.length}
            </p>
            <p className="mt-2 max-w-prose text-body text-muted-foreground">
              <HeroSentence
                count={windowedSessionDays.length}
                rangeLabel={control.rangeLabel}
                sessionDays={data.sessionDays}
                todayMs={data.todayMs}
                totalSessions={data.totalSessions}
                windowDays={w.days}
              />
            </p>
          </div>
        )}
      </section>

      {/* -------------------------------------------------- key-facts band
          Numbers first, charts second (05 #63): the summary figures as an
          uncontained band - figures + labels, no boxes (rung 0/1; the old
          bordered tile grid was the canonical stats defect, 05 #13). */}
      {/* Two facts only, so no slot ever duplicates the hero's count at any
          range and the band never leaves a half-empty row (composition
          audit F-7/F-14; 02 #12). Workout counts live in the hero and the
          consistency zone; the milestone slot already encodes the all-time
          total as its bar fraction. Value-first so the numerals share one
          baseline across the row (F-6; 06 #29). */}
      <section className="grid max-w-2xl grid-cols-2 gap-x-6 gap-y-5">
        <MetricValue
          help="Volume is the total weight you moved: weight times reps, added up across every set. This is your total for this calendar week."
          label="Volume"
          scope="this week"
          unit="lb"
          value={data.volumeThisWeek}
          valueClassName="text-2xl"
        />
        <NextMilestoneFact
          milestonesReached={data.milestones.length}
          nextMilestone={data.nextMilestone}
        />
      </section>

      {/* ---------------------------------- consistency + muscle focus zones
          Supporting zones may pair two-across on desktop; the hero never
          shares its row (05 #69). Each zone is an assembled chart+context
          unit (05 #62), uncontained (01 §4: no earning test passes for a
          static info display). */}
      <div className="grid grid-cols-1 gap-y-[var(--zone-gap)] xl:grid-cols-12 xl:gap-x-12">
        <div className="min-w-0 xl:col-span-7">
        <ChartFrame
          chrome={false}
          className="min-w-0"
          coverage={coverage}
          /* One CTA per screen: the hero owns "Start a workout" on first
             run; zone empties teach without repeating it (F-2; 08 #51). */
          emptyMessage="Finish your first workout and your training calendar starts filling in."
          /* Days-trained coverage, not the workout count: the hero already
             carries that number, and two zones repeating one figure say
             nothing twice (02 #12). The frame prints the range on its own
             line, so the label never restates it (F-15). */
          headlineLabel={
            windowedSessionDays.length > 0
              ? control.rangeLabel === "all time"
                ? "days trained"
                : `of ${coverage.windowDays} days trained`
              : undefined
          }
          /* The calendar's own height: 7 rows of capped cells (~130px)
             plus breathing room; the week strip lives outside the plot. */
          height={150}
          rangeLabel={control.rangeLabel}
          reading={countReading(coverage.loggedDays, coverage)}
          state={empty ? "empty" : "populated"}
          summary={buildChartSummary({
            title: "Training consistency",
            rangeLabel: control.rangeLabel,
            reading: countReading(coverage.loggedDays, coverage),
            unit: "count",
            extra: [
              `Calendar of training days; ${coverage.loggedDays} of ${coverage.windowDays} days trained`,
            ],
          })}
          title="Training consistency"
          unit="count"
        >
          <CalendarHeatmap
            cells={heatmapCells(data, w)}
            color="var(--progress)"
            maxLevel={2}
            tipLabel="workouts"
            todayMs={data.todayMs}
          />
        </ChartFrame>

        {/* Two figures, one zone: the calendar above is the zone's main
            figure; the 7-day strip (the habit-streak reward, never removed:
            owner law s181) follows under its own quiet eyebrow, so the
            boundary between the figures is named and their scales no longer
            collide inside one plot box (F-1; 01 #12, 06 #14). Width-capped:
            day blocks keep phone proportions, never inflate (07 #17). */}
        {!empty && (
          <div className="mt-5 sm:max-w-xs">
            <p className="text-eyebrow text-muted-foreground">This week</p>
            <WeekBars
              barClassName="bg-[var(--progress)]"
              className="mt-2 h-6"
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
        )}
        </div>

        <MuscleFocusZone
          className="min-w-0 xl:col-span-5"
          data={data}
          empty={empty}
        />
      </div>

      {/* ------------------------------------------------ training volume zone */}
      <ChartFrame
        chrome={false}
        className="min-w-0"
        coverage={coverage}
        emptyMessage="Log weights in a workout and your volume trend starts here."
        headlineLabel="Latest logged day"
        height={240}
        legend={trendChartLegend(
          "neutral",
          { raw: "Daily volume", trend: "Trend (smoothed)" },
          "var(--progress)"
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
          /* Insufficient data renders the zone's frame with a stated
             threshold, uncontained like every sibling state (05 #68;
             peer rule 01 #66/#73). */
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="max-w-sm text-body text-muted-foreground">
              No weighted workouts in this range. Widen the range to see the
              trend.
            </p>
          </div>
        ) : (
          <TrendChart
            color="var(--progress)"
            points={data.volumePoints.map((p) => ({ t: p.t, value: p.volume }))}
            rawLabel="Daily volume"
            tone="neutral"
            trendLabel="Trend"
            unit="lb"
            window={w}
          />
        )}
      </ChartFrame>

      {/* ------------------------------------------------ strength + records
          Zone header on the same rung and grammar as every sibling zone
          (06 #15/#16: one header style per level, headers quiet - no icon
          decoration, 04 §6 #77). The header wraps instead of clipping at
          320-384 (07 #50; burns the smoke clipped-text pin). */}
      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          {/* "Personal records": the one name this component already has on
              /workouts and in the metric registry (canon 04 §132;
              member-copy-writer W3). */}
          <h2 className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-card-title text-muted-foreground">
            <span>Personal records</span>
            <KpiHelp label="Personal records">
              Your best performance on each lift, with records merged across
              name variants of the same exercise. "est. 1RM" is your
              estimated one-rep max, calculated from a set's weight and reps
              with the Epley formula. Select a lift for its strength trend;
              gold dots mark record workouts, and every record links to the
              workout that set it.
            </KpiHelp>
          </h2>
        </div>
        {data.strength.length > 0 ? (
          <PersonalRecords
            prMarkers={prMarkersByExercise(data)}
            records={data.strength}
            todayMs={data.todayMs}
          />
        ) : (
          /* Teach copy only: the hero owns the screen's one CTA (F-2). */
          <div className="flex min-h-36 flex-col items-center justify-center gap-3 px-6 py-8 text-center">
            <p className="max-w-sm text-body text-muted-foreground">
              Lift something and your records land here: best sets, estimated
              1RM, and the strength trend for every exercise.
            </p>
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

      {/* Links out (05 #67). Secondary return action only (rule: analytics
          never force execution). Hidden on first run: every destination is
          empty and the hero owns the screen's one CTA (F-2; 08 #51). */}
      {empty ? null : (
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
        {/* Moved out of the Personal records header: one utility max on a
            header baseline (F-13; 06 #18); it is a links-out slot (05 #67). */}
        <Link
          className="inline-flex min-h-11 items-center gap-1 text-muted-foreground text-sm underline-offset-4 hover:underline sm:min-h-0"
          href="/workouts/exercises"
        >
          Exercise library
          <ArrowUpRight aria-hidden className="size-3.5" />
        </Link>
      </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- sub-zones */

/**
 * The hero's one interpreting sentence (05 #65): a plain statement of what
 * the number means. "About" marks every derived weekly average
 * (estimates-labeled); each figure states unit, period, and basis
 * (numbers-say-what-they-are). Strings: member-copy-writer, W3.
 */
function HeroSentence({
  count,
  windowDays,
  rangeLabel,
  sessionDays,
  totalSessions,
  todayMs,
}: {
  count: number;
  windowDays: number;
  rangeLabel: string;
  sessionDays: readonly { t: number }[];
  totalSessions: number;
  todayMs: number;
}) {
  const firstT = sessionDays.length
    ? Math.min(...sessionDays.map((d) => d.t))
    : null;
  const lastT = sessionDays.length
    ? Math.max(...sessionDays.map((d) => d.t))
    : null;

  if (count === 0) {
    /* Filtered-to-empty says so and offers the way out (canon 03 §66). */
    return (
      <>
        Your last workout was {lastT != null ? formatShortDate(lastT) : "a while ago"}.
        Widen the range to see more.
      </>
    );
  }

  const spanDays =
    firstT != null ? Math.max(1, Math.round((todayMs - firstT) / MS_PER_DAY) + 1) : 1;

  if (rangeLabel === "all time") {
    if (spanDays < 14) {
      /* A weekly claim at under 2 weeks of data is noise: state the
         threshold instead of faking a trend (05 #68). */
      return (
        <>
          {count} {count === 1 ? "workout" : "workouts"} over {spanDays} days so
          far. A weekly average shows up after 2 weeks of logging.
        </>
      );
    }
    const avg = formatAvg(totalSessions / (spanDays / 7));
    return (
      <>
        About {avg.text} {avg.one ? "workout" : "workouts"} a week since your
        first workout on {firstT != null ? formatShortDate(firstT) : "day one"}.
      </>
    );
  }

  if (rangeLabel === "last 7 days") {
    /* Over 7 days the average IS the count; anchor against the all-time
       average instead (05 #62 comparison anchor). */
    if (spanDays >= 14) {
      const avg = formatAvg(totalSessions / (spanDays / 7));
      return (
        <>
          Your all-time average is about {avg.text}{" "}
          {avg.one ? "workout" : "workouts"} a week.
        </>
      );
    }
    return (
      <>
        {count} {count === 1 ? "workout" : "workouts"} in the last 7 days.
      </>
    );
  }

  const avg = formatAvg(count / (windowDays / 7));
  return (
    <>
      About {avg.text} {avg.one ? "workout" : "workouts"} a week across the{" "}
      {rangeLabel}.
    </>
  );
}

/** One-decimal average, integer-flattened ("3.5", "3"); flags exact 1. */
function formatAvg(perWeek: number): { text: string; one: boolean } {
  const rounded = Math.round(perWeek * 10) / 10;
  return { text: String(rounded), one: rounded === 1 };
}

/**
 * Next-milestone fact in the key-facts band. A milestone is a TARGET until
 * it is reached: the bar takes faint white, never gold - gold is earned,
 * never promised (owner ruling 2026-07-19; canon 05 #88; --reward comment
 * in globals.css). Earned milestones keep their gold in the timeline.
 */
function NextMilestoneFact({
  nextMilestone,
  milestonesReached,
}: {
  nextMilestone: { threshold: number; remaining: number } | null;
  milestonesReached: number;
}) {
  /* Caption grammar matches MetricValue's label · scope pieces; the scope
     names the target ("50th workout"). Strings: member-copy-writer W3. */
  const label = nextMilestone ? "Next milestone" : "Milestones reached";
  const scope = nextMilestone
    ? `${ordinalLabel(nextMilestone.threshold)} workout`
    : "all time";
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {nextMilestone ? (
        <span className="font-semibold text-2xl tabular-nums tracking-tight">
          {nextMilestone.remaining}
          <span className="ml-1.5 font-normal text-muted-foreground text-sm">
            {nextMilestone.remaining === 1 ? "workout" : "workouts"} to go
          </span>
        </span>
      ) : (
        <span className="font-semibold text-2xl tabular-nums tracking-tight">
          {milestonesReached}
        </span>
      )}
      <div className="flex items-center gap-1 text-muted-foreground text-xs">
        <span className="min-w-0">
          {label}
          <span className="ml-1 text-muted-foreground/70">· {scope}</span>
        </span>
        <KpiHelp label={`${label} · ${scope}`}>
          Workout-count milestones are earned at real thresholds (10th, 25th,
          50th workout and up). This is your progress toward the next one.
        </KpiHelp>
      </div>
      {nextMilestone && (
        <GoalProgressBar
          className="bg-[var(--faint)]"
          fraction={
            (nextMilestone.threshold - nextMilestone.remaining) /
            nextMilestone.threshold
          }
        />
      )}
    </div>
  );
}

function MuscleFocusZone({
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
      chrome={false}
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
