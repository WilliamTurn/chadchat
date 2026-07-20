"use client";

import { Droplets } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import {
  logWaterAmount,
  removeWaterEntry,
  saveWaterGoal,
} from "@/app/nutrition/actions";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { LiquidGauge } from "@/components/charts/liquid-gauge";
import { NumberTicker } from "@/components/charts/number-ticker";
import { useReward } from "@/components/dashboard/reward";
import { QuickLogPanel } from "@/components/panels/roles";
import { WeekBars } from "@/components/panels/visuals";
import {
  EditWaterGoalDialog,
  LogWaterDialog,
} from "@/components/today/hydration-overlays";
import { WeekStrip } from "@/components/today/week-strip";
import { Button } from "@/components/ui/button";
import { toastError, toastReceipt, toastUndo } from "@/components/ui/toast";
import {
  loggedReading,
  resolvePanelState,
  unloggedReading,
} from "@/lib/contracts/data-state";
import { canClaimForMetric, METRICS } from "@/lib/contracts/metrics";
import { LOGGABLE_DOMAINS } from "@/lib/contracts/panels";
import { formatQuantity, mlToOz } from "@/lib/contracts/units";
import { DEFAULT_WATER_GOAL_ML } from "@/lib/today/water-units";
import type { WaterDay } from "@/lib/today/week";

/**
 * HYDRATION PANEL (P56-C, FIX-26; grew from the P2-Z pilot). The typed
 * QuickLogPanel for water on the P2 system, now completed to the full
 * contract: the LiquidGauge signature visual (the WaterMinder/Waterllama
 * category language; rule-8 teardown in evidence-p56c/benchmark-teardown.md)
 * beside the week's goal bars, strip AND chart (owner law s181), one primary
 * logging action in the FIX-17 overlay, exact-entry Undo on every quick-add,
 * and per-day FIX-07 effective-dated goals: each strip day and bar grades
 * against the goal active on THAT day, so backfilled water lands under the
 * right target. This panel replaced the legacy WaterTracker popover card
 * (the banned s168 pattern) everywhere it mounted.
 *
 * Quick-adds stay optimistic (R2-15): the headline number rolls, the liquid
 * rises, and the strip fills instantly while the server action commits; the
 * FIX-10 receipt fan-out reconciles every dependent surface on settle.
 */

/**
 * A week day carrying the goal active on that day (FIX-07). `goalMl` is
 * optional ONLY so the pre-assembler /home mount keeps compiling until
 * P56-D adopts getHydrationPanelData (lib/today/panel-data.ts); a day
 * without one grades against today's goal (the pre-FIX-07 behavior).
 */
export type HydrationPanelDay = WaterDay & { goalMl?: number };

const HYDRATION_DOMAIN = LOGGABLE_DOMAINS.find((d) => d.domain === "hydration");

