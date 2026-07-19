"use client";

import { Utensils } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { CalorieArc } from "@/components/charts/calorie-arc";
import { NumberTicker } from "@/components/charts/number-ticker";
import { QuickLogPanel } from "@/components/panels/roles";
import { GoalProgressBar, MiniBars } from "@/components/panels/visuals";
import { TargetEditor } from "@/components/today/target-editor";
import { WeekStrip } from "@/components/today/week-strip";
import { Button } from "@/components/ui/button";
import {
  loggedReading,
  resolvePanelState,
  unloggedReading,
} from "@/lib/contracts/data-state";
import { calorieBudget } from "@/lib/energy/calorie-budget";
import { METRICS } from "@/lib/contracts/metrics";
import { LOGGABLE_DOMAINS } from "@/lib/contracts/panels";
import { formatQuantity } from "@/lib/contracts/units";
import type { MacroDay } from "@/lib/today/week";
import { cn } from "@/lib/utils";

/**
 * NUTRITION PANEL (P56-C, FIX-25). The typed QuickLogPanel for nutrition on
 * the P2 system: today's energy budget as the CalorieArc hero
 * (remaining-first, the MacroFactor/MyFitnessPal framing; rule-8 teardown in
 * evidence-p56c/benchmark-teardown.md), the three macro rows against their
 * targets, and the week strip graded against each day's own effective-dated
 * target (FIX-07). Meal logging itself stays on its owned page flows (owner
 * law s168): the one primary action navigates to /nutrition#log-meal, whose
 * form carries the date field (backfill) and the meal-level edit/undo paths.
 * DEC-04: nothing here touches meal grading copy.
 *
 * Values arrive from the canonical assembler (lib/today/panel-data.ts
 * getNutritionPanelData); the panel renders registered metrics
 * (nutrition.calories/protein/carbs/fat.today, nutrition.meals.today,
 * nutrition.week.daily) and never re-derives them.
 */

/** A week day carrying the target active on that day (FIX-07), plus the
 * Phase 3 exercise-adjusted budget (optional so fixture weeks stay valid;
 * absent falls back to the plain target). */
export type NutritionPanelDay = MacroDay & {
  target: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  } | null;
  /** target + credited exercise for that day; null without a target. */
  budgetCalories?: number | null;
};

const NUTRITION_DOMAIN = LOGGABLE_DOMAINS.find((d) => d.domain === "nutrition");

// Labels stay neutral text (AA in BOTH themes; macros are never encoded by
// color alone, doc 04); the hue lives in the bar fill, theme-aware like the
// FIX-19 chart tokens (600-level on light cards, 400s on dark).
const MACRO_ROWS = [
  { key: "protein", label: "Protein", barClass: "bg-sky-600 dark:bg-sky-400" },
  { key: "carbs", label: "Carbs", barClass: "bg-amber-600 dark:bg-amber-400" },
  { key: "fat", label: "Fat", barClass: "bg-violet-600 dark:bg-violet-400" },
] as const;

function MacroRow({
  label,
  consumed,
  target,
  barClass,
}: {
  label: string;
  consumed: number;
  target: number | null;
  barClass: string;
}) {
  const over = target != null && consumed > target;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium text-foreground text-xs">{label}</span>
        <span className="text-muted-foreground text-xs tabular-nums">
          {target != null ? (
            <>
              <span className={cn(over && "font-medium text-critical-text")}>
                {Math.round(consumed)}
              </span>
              {" / "}
              {formatQuantity(target, "g")}
            </>
          ) : (
            formatQuantity(consumed, "g")
          )}
        </span>
      </div>
      <GoalProgressBar
        className={over ? "bg-critical" : barClass}
        fraction={target != null && target > 0 ? consumed / target : 0}
      />
    </div>
  );
}

