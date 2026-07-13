import {
  CalendarCheck,
  Droplets,
  Lightbulb,
  Moon,
  Scale,
  TrendingUp,
  Trophy,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { PanelEmptySpec } from "@/components/panels/panel-frame";
import {
  InsightPanel,
  MilestonePanel,
  PlanPanel,
  QuickLogPanel,
  StatusPanel,
  SummaryPanel,
  TrendPanel,
} from "@/components/panels/roles";
import {
  type DayBar,
  DeltaTag,
  MiniBars,
  PanelSparkline,
  ProgressRing,
  type SparkPoint,
  WeekBars,
} from "@/components/panels/visuals";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { WeekStrip } from "@/components/today/week-strip";
import type { PanelState } from "@/lib/contracts/data-state";
import { formatCoverage } from "@/lib/contracts/data-state";
import {
  formatMinutesAsDuration,
  formatQuantity,
  mlToOz,
} from "@/lib/contracts/units";
import {
  FIXTURE_TIMEZONE,
  fixtureDayAnchorMs,
  fixtureInstant,
  type Persona,
} from "@/tests/fixtures/dashboard-states";

/**
 * PANEL ROLE DEMOS (P2-B harness renderers). One real domain instance per
 * role, fed ONLY by the deterministic fixture personas, registered in
 * components/dev/fixture-registry.tsx so the /dev/fixtures/roles matrix and
 * the /dev/fixtures/panels composition page render real components.
 *
 * State honesty: the matrix forces a target state; each demo renders that
 * state the way the live dashboard would for this persona (designed compact
 * empty, facts + coverage when sparse, DATED values when stale, hollow slots
 * for unlogged days). When a persona has no data for a data-bearing state,
 * the demo renders the designed empty variant rather than inventing values.
 */

const DAY_MS = 86_400_000;

function daysAgoOf(ms: number): number {
  return Math.round((fixtureDayAnchorMs(0) - ms) / DAY_MS);
}

/** "Jun 26" for a fixture day offset, in the fixture member's timezone. */
function shortDate(daysAgo: number): string {
  return fixtureInstant(daysAgo).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: FIXTURE_TIMEZONE,
  });
}

/** This fixture week, Sunday-start (today = Wed Jul 8): offsets 3..-3. */
const WEEK_OFFSETS = [3, 2, 1, 0, -1, -2, -3] as const;
const WEEK_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

function weekDateLabel(offset: number): string {
  return fixtureInstant(offset).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: FIXTURE_TIMEZONE,
  });
}

/** Data states need data; a persona without any renders the designed empty. */
function effectiveState(state: PanelState, hasData: boolean): PanelState {
  const dataStates: PanelState[] = ["sparse", "stale", "populated"];
  return dataStates.includes(state) && !hasData ? "empty" : state;
}

function quietAction(label: string, href: string) {
  return (
    <Button
      asChild
      className="min-h-11 sm:min-h-8"
      size="sm"
      variant="outline"
    >
      <Link href={href}>{label}</Link>
    </Button>
  );
}

function retry() {
  return (
    <Button size="sm" variant="outline">
      Try again
    </Button>
  );
}

/* ----------------------------------------------------------------- status */

