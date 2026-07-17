import { Droplets, Dumbbell, Moon, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusPanel } from "@/components/panels/roles";
import { MiniBars, ProgressRing, WeekBars } from "@/components/panels/visuals";
import {
  loggedReading,
  type PanelState,
  resolvePanelState,
  unloggedReading,
} from "@/lib/contracts/data-state";
import {
  formatMinutesAsDuration,
  formatQuantity,
  mlToOz,
} from "@/lib/contracts/units";
import type { LastNight } from "@/lib/today/week";

/**
 * THE FOUR-DOMAIN STATUS STRIP (FIX-22). Nutrition / Hydration / Sleep /
 * Training as four StatusPanel cells: label, current value, target context,
 * status word, one honest micro-visual. Zero logging controls (03 spec Row 2;
 * logging lives in the tracking panels below). The WHOLE CELL is the tap
 * target and opens the domain's detail page (the WHOOP tile pattern from the
 * P56-D teardown; every link names its destination via aria-label).
 *
 * Every number renders a registered metric through the units.ts formatters
 * (one-canonical-value law): calories/water/sleep/sessions arrive computed by
 * the page from their registered source symbols; this component only formats.
 *
 * Reward treatment (owner reward-glow order): a met target turns its ring
 * emerald (`text-positive-text`): meaning-colored, never fabricated. Blood
 * stays brand/identity; "over target" uses the attention token, not red.
 */

export type StatusStripData = {
  nutrition: {
    /** nutrition.calories.today via the panel-data assembler's member-local
     *  day windows (see the registry derivation's rewiring status). */
    calories: number;
    target: number | null;
    mealsToday: number;
    /** Today's macro grams, for the no-target visual (real data). */
    macros: { protein: number; carbs: number; fat: number };
  };
  hydration: {
    ml: number;
    goalMl: number;
  };
  sleep: {
    lastNight: LastNight;
    goalMinutes: number | null;
  };
  training: {
    /** buildWorkoutWeek days (registered source for sessions this week). */
    week: { t: number; logged: boolean; isToday: boolean; isFuture: boolean }[];
    sessionsThisWeek: number;
    /** Structured-plan sessions/week (FIX-28); null = no target renders. */
    plannedPerWeek: number | null;
  };
};

function CellLink({
  href,
  name,
  children,
}: {
  href: string;
  /** The registered destination name (ACC-03). */
  name: string;
  children: ReactNode;
}) {
  return (
    <Link
      aria-label={`Open ${name}`}
      className="group block rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring [&_section]:transition-colors [&_section]:group-hover:border-foreground/25"
      href={href}
    >
      {children}
    </Link>
  );
}

const RING = 44;

