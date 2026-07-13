"use client";

import { Droplets } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import {
  logWaterAmount,
  removeWaterEntry,
  saveWaterGoal,
} from "@/app/nutrition/actions";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { useReward } from "@/components/dashboard/reward";
import { QuickLogPanel } from "@/components/panels/roles";
import { type DayBar, WeekBars } from "@/components/panels/visuals";
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
import { formatQuantity, mlToOz } from "@/lib/contracts/units";
import { DEFAULT_WATER_GOAL_ML } from "@/lib/today/water-units";
import type { WaterDay } from "@/lib/today/week";

/**
 * HYDRATION PANEL (P2-Z pilot, DSH-66). The first LIVE panel on the Phase 2
 * system, replacing the old WaterTracker card on /today: QuickLogPanel role
 * (FIX-14/15/16) + the overlay platform (FIX-17) + the form/feedback
 * primitives (FIX-38). The panel shows today's standing; logging happens in
 * the quick-log overlay; every add gets a receipt toast with Undo
 * (undo-after-quick-add, owner confirm-or-undo law s185).
 *
 * Quick-adds stay optimistic (R2-15): the headline, bars, and strip apply the
 * delta instantly while the server action commits; the actions revalidate
 * /today and /hydration so the totals reconcile when the transition settles.
 */
export function HydrationPanel({
  totalMl,
  goalMl = DEFAULT_WATER_GOAL_ML,
  week,
  viewHref = "/hydration",
}: {
  totalMl: number;
  goalMl?: number;
  /** This week's Sunday-start days (buildWaterWeek). */
  week: WaterDay[];
  viewHref?: string;
}) {
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

  // State per the contract resolver: hydration is a daily-status domain
  // (sparseBelowPoints 1, panels.ts), so the panel is populated from the
  // first log of the day and empty before it. Today's metric never goes
  // stale, and /today only renders this panel for entitled members with a
  // resolved fetch.
  const loggedDays = week.filter((d) => d.logged).length;
  const coverage = {
    loggedDays,
    windowDays: week.filter((d) => !d.isFuture).length,
    points: loggedDays,
    spanDays: 0,
  };
  const state = resolvePanelState({
    locked: false,
    fetch: "ready",
    reading:
      optimisticMl > 0
        ? loggedReading(optimisticMl, { coverage })
        : unloggedReading(coverage),
    staleAfterDays: null,
    sparseBelow: { points: 1 },
  });

  /** Today's value with the optimistic delta applied; other days as logged. */
  function dayMl(day: WaterDay): number | null {
    if (day.isToday) {
      return optimisticMl > 0 ? optimisticMl : null;
    }
    return day.logged ? day.ml : null;
  }

  const strip = (
    <WeekStrip
      days={week.map((day) => {
        const ml = dayMl(day);
        return {
          key: day.t,
          label: day.label,
          dateLabel: day.dateLabel,
          isToday: day.isToday,
          isFuture: day.isFuture,
          dotClassName:
            ml != null
              ? ml >= safeGoal
                ? "bg-sky-400"
                : "bg-sky-400/40"
              : "bg-border",
          value:
            ml != null
              ? formatQuantity(Math.round(mlToOz(ml)), "oz")
              : "Not logged",
          status: ml != null && ml >= safeGoal ? "Goal hit" : undefined,
        };
      })}
    />
  );

  const bars: DayBar[] = week.map((day) => {
    const ml = dayMl(day);
    return {
      key: day.t,
      fraction: ml != null ? ml / safeGoal : null,
      isToday: day.isToday,
      isFuture: day.isFuture,
    };
  });

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

  return (
    <>
      <QuickLogPanel
        detailLink={{ label: "Hydration history", href: viewHref }}
        empty={{
          absent: week.some((d) => d.logged)
            ? "Nothing logged yet today."
            : "No water logged yet.",
          unlock: "One tap adds a glass; the week fills in as you go.",
          visual: strip,
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
            { label: "Log a past day", href: viewHref },
          ],
        }}
        headline={formatQuantity(Math.round(mlToOz(optimisticMl)), "oz")}
        icon={<Droplets className="size-4" />}
        lockedCapability="Pro members log water in one tap and see the week against a daily goal."
        state={state}
        targetContext={`of ${goalOzLabel} goal`}
        title="Water"
        tone="sky"
        visual={<WeekBars barClassName="bg-sky-400" days={bars} />}
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