export function StatusCaloriesDemo({
  persona,
  state,
}: {
  persona: Persona;
  state: PanelState;
}) {
  const target = persona.nutritionTarget?.calories ?? 2300;
  const byDay = new Map<number, number>();
  for (const m of persona.meals) {
    const d = daysAgoOf(m.recordedAt.getTime());
    byDay.set(d, (byDay.get(d) ?? 0) + m.calories);
  }
  const today = byDay.get(0);
  const lastDay = persona.meals.length
    ? Math.min(...persona.meals.map((m) => daysAgoOf(m.recordedAt.getTime())))
    : null;
  const resolved = effectiveState(
    state,
    state === "stale" ? lastDay != null && lastDay > 0 : today != null
  );

  const empty: PanelEmptySpec = {
    absent: persona.firstRun
      ? "No meals logged yet."
      : "Nothing logged yet today.",
    unlock: "Log a meal to see today's total.",
    visual: (
      <ProgressRing
        className="text-muted-foreground"
        fraction={0}
        label=""
        size={36}
      />
    ),
  };

  const isStale = resolved === "stale" && lastDay != null;
  const kcal = isStale ? (byDay.get(lastDay) ?? 0) : (today ?? 0);
  const over = kcal > target;

  return (
    <StatusPanel
      detailLink={{ label: "Nutrition history", href: "/nutrition" }}
      empty={empty}
      headline={formatQuantity(kcal, "kcal")}
      icon={<UtensilsCrossed className="size-4" />}
      lockedCapability="Pro members track calories and macros against a daily target, meal by meal."
      retryAction={retry()}
      state={resolved}
      targetContext={
        isStale
          ? `Last logged ${shortDate(lastDay)}`
          : `of ${formatQuantity(target, "kcal")}`
      }
      title="Calories today"
      tone="amber"
      visual={
        <ProgressRing
          className={
            isStale
              ? "text-muted-foreground"
              : over
                ? "text-attention-text"
                : "text-positive-text"
          }
          fraction={kcal / target}
          size={44}
        />
      }
    />
  );
}

/* -------------------------------------------------------------- quick-log */

export function QuickLogHydrationDemo({
  persona,
  state,
}: {
  persona: Persona;
  state: PanelState;
}) {
  const goalMl = persona.waterGoalMl;
  const byDay = new Map<number, number>();
  for (const d of persona.waterDaily) {
    byDay.set(daysAgoOf(d.t), d.ml);
  }
  const todayMl = byDay.get(0);
  const lastDay = persona.waterDaily.length
    ? Math.min(...persona.waterDaily.map((d) => daysAgoOf(d.t)))
    : null;
  const resolved = effectiveState(
    state,
    state === "stale" ? lastDay != null && lastDay > 0 : todayMl != null
  );
  const isStale = resolved === "stale" && lastDay != null;

  const strip = (
    <WeekStrip
      days={WEEK_OFFSETS.map((offset, i) => {
        const ml = byDay.get(offset);
        return {
          key: offset,
          label: WEEK_LABELS[i],
          dateLabel: weekDateLabel(offset),
          isToday: offset === 0,
          isFuture: offset < 0,
          dotClassName:
            ml != null
              ? ml >= goalMl
                ? "bg-sky-400"
                : "bg-sky-400/40"
              : "bg-border",
          value:
            ml != null ? formatQuantity(mlToOz(ml), "oz") : "Nothing logged",
          status: ml != null && ml >= goalMl ? "Goal hit" : undefined,
        };
      })}
    />
  );

  const bars: DayBar[] = WEEK_OFFSETS.map((offset) => {
    const ml = byDay.get(offset);
    return {
      key: offset,
      fraction: ml != null ? ml / goalMl : null,
      isToday: offset === 0,
      isFuture: offset < 0,
    };
  });

  return (
    <QuickLogPanel
      detailLink={{ label: "Hydration history", href: "/hydration" }}
      empty={{
        absent: persona.firstRun
          ? "No water logged yet."
          : "Nothing logged yet today.",
        unlock: "One tap adds a glass; the week fills in as you go.",
        visual: strip,
        action: quietAction("Log water", "/hydration"),
      }}
      footer={{
        askChad: (
          <AskChadButton
            className="min-h-11 sm:min-h-8"
            prompt="How is my hydration looking this week?"
          />
        ),
        primary: { label: "Log water", href: "/hydration" },
        overflow: [{ label: "Edit water goal", href: "/hydration" }],
      }}
      headline={formatQuantity(
        mlToOz(isStale ? (byDay.get(lastDay) ?? 0) : (todayMl ?? 0)),
        "oz"
      )}
      icon={<Droplets className="size-4" />}
      lockedCapability="Pro members log water in one tap and see the week against a daily goal."
      retryAction={retry()}
      state={resolved}
      targetContext={
        isStale
          ? `Last logged ${shortDate(lastDay)}`
          : `of ${formatQuantity(mlToOz(goalMl), "oz")} goal`
      }
      title="Water"
      tone="sky"
      visual={<WeekBars barClassName="bg-sky-400" days={bars} />}
      weekStrip={strip}
    />
  );
}

