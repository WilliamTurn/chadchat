"use client";

// Floating layer at the bottom of every /workouts page: the rest-timer
// countdown and the workout-in-progress mini bar (music-player pattern), so a
// live session is always one tap away and never silently lost.

import { Play, Timer, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/ui/confirm-undo";
import { formatClock, sessionCompletedSets, sessionEngaged } from "./format";
import { useWorkouts } from "./store";

/** Ticks once a second while mounted. Starts at 0 (not the real clock) so
 * prerendering never reads Date.now(); the first effect tick corrects it. */
export function useNowTick(): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Live elapsed seconds of the session clock (play/pause aware). */
export function timerElapsedSeconds(
  timer: { running: boolean; accumulatedMs: number; startedAt: number | null },
  now: number
): number {
  const running =
    timer.running && timer.startedAt && now > 0 ? now - timer.startedAt : 0;
  return Math.floor((timer.accumulatedMs + Math.max(0, running)) / 1000);
}

function SessionMiniBar() {
  const { session, ready, discardSession } = useWorkouts();
  const pathname = usePathname();
  const now = useNowTick();
  // Hidden on the player itself, and on every page with its own fixed
  // bottom action bar (picker confirm, builder/custom-exercise save): the
  // shell's stacking context paints this dock above those bars, so it would
  // cover their primary button and hijack the tap.
  const pageHasOwnBottomBar =
    pathname.startsWith("/workouts/active") ||
    pathname.startsWith("/workouts/exercises/pick") ||
    pathname.startsWith("/workouts/exercises/new") ||
    pathname.startsWith("/workouts/new") ||
    pathname.endsWith("/edit");
  // Only an ENGAGED session earns the bar (charter LAW 9; flaws RUN-06):
  // entering a workout page and backing out must not summon it.
  if (!(ready && session) || !sessionEngaged(session) || pageHasOwnBottomBar) {
    return null;
  }
  const done = sessionCompletedSets(session.exercises);
  const elapsed = timerElapsedSeconds(session.timer, now);
  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-[var(--go)]/40 bg-card py-2 pr-1.5 pl-4 shadow-[var(--shadow-float)]">
      <Link
        className="flex min-w-0 flex-1 items-center gap-3 py-1 transition-transform active:scale-[0.99]"
        href="/workouts/active"
      >
        <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--go)] text-[var(--bg)]">
          <Play aria-hidden className="size-5 fill-current" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-[15px] text-foreground">
            {session.name}
          </span>
          <span className="block truncate text-[12.5px] text-muted-foreground">
            Workout in progress · {done} {done === 1 ? "set" : "sets"} done
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="block font-mono font-semibold text-[17px] text-[var(--go)] tabular-nums">
            {session.timer.running || elapsed > 0 ? formatClock(elapsed) : "-"}
          </span>
          <span className="block font-semibold text-[11px] text-[var(--go)]/70 uppercase tracking-wider">
            Back to your workout
          </span>
        </span>
      </Link>
      {/* The one way OUT of a live workout from the bar (flaws RUN-02):
          confirmed, never silent, since logged sets are unsaved until Finish. */}
      <ConfirmActionDialog
        confirmLabel="Discard workout"
        consequence={
          done > 0
            ? `The ${done} ${done === 1 ? "set" : "sets"} you logged will not be saved.`
            : "Its timer will be cleared. Nothing has been saved yet."
        }
        onConfirm={() => discardSession()}
        title={`Stop and discard "${session.name}"?`}
        trigger={
          <Button
            aria-label="Stop this workout"
            className="size-11 shrink-0 text-muted-foreground hover:text-foreground"
            size="icon"
            variant="ghost"
          >
            <X aria-hidden className="size-5" />
          </Button>
        }
      />
    </div>
  );
}