export function HydrationPanel({
  totalMl,
  goalMl = DEFAULT_WATER_GOAL_ML,
  week,
  viewHref = "/hydration",
  backfillHref = "/hydration#log-past-day",
  locked = false,
  fetchState = "ready",
}: {
  totalMl: number;
  /** The goal active today (ml), FIX-07 effective-dated. */
  goalMl?: number;
  /** This week's Sunday-start days, each with its own effective goal. */
  week: HydrationPanelDay[];
  viewHref?: string;
  /** Where "Log a past day" lands (the /hydration backfill card anchor). */
  backfillHref?: string;
  /** Entitlement gate: renders the locked teaser (no member data needed). */
  locked?: boolean;
  /** Fetch layer for harness/error surfaces; live pages resolve to ready. */
  fetchState?: "ready" | "loading" | "error";
}) {
  const router = useRouter();
  const reward = useReward();
  const [pending, startTransition] = useTransition();
  const [logOpen, setLogOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);

  const [optimisticMl, addOptimisticMl] = useOptimistic(
    totalMl,
    (current, delta: number) => Math.max(current + delta, 0)
  );

  const safeGoal = goalMl > 0 ? goalMl : DEFAULT_WATER_GOAL_ML;
  const goalOzLabel = formatQuantity(Math.round(mlToOz(safeGoal)), "oz");
  const reached = optimisticMl >= safeGoal;

  // State per the contract resolver: hydration is a daily-status domain
  // (sparseBelowPoints 1, panels.ts), so the panel is populated from the
  // first log of the day and empty before it.
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
      optimisticMl > 0
        ? loggedReading(optimisticMl, { coverage })
        : unloggedReading(coverage),
    staleAfterDays: METRICS["hydration.water.today"].staleAfterDays,
    sparseBelow: { points: HYDRATION_DOMAIN?.sparseBelowPoints ?? 1 },
  });

  /** Today's value with the optimistic delta applied; other days as logged. */
  function dayMl(day: HydrationPanelDay): number | null {
    if (day.isToday) {
      return optimisticMl > 0 ? optimisticMl : null;
    }
    return day.logged ? day.ml : null;
  }

  /** The goal governing a day (FIX-07 per-day; today includes live edits). */
  function dayGoal(day: HydrationPanelDay): number {
    const g = day.isToday ? safeGoal : (day.goalMl ?? safeGoal);
    return g > 0 ? g : DEFAULT_WATER_GOAL_ML;
  }

  const strip = (
    <WeekStrip
      days={week.map((day) => {
        const ml = dayMl(day);
        const goal = dayGoal(day);
        return {
          key: day.t,
          label: day.label,
          dateLabel: day.dateLabel,
          isToday: day.isToday,
          isFuture: day.isFuture,
          dotClassName:
            ml != null
              ? ml >= goal
                ? "bg-sky-600 dark:bg-sky-400"
                : "bg-sky-600/40 dark:bg-sky-400/40"
              : "bg-border",
          value:
            ml != null
              ? formatQuantity(Math.round(mlToOz(ml)), "oz")
              : "Not logged",
          status: ml != null && ml >= goal ? "Goal hit" : undefined,
        };
      })}
    />
  );

  // Weekly context beside the gauge: days at goal as an adherence read only
  // when the claim clears its coverage threshold (claims.ts), else plain
  // coverage. The strip below carries the per-day detail; no second 7-day
  // chart competes with it (the P56-C harness audit found the old bars row
  // redundant and ambiguous next to the dot strip).
  const daysAtGoal = week.filter(
    (d) => dayMl(d) != null && (dayMl(d) as number) >= dayGoal(d)
  ).length;
  const adherenceAllowed = canClaimForMetric(
    "hydration.week.daily",
    "adherence",
    coverage
  ).allowed;
  const remainingMl = Math.max(safeGoal - optimisticMl, 0);

  function add(ml: number) {
    // Sensory feedback (DSH-54): a barely-there tick per quick-add, the full
    // success moment on the tap that crosses the goal line. Always follows an
    // explicit member tap (nothing auto-starts).
    const crossesGoal =
      optimisticMl < safeGoal && optimisticMl + ml >= safeGoal;
    reward.effects(crossesGoal ? "success" : "tick");
    const newTotal = optimisticMl + ml;
    startTransition(async () => {
      addOptimisticMl(ml);
      let result: Awaited<ReturnType<typeof logWaterAmount>>;
      try {
        result = await logWaterAmount(ml);
      } catch {
        result = { ok: false };
      }
      if (!result.ok) {
        toastError(result.error ?? "We couldn't log that water. Try again.");
        return;
      }
      const entryId = result.id;
      toastUndo(
        `Added ${formatQuantity(Math.round(mlToOz(ml)), "oz")}. ${formatQuantity(
          Math.round(mlToOz(newTotal)),
          "oz"
        )} of ${goalOzLabel} today.`,
        {
          // Undo removes EXACTLY the entry this toast receipted, so rapid
          // quick-adds inside the 6s window never undo each other.
          onUndo: () =>
            entryId
              ? removeWaterEntry(entryId)
              : { ok: false, error: "We couldn't undo that. Try again." },
        }
      );
    });
  }

  function saveGoal(ml: number) {
    return new Promise<{ ok: boolean; error?: string | null }>((resolve) => {
      startTransition(async () => {
        // Always resolve, even on a rejected server action, so the goal
        // dialog can surface the failure instead of hanging in `loading`.
        try {
          const result = await saveWaterGoal(ml);
          if (result.ok) {
            toastReceipt(
              `Daily goal set to ${formatQuantity(Math.round(mlToOz(ml)), "oz")}.`
            );
          }
          resolve(result);
        } catch {
          resolve({
            ok: false,
            error: "We couldn't save your goal. Try again.",
          });
        }
      });
    });
  }

  const gaugeLabel = reached
    ? `Hydration goal reached: ${formatQuantity(Math.round(mlToOz(optimisticMl)), "oz")} of ${goalOzLabel}.`
    : `Hydration ${Math.round((optimisticMl / safeGoal) * 100)}% of goal: ${formatQuantity(
        Math.round(mlToOz(optimisticMl)),
        "oz"
      )} of ${goalOzLabel}.`;

  return (
    <>
      <QuickLogPanel
        detailLink={{ label: "Hydration history", href: viewHref }}
        empty={{
          absent: week.some((d) => d.logged)
            ? "Nothing logged yet today."
            : // Week-scoped wording: the panel only sees this week, and a
              // member with older history would read "yet" as contradicting
              // the page's own stats (pre-delivery audit P3).
              "No water logged this week.",
          unlock: "One tap adds a glass; the week fills in as you go.",
          // Designed hollow chart + strip: the same set rhythm as the other
          // two trackers' empty states (first-run.md).
          visual: (
            <div className="flex flex-col gap-3">
              <WeekBars
                days={week.map((day) => ({
                  key: day.t,
                  fraction: null,
                  isToday: day.isToday,
                  isFuture: day.isFuture,
                }))}
              />
              {strip}
            </div>
          ),
          action: (
            <Button
              className="min-h-11 sm:min-h-8"
              onClick={() => setLogOpen(true)}
              size="sm"
              variant="outline"
            >
              Log water
            </Button>
          ),
        }}
        footer={{
          askChad: (
            <AskChadButton
              className="min-h-11 sm:min-h-8"
              prompt="How's my water intake today? Am I drinking enough, and when should I top up?"
            />
          ),
          primary: { label: "Log water", onClick: () => setLogOpen(true) },
          overflow: [
            { label: "Edit daily goal", onClick: () => setGoalOpen(true) },
            { label: "Log a past day", href: backfillHref },
          ],
        }}
        headline={
          <NumberTicker
            format={(v) => formatQuantity(Math.round(mlToOz(v)), "oz")}
            value={optimisticMl}
          />
        }
        icon={<Droplets className="size-4" />}
        lockedCapability="Pro members log water in one tap and see the week against a daily goal."
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
        targetContext={`of ${goalOzLabel} goal`}
        title="Water"
        tone="sky"
        visual={
          <div className="flex items-center gap-4">
            <LiquidGauge
              ariaLabel={gaugeLabel}
              fraction={optimisticMl / safeGoal}
              reached={reached}
              size={88}
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-medium text-body-sm text-foreground">
                {reached
                  ? "Goal hit"
                  : `${formatQuantity(Math.round(mlToOz(remainingMl)), "oz")} to go`}
              </span>
              <span className="text-meta text-muted-foreground">
                {adherenceAllowed
                  ? `Goal hit on ${daysAtGoal} of ${loggedDays} logged days this week`
                  : `Logged ${loggedDays} of ${coverage.windowDays} days this week`}
              </span>
            </div>
          </div>
        }
        weekStrip={strip}
        glow="sky"
      />

      <LogWaterDialog
        onAdd={add}
        onOpenChange={setLogOpen}
        open={logOpen}
        pending={pending}
      />
      <EditWaterGoalDialog
        goalMl={safeGoal}
        // Remount on goal change so the draft re-seeds from the saved value
        // instead of a stale initial captured at first mount.
        key={safeGoal}
        onOpenChange={setGoalOpen}
        open={goalOpen}
        pending={pending}
        onSave={saveGoal}
      />
    </>
  );
}