/* ------------------------------------------------------------------ trend */

const TREND_WINDOW_DAYS = 28;

export function TrendWeightDemo({
  persona,
  state,
}: {
  persona: Persona;
  state: PanelState;
}) {
  const goal = persona.goal;
  const inWindow = persona.weighIns
    .map((w) => ({ daysAgo: daysAgoOf(w.t), weight: w.weight }))
    .filter((w) => w.daysAgo >= 0 && w.daysAgo < TREND_WINDOW_DAYS)
    .sort((a, b) => b.daysAgo - a.daysAgo);
  const resolved = effectiveState(state, inWindow.length > 0);

  const points: SparkPoint[] = inWindow.map((w) => ({
    x: (TREND_WINDOW_DAYS - 1 - w.daysAgo) / (TREND_WINDOW_DAYS - 1),
    value: w.weight,
  }));
  const latest = inWindow.at(-1);
  const first = inWindow.at(0);
  const loggedDays = new Set(inWindow.map((w) => w.daysAgo)).size;

  const towardGoal =
    goal && latest && first
      ? Math.abs(latest.weight - goal.targetValue) <=
        Math.abs(first.weight - goal.targetValue)
      : true;
  const delta =
    latest && first && inWindow.length >= 2
      ? Math.round((latest.weight - first.weight) * 10) / 10
      : null;
  const isStale = resolved === "stale" && latest != null;

  return (
    <TrendPanel
      coverage={formatCoverage({
        loggedDays,
        windowDays: TREND_WINDOW_DAYS,
        points: inWindow.length,
        spanDays:
          inWindow.length >= 2
            ? (first?.daysAgo ?? 0) - (latest?.daysAgo ?? 0)
            : 0,
      })}
      detailLink={{ label: "Weight trends", href: "/progress" }}
      empty={{
        absent: "No weigh-ins yet.",
        unlock:
          "Log at least 3 weigh-ins across a week to unlock your trend line.",
        visual: (
          <PanelSparkline
            className="text-muted-foreground"
            goal={goal?.targetValue ?? 1}
            height={32}
            points={[]}
          />
        ),
        action: quietAction("Log a weigh-in", "/progress"),
      }}
      footer={{
        askChad: (
          <AskChadButton
            className="min-h-11 sm:min-h-8"
            prompt="How is my weight trend going?"
          />
        ),
        primary: { label: "Log a weigh-in", href: "/progress" },
      }}
      headline={latest ? formatQuantity(latest.weight, "lb") : ""}
      icon={<Scale className="size-4" />}
      lockedCapability="Pro members see their weight trend against their goal line, weigh-in by weigh-in."
      retryAction={retry()}
      state={resolved}
      targetContext={
        isStale ? (
          `Last weigh-in ${shortDate(latest.daysAgo)}`
        ) : resolved === "populated" && delta != null ? (
          <DeltaTag
            direction={towardGoal ? "positive" : "critical"}
            text={`${delta > 0 ? "+" : ""}${delta} lb in ${TREND_WINDOW_DAYS} days`}
          />
        ) : first && latest ? (
          `first weigh-in ${shortDate(first.daysAgo)}`
        ) : undefined
      }
      title="Weight trend"
      tone="emerald"
      visual={
        <PanelSparkline
          className={towardGoal ? "text-emerald-500" : "text-blood"}
          goal={goal?.targetValue}
          points={points}
        />
      }
    />
  );
}

/* ------------------------------------------------------------------- plan */