export function StatusStrip({ data }: { data: StatusStripData }) {
  const { nutrition, hydration, sleep, training } = data;

  /* ------------------------------------------------------------ nutrition */
  const nutritionState: PanelState = resolvePanelState({
    locked: false,
    fetch: "ready",
    reading:
      nutrition.mealsToday > 0
        ? loggedReading(nutrition.calories, {
            coverage: { loggedDays: 1, windowDays: 1, points: 1, spanDays: 0 },
          })
        : unloggedReading({
            loggedDays: 0,
            windowDays: 1,
            points: 0,
            spanDays: 0,
          }),
    staleAfterDays: null,
    sparseBelow: { points: 1 },
  });
  const overTarget =
    nutrition.target != null && nutrition.calories > nutrition.target;

  /* ------------------------------------------------------------ hydration */
  const hydrationState: PanelState = resolvePanelState({
    locked: false,
    fetch: "ready",
    reading:
      hydration.ml > 0
        ? loggedReading(hydration.ml, {
            coverage: { loggedDays: 1, windowDays: 1, points: 1, spanDays: 0 },
          })
        : unloggedReading({
            loggedDays: 0,
            windowDays: 1,
            points: 0,
            spanDays: 0,
          }),
    staleAfterDays: null,
    sparseBelow: { points: 1 },
  });
  const waterGoalMet = hydration.ml >= hydration.goalMl;
  const remainingOz = Math.max(
    0,
    Math.round(mlToOz(hydration.goalMl - hydration.ml))
  );

  /* ---------------------------------------------------------------- sleep */
  const night = sleep.lastNight;
  const sleepState: PanelState = resolvePanelState({
    locked: false,
    fetch: "ready",
    reading: night
      ? loggedReading(night.minutes, {
          coverage: { loggedDays: 1, windowDays: 1, points: 1, spanDays: 0 },
          // buildLastNight only says current-or-not; anything not current is
          // shown dated (P1-2), which the stale state carries.
          ageDays: night.isCurrent ? 0 : 2,
        })
      : unloggedReading({ loggedDays: 0, windowDays: 1, points: 0, spanDays: 0 }),
    staleAfterDays: 1,
    sparseBelow: { points: 1 },
  });
  const sleepGoalMet =
    night?.isCurrent === true &&
    sleep.goalMinutes != null &&
    night.minutes >= sleep.goalMinutes;
  const sleepBelow =
    night?.isCurrent === true &&
    sleep.goalMinutes != null &&
    night.minutes < sleep.goalMinutes
      ? sleep.goalMinutes - night.minutes
      : null;

  /* ------------------------------------------------------------- training */
  // Sessions-this-week is a truthful zero (missingRendersAs: "zero"), so the
  // cell is populated even in a zero week; the 7-day cue carries the shape.
  const planMet =
    training.plannedPerWeek != null &&
    training.sessionsThisWeek >= training.plannedPerWeek;

  return (
    /* Container-driven columns (queries must live on a DESCENDANT of the
       @container element): one column on the narrowest phones (320-viewport
       content is ~288px), 2x2 from 320px of real strip width (the 03-spec
       360/390 compositions), four-across from 960px (1280+ desktops; 1024
       keeps the spec's two rows of two), independent of the sidebar state. */
    <div className="@container">
      <section
        aria-label="Today's status"
        className="grid grid-cols-1 gap-3 @[320px]:grid-cols-2 @[960px]:grid-cols-4"
      >
      <CellLink href="/nutrition" name="Calorie Tracker">
        <StatusPanel
          empty={{
            absent: "Not logged yet.",
            unlock: "Log a meal below.",
            visual: (
              <ProgressRing
                className="text-muted-foreground"
                fraction={0}
                label=""
                size={RING}
              />
            ),
          }}
          headline={formatQuantity(nutrition.calories, "kcal")}
          icon={<UtensilsCrossed className="size-4" />}
          lockedCapability="Pro members track calories and macros against a daily target, meal by meal."
          state={nutritionState}
          targetContext={
            nutrition.target != null
              ? `of ${formatQuantity(nutrition.target, "kcal")}${overTarget ? " · Above target" : ""}`
              : `${nutrition.mealsToday} meal${nutrition.mealsToday === 1 ? "" : "s"} logged`
          }
          title="Calories"
          tone="amber"
          visual={
            nutrition.target != null ? (
              <ProgressRing
                className={
                  overTarget ? "text-attention-text" : "text-chart-3"
                }
                fraction={nutrition.calories / nutrition.target}
                size={RING}
              />
            ) : (
              // No target set: today's real macro split, never a fake ring.
              <MiniBars
                barClassName="bg-chart-3"
                className="h-9 w-16"
                values={[
                  nutrition.macros.protein,
                  nutrition.macros.carbs,
                  nutrition.macros.fat,
                ]}
              />
            )
          }
        />
      </CellLink>

      <CellLink href="/hydration" name="Hydration">
        <StatusPanel
          empty={{
            absent: "Not logged yet.",
            unlock: "One tap below.",
            visual: (
              <ProgressRing
                className="text-muted-foreground"
                fraction={0}
                label=""
                size={RING}
              />
            ),
          }}
          headline={formatQuantity(Math.round(mlToOz(hydration.ml)), "oz")}
          icon={<Droplets className="size-4" />}
          lockedCapability="Pro members log water in one tap and see the day against a goal."
          state={hydrationState}
          targetContext={
            waterGoalMet
              ? "Goal reached"
              : `of ${formatQuantity(Math.round(mlToOz(hydration.goalMl)), "oz")} · ${formatQuantity(remainingOz, "oz")} left`
          }
          title="Water"
          tone="sky"
          visual={
            <ProgressRing
              className={waterGoalMet ? "text-positive-text" : "text-chart-1"}
              fraction={hydration.ml / hydration.goalMl}
              size={RING}
            />
          }
        />
      </CellLink>

      <CellLink href="/sleep" name="Sleep">
        <StatusPanel
          empty={{
            absent: "Not logged yet.",
            unlock: "Log last night below.",
            visual: (
              <ProgressRing
                className="text-muted-foreground"
                fraction={0}
                label=""
                size={RING}
              />
            ),
          }}
          headline={
            night ? formatMinutesAsDuration(night.minutes) : "Not logged"
          }
          icon={<Moon className="size-4" />}
          lockedCapability="Pro members log each night and see sleep against a goal."
          state={sleepState}
          targetContext={
            night && !night.isCurrent
              ? `Last logged ${night.dateLabel}`
              : sleepGoalMet
                ? `Met ${formatMinutesAsDuration(sleep.goalMinutes as number)} goal`
                : sleepBelow != null
                  ? `${formatMinutesAsDuration(sleepBelow)} below goal`
                  : night && sleep.goalMinutes == null
                    ? "Last night"
                    : sleep.goalMinutes != null
                      ? `Goal ${formatMinutesAsDuration(sleep.goalMinutes)}`
                      : undefined
          }
          title="Sleep"
          tone="indigo"
          visual={
            <ProgressRing
              className={
                night && !night.isCurrent
                  ? "text-muted-foreground"
                  : sleepGoalMet
                    ? "text-positive-text"
                    : "text-chart-4"
              }
              fraction={
                night && sleep.goalMinutes
                  ? night.minutes / sleep.goalMinutes
                  : 0
              }
              label={night && !sleep.goalMinutes ? "" : undefined}
              size={RING}
            />
          }
        />
      </CellLink>

      <CellLink href="/workouts" name="Workouts">
        <StatusPanel
          empty={{
            absent: "No sessions this week.",
            unlock: "Log a workout and the week fills in.",
            visual: (
              <WeekBars
                className="h-9 w-20"
                days={training.week.map((d) => ({
                  key: d.t,
                  fraction: null,
                  isToday: d.isToday,
                  isFuture: d.isFuture,
                }))}
              />
            ),
          }}
          headline={formatQuantity(training.sessionsThisWeek, "count")}
          icon={<Dumbbell className="size-4" />}
          lockedCapability="Pro members log workouts and see the training week at a glance."
          // A zero week is a truthful zero (metrics.ts missingRendersAs), so
          // the populated composition always renders.
          state="populated"
          targetContext={
            training.plannedPerWeek != null
              ? `of ${training.plannedPerWeek} workout${training.plannedPerWeek === 1 ? "" : "s"} planned this week${planMet ? " · Done" : ""}`
              : `workout${training.sessionsThisWeek === 1 ? "" : "s"} this week`
          }
          title="Training"
          tone="blood"
          visual={
            <WeekBars
              barClassName={planMet ? "bg-positive" : "bg-blood"}
              className="h-9 w-20"
              days={training.week.map((d) => ({
                key: d.t,
                fraction: d.logged ? 1 : null,
                isToday: d.isToday,
                isFuture: d.isFuture,
              }))}
            />
          }
        />
      </CellLink>
      </section>
    </div>
  );
}
