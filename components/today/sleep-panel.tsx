"use client";

import { Moon, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { logSleep, removeSleep, saveSleepGoal } from "@/app/home/actions";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { NightColumns } from "@/components/charts/night-columns";
import { useReward } from "@/components/dashboard/reward";
import { QuickLogPanel } from "@/components/panels/roles";
import { DeltaTag } from "@/components/panels/visuals";
import {
  EditSleepGoalDialog,
  LogSleepDialog,
  type SleepLogInput,
} from "@/components/today/sleep-overlays";
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
import { formatMinutesAsDuration } from "@/lib/contracts/units";
import { formatCalendarDay, parseCalendarDay } from "@/lib/date";
import type { LastNight, SleepNight } from "@/lib/today/week";
import { cn } from "@/lib/utils";

/**
 * SLEEP PANEL (P56-C, FIX-27). The typed QuickLogPanel for sleep on the P2
 * system, replacing the popover-form SleepTracker (the banned s168 pattern /
 * DSH-59 class): logging happens in the FIX-17 overlay right from the panel,
 * nothing auto-focuses, the date field doubles as backfill, and a fresh log
 * gets an exact-entry Undo (confirm-or-undo law).
 *
 * DSH-64 class: the week visual (NightColumns) exists in EVERY state; with
 * zero nights it renders the designed axis-only placeholder, so the chart
 * slot never disappears. Staleness follows the metric registry: an entry
 * older than yesterday renders DATED ("last logged Thu, Jul 3"), never
 * framed as last night (P1-2). Per-night goals are FIX-07 effective-dated:
 * each night grades against the goal active on that night.
 */

/** A week night carrying the goal active on that night (FIX-07). */
export type SleepPanelNight = SleepNight & { goalMinutes: number };

const SLEEP_DOMAIN = LOGGABLE_DOMAINS.find((d) => d.domain === "sleep");

function QualityStars({ value }: { value: number }) {
  return (
    <span
      aria-label={`Quality ${value} of 5`}
      className="inline-flex items-center gap-0.5"
      role="img"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          aria-hidden
          className={cn(
            "size-3",
            n <= value
              ? "fill-indigo-400 text-indigo-400"
              : "text-muted-foreground/30"
          )}
          key={n}
        />
      ))}
    </span>
  );
}