export function PlanTrainingDemo({
  persona,
  state,
}: {
  persona: Persona;
  state: PanelState;
}) {
  const doneDays = new Set(
    persona.workouts.map((w) => daysAgoOf(new Date(w.performedAt).getTime()))
  );
  // The fixture plan trains Mon / Wed / Fri (offsets 2, 0, -2 this week).
  const plannedOffsets = new Set([2, 0, -2]);
  const doneThisWeek = [3, 2, 1, 0].filter((o) => doneDays.has(o)).length;
  const nextTitle = persona.workouts.at(-1)?.title ?? "Upper A";
  const resolved = effectiveState(state, persona.workouts.length > 0);

  const bars: DayBar[] = WEEK_OFFSETS.map((offset) => ({
    key: offset,
    fraction:
      doneDays.has(offset) && offset >= 0
        ? 1
        : plannedOffsets.has(offset)
          ? null
          : 0.08,
    isToday: offset === 0,
    isFuture: offset < 0,
  }));

  return (
    <PlanPanel
      detailLink={{ label: "Workout plan", href: "/workouts" }}
      empty={{
        absent: "No training plan yet.",
        unlock: "Tell Chad your goal and he builds your first training week.",
        visual: (
          <WeekBars
            className="h-6"
            days={WEEK_OFFSETS.map((offset) => ({
              key: offset,
              fraction: null,
              isToday: offset === 0,
              isFuture: offset < 0,
            }))}
          />
        ),
        action: quietAction("Start a workout", "/workouts"),
      }}
      footer={{
        askChad: (
          <AskChadButton
            className="min-h-11 sm:min-h-8"
            prompt="What should I train today?"
          />
        ),
        primary: { label: "Start a workout", href: "/workouts" },
      }}
      headline={nextTitle}
      icon={<CalendarCheck className="size-4" />}
      lockedCapability="Pro members get a training plan Chad builds and adjusts week to week."
      retryAction={retry()}
      state={resolved}
      title="Today's training"
      tone="blood"
      visual={
        <div className="flex flex-col gap-2">
          <WeekBars barClassName="bg-blood" days={bars} />
          <p className="text-meta text-muted-foreground">
            {doneThisWeek} of 3 sessions done this week
          </p>
        </div>
      }
    />
  );
}

/* ---------------------------------------------------------------- insight */

export function InsightProteinDemo({
  persona,
  state,
}: {
  persona: Persona;
  state: PanelState;
}) {
  const target = persona.nutritionTarget?.protein ?? 190;
  const byDay = new Map<number, number>();
  for (const m of persona.meals) {
    const d = daysAgoOf(m.recordedAt.getTime());
    if (d >= 0 && d < 7) {
      byDay.set(d, (byDay.get(d) ?? 0) + m.protein);
    }
  }
  const days = [...byDay.entries()].sort((a, b) => b[0] - a[0]);
  const loggedDays = days.length;
  const resolved = effectiveState(state, loggedDays > 0);
  const avg =
    loggedDays > 0
      ? Math.round(days.reduce((s, [, g]) => s + g, 0) / loggedDays)
      : null;
  const short = avg != null ? target - avg : null;
  const canClaim = resolved === "populated" && loggedDays >= 4 && short != null;

  return (
    <InsightPanel
      coverage={formatCoverage({
        loggedDays,
        windowDays: 7,
        points: loggedDays,
        spanDays:
          loggedDays >= 2 ? days[0][0] - (days.at(-1)?.[0] ?? days[0][0]) : 0,
      })}
      empty={{
        absent: "No insight yet.",
        unlock: "Log meals for a few days and observations appear here.",
        visual: (
          <MiniBars className="h-6" hollow values={[1, 1, 1, 1, 1, 1, 1]} />
        ),
      }}
      footer={{
        askChad: (
          <AskChadButton
            className="min-h-11 sm:min-h-8"
            prompt="How can I hit my protein target?"
          />
        ),
      }}
      headline={
        canClaim ? (
          <>
            {formatQuantity(Math.abs(short as number), "g")}{" "}
            <span className="text-muted-foreground">
              {(short as number) > 0 ? "under" : "over"}
            </span>
          </>
        ) : (
          formatQuantity(avg ?? 0, "g")
        )
      }
      icon={<Lightbulb className="size-4" />}
      lockedCapability="Pro members get one evidence-backed observation from each week of logs."
      retryAction={retry()}
      state={resolved}
      title="Protein this week"
      tone="violet"
      visual={
        <MiniBars
          barClassName="bg-violet-400"
          values={days.length ? days.map(([, g]) => g) : [1]}
        />
      }
    />
  );
}