function RestTimerDock() {
  const { session, restTimer, adjustRest, skipRest } = useWorkouts();
  const pathname = usePathname();
  const now = useNowTick();

  const remaining = restTimer ? Math.ceil((restTimer.endsAt - now) / 1000) : 0;

  // When the countdown hits zero, show a brief "rest over" flash then clear.
  useEffect(() => {
    if (restTimer && remaining <= 0) {
      const t = setTimeout(() => skipRest(), 2600);
      return () => clearTimeout(t);
    }
  }, [restTimer, remaining <= 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Next up" while resting: the first unchecked set across the session,
  // so the bar can be loaded before the timer ends.
  const nextUp = (() => {
    if (!session) {
      return null;
    }
    for (const ex of session.exercises) {
      const set = ex.sets.find((s) => !s.completed);
      if (set) {
        if (set.weight && set.reps) {
          return `Next up: ${ex.name}. ${set.weight} ${session.unit} × ${set.reps}`;
        }
        return `Next up: ${ex.name}`;
      }
    }
    return null;
  })();

  // Not on the finish step (W1): it is the commit surface, so a countdown
  // prompting the next set contradicts the task, and the dock's tab-bar
  // anchoring would slide under the step's taller pinned save bar
  // (composition canon 08 §58: pinned elements displace, never overlap).
  // The rest state itself survives; going back to the player revives it.
  if (!restTimer || pathname.startsWith("/workouts/active/finish")) {
    return null;
  }

  if (remaining <= 0) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: role="status" is the standard live-region idiom; swapping to <output> changes element semantics and default display for zero AT gain.
      <div
        className="pointer-events-auto flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-card px-4 py-3.5 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
        role="status"
      >
        <Timer aria-hidden className="size-5 text-emerald-500" />
        <span className="font-semibold text-[15px] text-emerald-600 dark:text-emerald-400">
          Rest over. Next set!
        </span>
      </div>
    );
  }

  const progress = Math.max(0, Math.min(1, remaining / restTimer.totalSeconds));
  return (
    <div
      aria-label={`Rest timer: ${remaining} seconds left`}
      className="pointer-events-auto overflow-hidden rounded-2xl border border-input bg-popover shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
      role="timer"
    >
      <div className="px-3.5 pt-2 pb-2.5">
        <div className="flex items-center gap-1.5 font-semibold text-[11.5px] text-muted-foreground uppercase tracking-wider">
          <Timer aria-hidden className="size-3.5 text-[var(--progress)]" />
          <span className="truncate">Resting · {restTimer.exerciseName}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <div className="shrink-0 font-bold font-mono text-[30px] text-foreground leading-none tabular-nums">
            {formatClock(remaining)}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              aria-label="Shorten rest by 15 seconds"
              className="min-h-[44px] cursor-pointer rounded-lg bg-muted/70 px-2.5 font-semibold text-[13px] text-muted-foreground transition hover:text-foreground"
              onClick={() => adjustRest(-15)}
              type="button"
            >
              −15s
            </button>
            <button
              aria-label="Extend rest by 15 seconds"
              className="min-h-[44px] cursor-pointer rounded-lg bg-muted/70 px-2.5 font-semibold text-[13px] text-muted-foreground transition hover:text-foreground"
              onClick={() => adjustRest(15)}
              type="button"
            >
              +15s
            </button>
            <button
              className="min-h-[44px] cursor-pointer rounded-lg bg-muted/70 px-3 font-semibold text-[13px] text-foreground transition hover:bg-muted"
              onClick={skipRest}
              type="button"
            >
              Skip
            </button>
          </div>
        </div>
        {nextUp && (
          <div className="mt-1 truncate text-[12.5px] text-muted-foreground">
            {nextUp}
          </div>
        )}
      </div>
      {/* Draining track: rest is progress toward the next set (emerald, the
          same family the "Rest over" flash already uses above). */}
      <div className="h-1 w-full bg-muted/60">
        <div
          className="h-full bg-[var(--progress)] transition-[width] duration-1000 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

/** Fixed layer parked above the bottom tab bar, never over it (flaws
 * RUN-01): rest timer + session mini bar. */
export function WorkoutDocks() {
  return (
    <div className="bottom-above-tabbar pointer-events-none fixed inset-x-0 z-40 mx-auto flex w-full max-w-[560px] flex-col gap-2 px-3">
      <RestTimerDock />
      <SessionMiniBar />
    </div>
  );
}