export function SleepPanel({
  lastNight,
  goalMinutes,
  isDefaultGoal = true,
  week,
  viewHref = "/sleep",
  viewLabel = "Sleep trends",
  locked = false,
  fetchState = "ready",
}: {
  lastNight: LastNight;
  /** The goal active today (minutes), FIX-07 effective-dated. */
  goalMinutes: number;
  isDefaultGoal?: boolean;
  /** Sunday-start current week, each night with its own effective goal. */
  week: SleepPanelNight[];
  viewHref?: string;
  /** Detail-link label; override when the href targets a specific section
   *  (the label must name its real destination). */
  viewLabel?: string;
  /** Entitlement gate: renders the locked teaser (no member data needed). */
  locked?: boolean;
  /** Fetch layer for harness/error surfaces; live pages resolve to ready. */
  fetchState?: "ready" | "loading" | "error";
}) {
  const router = useRouter();
  const reward = useReward();
  const [pending, startTransition] = useTransition();
  const [logOpen, setLogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);

  const loggedNights = week.filter((n) => n.logged);
  const coverage = {
    loggedDays: loggedNights.length,
    windowDays: week.filter((n) => !n.isFuture).length,
    points: loggedNights.length,
    spanDays: 0,
  };
  const state = resolvePanelState({
    locked,
    fetch: fetchState,
    reading: lastNight
      ? loggedReading(lastNight.minutes, {
          coverage,
          ageDays: lastNight.ageDays,
        })
      : unloggedReading(coverage),
    staleAfterDays: METRICS["sleep.lastNight.duration"].staleAfterDays,
    sparseBelow: { points: SLEEP_DOMAIN?.sparseBelowPoints ?? 1 },
  });

  // Only a genuinely-current entry earns the "last night" framing (P1-2).
  const current = lastNight?.isCurrent ? lastNight : null;
  const metGoal = current != null && current.minutes >= goalMinutes;

  // The most recent logged night THIS WEEK, for "Edit last night" defaults.
  const latestLoggedNight =
    loggedNights.length > 0 ? loggedNights[loggedNights.length - 1] : null;

  const columns = week.map((n) => ({
    key: n.t,
    label: n.label,
    dateLabel: n.dateLabel,
    minutes: n.logged ? n.minutes : null,
    goalMinutes: n.goalMinutes,
    quality: n.quality,
    isToday: n.isToday,
    isFuture: n.isFuture,
  }));

  const strip = (
    <WeekStrip
      days={week.map((n) => ({
        key: n.t,
        label: n.label,
        dateLabel: n.dateLabel,
        isToday: n.isToday,
        isFuture: n.isFuture,
        dotClassName: n.logged
          ? n.minutes >= n.goalMinutes
            ? "bg-indigo-600 dark:bg-indigo-400"
            : "bg-indigo-600/40 dark:bg-indigo-400/40"
          : "bg-border",
        value: n.logged ? formatMinutesAsDuration(n.minutes) : "Not logged",
        status:
          n.logged && n.minutes >= n.goalMinutes ? "Goal met" : undefined,
      }))}
    />
  );

  // Footer status: the adherence read when the claim clears its coverage
  // threshold (claims.ts), else the plain goal phrase. Weekly shortfall is
  // the honest duration-only insight the leaders use (rule-8: RISE's debt).
  const adherenceAllowed = canClaimForMetric(
    "sleep.week.nightly",
    "adherence",
    coverage
  ).allowed;
  const nightsMet = loggedNights.filter(
    (n) => n.minutes >= n.goalMinutes
  ).length;
  const weekShortfall = loggedNights.reduce(
    (sum, n) => sum + Math.max(0, n.goalMinutes - n.minutes),
    0
  );
  const goalPhrase = isDefaultGoal
    ? `${formatMinutesAsDuration(goalMinutes)}+ a night recommended`
    : `Goal: ${formatMinutesAsDuration(goalMinutes)}+ a night`;
  const status = adherenceAllowed
    ? weekShortfall > 0
      ? `Goal met ${nightsMet} of ${loggedNights.length} nights · ${formatMinutesAsDuration(weekShortfall)} short this week`
      : `Goal met on every logged night this week`
    : goalPhrase;

  function save(input: SleepLogInput, opts: { replacing: boolean }) {
    const nightLabel = formatCalendarDay(
      parseCalendarDay(input.recordedAt) ?? new Date(),
      { weekday: "short", month: "short", day: "numeric" }
    );
    const durationLabel = formatMinutesAsDuration(input.minutes);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof logSleep>>;
      try {
        result = await logSleep(input);
      } catch {
        result = { ok: false };
      }
      if (!result.ok) {
        toastError(
          result.error ?? "We couldn't log that sleep. Your values are still here. Try again."
        );
        return;
      }
      setLogOpen(false);
      setEditOpen(false);
      reward.effects("success");
      const entryId = result.id;
      if (opts.replacing || !entryId) {
        // Replacements were announced in the form before saving; a plain
        // receipt confirms exactly what changed.
        toastReceipt(`Sleep updated for ${nightLabel}. ${durationLabel}.`);
        return;
      }
      toastUndo(`Sleep logged for ${nightLabel}. ${durationLabel}.`, {
        // Undo removes EXACTLY the entry this toast receipted.
        onUndo: () => removeSleep(entryId),
      });
    });
  }

  function saveGoal(minutes: number) {
    return new Promise<{ ok: boolean; error?: string | null }>((resolve) => {
      startTransition(async () => {
        try {
          const result = await saveSleepGoal(minutes);
          if (result.ok) {
            toastReceipt(
              `Nightly goal set to ${formatMinutesAsDuration(minutes)}.`
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

  const placeholderColumns = (
    <NightColumns height={48} nights={columns} placeholder />
  );

  return (
    <>
      <QuickLogPanel
        detailLink={{ label: viewLabel, href: viewHref }}
        empty={{
          absent: "No sleep logged yet.",
          unlock:
            "Log last night and the week fills in against your nightly goal.",
          // DSH-64: strip AND the axis-only chart placeholder from night zero.
          visual: (
            <div className="flex flex-col gap-3">
              {placeholderColumns}
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
              Log last night
            </Button>
          ),
        }}
        footer={{
          status,
          askChad: (
            <AskChadButton
              className="min-h-11 sm:min-h-8"
              prompt="Look at the sleep panel on my dashboard: last night and this week's nights. Am I getting enough to recover and build muscle, and what should I change tonight?"
            />
          ),
          primary: current
            ? undefined
            : {
                label: "Log last night",
                onClick: () => setLogOpen(true),
              },
          secondary: current
            ? [{ label: "Edit last night", onClick: () => setEditOpen(true) }]
            : undefined,
          overflow: [
            { label: "Edit nightly goal", onClick: () => setGoalOpen(true) },
            { label: "Log a past night", onClick: () => setLogOpen(true) },
          ],
        }}
        headline={
          current
            ? formatMinutesAsDuration(current.minutes)
            : lastNight
              ? formatMinutesAsDuration(lastNight.minutes)
              : "Not logged"
        }
        icon={<Moon className="size-4" />}
        lockedCapability="Pro members log each night in seconds and see the week rise toward a nightly sleep goal."
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
          current ? (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <span>
                of {formatMinutesAsDuration(goalMinutes)} goal
                {metGoal
                  ? ""
                  : ` · ${formatMinutesAsDuration(goalMinutes - current.minutes)} short`}
              </span>
              {metGoal && <DeltaTag direction="positive" text="Goal met" />}
              {current.quality != null && (
                <QualityStars value={current.quality} />
              )}
            </span>
          ) : lastNight ? (
            `last logged ${lastNight.dateLabel}`
          ) : undefined
        }
        title="Sleep"
        tone="indigo"
        visual={<NightColumns height={64} nights={columns} />}
        weekStrip={strip}
        glow="indigo"
      />

      <LogSleepDialog
        loggedNights={week
          .filter((n) => n.logged)
          .map((n) => ({ iso: n.iso, minutes: n.minutes }))}
        onOpenChange={setLogOpen}
        onSave={save}
        open={logOpen}
        pending={pending}
      />
      {latestLoggedNight && (
        <LogSleepDialog
          defaultDate={latestLoggedNight.iso}
          defaultMinutes={latestLoggedNight.minutes}
          defaultQuality={latestLoggedNight.quality}
          // Remount when the night being edited changes so values re-seed.
          key={`${latestLoggedNight.iso}-${latestLoggedNight.minutes}`}
          mode="edit"
          onOpenChange={setEditOpen}
          onSave={(input) => save(input, { replacing: true })}
          open={editOpen}
          pending={pending}
        />
      )}
      <EditSleepGoalDialog
        goalMinutes={goalMinutes}
        // Remount on goal change so the draft re-seeds from the saved value.
        key={goalMinutes}
        onOpenChange={setGoalOpen}
        onSave={saveGoal}
        open={goalOpen}
        pending={pending}
      />
    </>
  );
}