/* -------------------------------------------------------------- milestone */

export function MilestonePrDemo({
  persona,
  state,
}: {
  persona: Persona;
  state: PanelState;
}) {
  const benchTops = persona.workouts
    .map((w) => {
      const sets = w.exercises
        .filter((e) => e.name === "Bench Press")
        .flatMap((e) => e.sets);
      const top = Math.max(...sets.map((s) => s.weight ?? 0), 0);
      const reps =
        sets.find((s) => (s.weight ?? 0) === top && s.setType === "working")
          ?.reps ?? sets.find((s) => (s.weight ?? 0) === top)?.reps;
      return {
        daysAgo: daysAgoOf(new Date(w.performedAt).getTime()),
        top,
        reps,
      };
    })
    .filter((w) => w.top > 0)
    .sort((a, b) => b.daysAgo - a.daysAgo);

  const progression = benchTops.map((w) => w.top);
  const pr = progression.length ? Math.max(...progression) : null;
  const prReps = benchTops.at(-1)?.reps;
  const hasPr =
    pr != null && progression.at(-1) === pr && progression.length >= 2;
  const resolved = effectiveState(state, pr != null);

  return (
    <MilestonePanel
      detailLink={{ label: "Workout history", href: "/workouts" }}
      empty={{
        absent: "No records yet.",
        unlock: "Log workouts and your first record lands here.",
        visual: <MiniBars className="h-6" hollow values={[1, 1, 1, 1]} />,
      }}
      headline={
        hasPr ? (
          <>
            New PR: Bench {formatQuantity(pr, "lb")}
            {prReps != null ? ` x ${prReps}` : ""}
          </>
        ) : (
          <>Best bench: {formatQuantity(pr ?? 0, "lb")}</>
        )
      }
      icon={<Trophy className="size-4" />}
      lockedCapability="Pro members get PRs and streak milestones spotted and celebrated as they happen."
      retryAction={retry()}
      state={resolved}
      title="Milestone"
      tone="blood"
      visual={
        <MiniBars
          barClassName="bg-blood"
          highlightLast
          values={progression.length ? progression.slice(-6) : [1]}
        />
      }
    />
  );
}

/* ---------------------------------------------------------------- summary */

export function SummaryProgressDemo({
  persona,
  state,
}: {
  persona: Persona;
  state: PanelState;
}) {
  const inWindow = persona.weighIns
    .map((w) => ({ daysAgo: daysAgoOf(w.t), weight: w.weight }))
    .filter((w) => w.daysAgo >= 0 && w.daysAgo < TREND_WINDOW_DAYS)
    .sort((a, b) => b.daysAgo - a.daysAgo);
  const first = inWindow.at(0);
  const latest = inWindow.at(-1);
  const resolved = effectiveState(state, latest != null);
  const delta =
    first && latest && inWindow.length >= 3
      ? Math.round((first.weight - latest.weight) * 10) / 10
      : null;

  const points: SparkPoint[] = inWindow.map((w) => ({
    x: (TREND_WINDOW_DAYS - 1 - w.daysAgo) / (TREND_WINDOW_DAYS - 1),
    value: w.weight,
  }));

  return (
    <SummaryPanel
      detailLink={{ label: "Progress overview", href: "/progress" }}
      empty={{
        absent: "No progress data yet.",
        unlock: "Log weigh-ins and workouts to see highlights here.",
        visual: (
          <ProgressRing
            className="text-muted-foreground"
            fraction={0}
            label=""
            size={36}
          />
        ),
      }}
      headline={
        delta != null && resolved === "populated" ? (
          <>
            {delta >= 0 ? "Down" : "Up"} {formatQuantity(Math.abs(delta), "lb")}
          </>
        ) : (
          formatQuantity(latest?.weight ?? 0, "lb")
        )
      }
      icon={<TrendingUp className="size-4" />}
      lockedCapability="Pro members see wins across weight, training, and sleep pulled into one place."
      retryAction={retry()}
      state={resolved}
      targetContext={
        delta != null && resolved === "populated" && first
          ? `since ${shortDate(first.daysAgo)}`
          : latest
            ? `logged ${shortDate(latest.daysAgo)}`
            : undefined
      }
      title="Progress"
      tone="emerald"
      visual={
        <PanelSparkline
          className="text-emerald-500"
          height={40}
          points={points}
        />
      }
    />
  );
}