export function NutritionPanel({
  calories,
  protein,
  carbs,
  fat,
  mealsToday,
  target,
  week,
  exerciseKcal = null,
  addBackOn = true,
  viewHref = "/nutrition",
  locked = false,
  fetchState = "ready",
}: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Meals logged today; 0 means today is UNLOGGED, never "0 kcal eaten". */
  mealsToday: number;
  /** The target active today (FIX-07 effective-dated); null = none set. */
  target: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  } | null;
  /** Sunday-start current week, each day with its own effective target. */
  week: NutritionPanelDay[];
  /** Today's computable exercise estimate; null/absent = none (Phase 3). */
  exerciseKcal?: number | null;
  /** User.exerciseCalorieAddBack (D2); defaults on, like the column. */
  addBackOn?: boolean;
  viewHref?: string;
  /** Entitlement gate: renders the locked teaser (no member data needed). */
  locked?: boolean;
  /** Fetch layer for harness/error surfaces; live pages resolve to ready. */
  fetchState?: "ready" | "loading" | "error";
}) {
  const router = useRouter();
  const [targetsOpen, setTargetsOpen] = useState(false);

  const loggedDays = week.filter((d) => d.logged).length;
  const coverage = {
    loggedDays,
    windowDays: week.filter((d) => !d.isFuture).length,
    points: loggedDays,
    spanDays: 0,
  };
  const state = resolvePanelState({
    locked,
    fetch: fetchState,
    reading:
      mealsToday > 0
        ? loggedReading(calories, { coverage })
        : unloggedReading(coverage),
    staleAfterDays: METRICS["nutrition.calories.today"].staleAfterDays,
    sparseBelow: { points: NUTRITION_DOMAIN?.sparseBelowPoints ?? 1 },
  });

  const calorieTarget = target?.calories ?? null;
  // Today's budget (Phase 3): target + credited exercise through the ONE
  // canonical arithmetic; with add-back off (or nothing computable) this is
  // exactly the plain target and everything below reverts.
  const { credited, budget } = calorieBudget({
    targetKcal: calorieTarget,
    exerciseKcal,
    addBackOn,
  });
  const over = budget != null && calories > budget;

  // Week-strip grading per that day's own exercise-adjusted budget (falling
  // back to its effective target): full amber = a logged day at or under it,
  // critical = over (genuine at-most alert, Color Law), soft amber = logged
  // with no target that day.
  const strip = (
    <WeekStrip
      days={week.map((day) => {
        const dayTarget = day.budgetCalories ?? day.target?.calories ?? null;
        const dayOver = dayTarget != null && day.calories > dayTarget;
        return {
          key: day.t,
          label: day.label,
          dateLabel: day.dateLabel,
          isToday: day.isToday,
          isFuture: day.isFuture,
          dotClassName: day.logged
            ? dayOver
              ? "bg-critical"
              : dayTarget != null
                ? "bg-amber-600 dark:bg-amber-400"
                : "bg-amber-600/50 dark:bg-amber-400/50"
            : "bg-border",
          value: day.logged
            ? dayTarget != null
              ? `${day.calories.toLocaleString("en-US")} of ${formatQuantity(dayTarget, "kcal")}`
              : formatQuantity(day.calories, "kcal")
            : "Not logged",
          status: day.logged
            ? dayTarget != null
              ? dayOver
                ? "Over target"
                : "On target"
              : undefined
            : undefined,
        };
      })}
    />
  );

  return (
    <>
      <QuickLogPanel
        // "Food diary" names the destination (the /nutrition daily diary,
        // MFP's canonical term) and leaves the long canonical title room;
        // wrapTitle guarantees the panel's own name never ellipsizes.
        detailLink={{ label: "Food diary", href: viewHref }}
        wrapTitle
        empty={{
          absent: week.some((d) => d.logged)
            ? "Nothing logged yet today."
            : // Week-scoped wording: the panel only sees this week (the
              // hydration panel's audit-P3 class, fixed as a set).
              "No meals logged this week.",
          unlock:
            "Log a meal and today's calories, protein, carbs, and fat fill in here.",
          // Designed hollow chart + strip: the same set rhythm as the other
          // two trackers' empty states (first-run.md).
          visual: (
            <div className="flex flex-col gap-3">
              <MiniBars hollow values={[1, 1, 1, 1, 1, 1, 1]} />
              {strip}
            </div>
          ),
          action: (
            <Button
              asChild
              className="min-h-11 sm:min-h-8"
              size="sm"
              variant="outline"
            >
              <Link href={`${viewHref}#log-meal`}>Log meal</Link>
            </Button>
          ),
        }}
        footer={{
          status:
            mealsToday > 0
              ? `${mealsToday} meal${mealsToday === 1 ? "" : "s"} logged today`
              : "No meals logged yet today.",
          askChad: (
            <AskChadButton
              className="min-h-11 sm:min-h-8"
              prompt="Look at what I've eaten today and how it stacks up against my calorie and macro targets. Am I on track, and what should I eat for the rest of the day?"
            />
          ),
          primary: { label: "Log meal", href: `${viewHref}#log-meal` },
          overflow: [
            {
              label: target?.calories != null ? "Edit daily targets" : "Set daily targets",
              onClick: () => setTargetsOpen(true),
            },
            { label: "Log a past day", href: `${viewHref}#log-meal` },
          ],
        }}
        headline={
          <NumberTicker
            format={(v) => Math.round(v).toLocaleString("en-US")}
            value={calories}
          />
        }
        icon={<Utensils className="size-4" />}
        lockedCapability="Pro members snap or log meals and Chad tracks calories and protein against a daily target."
        retryAction={
          <Button
            className="min-h-11 sm:min-h-8"
            onClick={() => router.refresh()}
            size="sm"
            variant="outline"
          >
            Try again
          </Button>
        }
        state={state}
        targetContext={
          budget != null ? (
            <span className={cn(over && "font-medium text-critical-text")}>
              of {formatQuantity(budget, "kcal")}
              {credited > 0 ? ` · includes ~${credited} cal exercise` : ""}
              {over ? " · over target" : ""}
            </span>
          ) : (
            "kcal today · no daily target"
          )
        }
        title="Calorie Tracker"
        tone="amber"
        visual={
          <div className="flex items-center gap-3">
            <CalorieArc
              consumed={calories}
              exerciseCredited={credited}
              size={88}
              target={calorieTarget}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {MACRO_ROWS.map((row) => (
                <MacroRow
                  barClass={row.barClass}
                  consumed={
                    row.key === "protein"
                      ? protein
                      : row.key === "carbs"
                        ? carbs
                        : fat
                  }
                  key={row.key}
                  label={row.label}
                  target={target?.[row.key] ?? null}
                />
              ))}
            </div>
          </div>
        }
        weekStrip={strip}
        glow="amber"
      />

      <TargetEditor
        calories={target?.calories ?? null}
        carbs={target?.carbs ?? null}
        fat={target?.fat ?? null}
        onOpenChange={setTargetsOpen}
        open={targetsOpen}
        protein={target?.protein ?? null}
      />
    </>
  );
}