/* -------------------------------------------------- sleep quick-log (2nd) */

/**
 * Second quick-log instance (sleep) so the tracker grammar is verified on a
 * duration-unit domain too; the composition page uses it.
 */
export function QuickLogSleepDemo({
  persona,
  state,
}: {
  persona: Persona;
  state: PanelState;
}) {
  const goalMin = persona.sleepGoalMinutes ?? 480;
  const byDay = new Map<number, number>();
  for (const n of persona.sleepDaily) {
    byDay.set(daysAgoOf(n.t), n.minutes);
  }
  const lastNight = byDay.get(0);
  const lastDay = persona.sleepDaily.length
    ? Math.min(...persona.sleepDaily.map((n) => daysAgoOf(n.t)))
    : null;
  const resolved = effectiveState(
    state,
    state === "stale" ? lastDay != null && lastDay > 0 : lastNight != null
  );
  const isStale = resolved === "stale" && lastDay != null;

  const strip = (
    <WeekStrip
      days={WEEK_OFFSETS.map((offset, i) => {
        const min = byDay.get(offset);
        return {
          key: offset,
          label: WEEK_LABELS[i],
          dateLabel: weekDateLabel(offset),
          isToday: offset === 0,
          isFuture: offset < 0,
          dotClassName:
            min != null
              ? min >= goalMin
                ? "bg-violet-400"
                : "bg-violet-400/40"
              : "bg-border",
          value: min != null ? formatMinutesAsDuration(min) : "Nothing logged",
          status: min != null && min >= goalMin ? "Goal hit" : undefined,
        };
      })}
    />
  );

  return (
    <QuickLogPanel
      detailLink={{ label: "Sleep trends", href: "/sleep" }}
      empty={{
        absent: "No sleep logged yet.",
        unlock: "Log last night and the week fills in.",
        visual: strip,
        action: quietAction("Log sleep", "/sleep"),
      }}
      footer={{
        askChad: (
          <AskChadButton
            className="min-h-11 sm:min-h-8"
            prompt="How has my sleep been lately?"
          />
        ),
        primary: { label: "Log sleep", href: "/sleep" },
        overflow: [{ label: "Edit sleep goal", href: "/sleep" }],
      }}
      headline={formatMinutesAsDuration(
        isStale ? (byDay.get(lastDay) ?? 0) : (lastNight ?? 0)
      )}
      icon={<Moon className="size-4" />}
      lockedCapability="Pro members log sleep nightly and see the week against an hours goal."
      retryAction={retry()}
      state={resolved}
      targetContext={
        isStale
          ? `Last logged ${shortDate(lastDay)}`
          : `of ${formatMinutesAsDuration(goalMin)} goal`
      }
      title="Sleep"
      tone="violet"
      visual={
        <WeekBars
          barClassName="bg-violet-400"
          days={WEEK_OFFSETS.map((offset) => {
            const min = byDay.get(offset);
            return {
              key: offset,
              fraction: min != null ? min / goalMin : null,
              isToday: offset === 0,
              isFuture: offset < 0,
            };
          })}
        />
      }
      weekStrip={strip}
    />
  );
}
