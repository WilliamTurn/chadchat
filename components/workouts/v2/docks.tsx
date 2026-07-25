"use client";

// Floating layer at the bottom of every /workouts page: the rest-timer
// countdown and the workout-in-progress mini bar (music-player pattern), so a
// live session is always one tap away and never silently lost.

import { ChevronRight, Pause, Play, Timer, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm";
import { formatClock, sessionCompletedSets, sessionEngaged } from "./format";
import { playRestOverCue } from "./start-countdown";
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

/** Elapsed time spelled in units for screen readers ("12 min 4 sec"), the
 * one duration format used app-wide (canon 01 §162): a colon clock like
 * "12:04" reads as a ratio or a time of day in AT. */
function elapsedInUnits(totalSeconds: number): string {
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  if (min === 0) {
    return `${sec} sec`;
  }
  return sec === 0 ? `${min} min` : `${min} min ${sec} sec`;
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
  const [discarding, setDiscarding] = useState(false);
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
  const started = session.timer.running || elapsed > 0;
  // Screen-reader label for the whole-bar link: sets and elapsed spelled in
  // units, plural-aware; the zero case is honest, never a bare "0 sets done".
  const setsClause =
    done === 0
      ? "no sets done yet"
      : `${done} ${done === 1 ? "set" : "sets"} done`;
  const elapsedClause = started
    ? `${elapsedInUnits(elapsed)} elapsed`
    : "not started yet";
  return (
    // gap-2: ≥8px between the return target's chevron and the destructive
    // X (placement audit F-6; canon 06 §82, canon 01 §134).
    <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-[var(--go)]/40 bg-card py-2 pr-1.5 pl-4 shadow-[var(--shadow-float)]">
      {/* One tappable return action (music-player pattern): no decorative
          Play square, since a control-shaped icon must be a control (canon 01
          §2) and the ticking clock is already the liveness signal (canon 03
          §128). The trailing chevron is the navigation glyph (comp 08 §39);
          a "go here" microlabel next to it would be redundant (comp 08 §41). */}
      <Link
        aria-label={`Back to your workout: ${session.name}. ${setsClause}, ${elapsedClause}.`}
        className="flex min-w-0 flex-1 items-center gap-3 py-1 transition-transform active:scale-[0.99]"
        href="/workouts/active"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-[15px] text-foreground">
            {session.name}
          </span>
          {/* The count leads and the static prefix is gone (copy audit
              F-12): the bar's presence already says a workout is running,
              and truncation must never eat the one variable fact. */}
          <span className="block truncate text-[12.5px] text-muted-foreground">
            {done === 0
              ? "No sets done yet"
              : `${done} ${done === 1 ? "set" : "sets"} done`}
          </span>
        </span>
        <span className="shrink-0 text-right">
          {started ? (
            <span className="block font-mono font-semibold text-[17px] text-[var(--go)] tabular-nums">
              {formatClock(elapsed)}
            </span>
          ) : (
            // The pre-start state says so in words, never a dash the member
            // must decode (canon 03 §61).
            <span className="block font-semibold text-[var(--go)] text-sm">
              Not started
            </span>
          )}
          {/* The number says what it is (canon 04 §93); suppressed pre-start
              so "Elapsed" never labels "Not started" (copy audit F-13). */}
          {started && (
            <span className="block font-semibold text-[var(--go)]/70 text-xs uppercase tracking-wider">
              Elapsed
            </span>
          )}
        </span>
        <ChevronRight
          aria-hidden
          className="size-5 shrink-0 text-muted-foreground"
        />
      </Link>
      {/* The one way OUT of a live workout from the bar (flaws RUN-02):
          confirmed, never silent, since logged sets are unsaved until Finish.
          Same ConfirmDialog primitive, title, and consequence as the player's
          discard (placement audit F-7; canon 02 §171: one action, one dialog
          layout everywhere). */}
      {/* Seam before the destructive X (composition audit F-10): the bar's
          edge promises one tap target; the divider marks where the return
          link's promise ends and the discard control begins (comp 01 #39
          corollary; 08 #19). */}
      <span aria-hidden className="h-7 w-px shrink-0 bg-border" />
      <Button
        aria-label="Discard this workout"
        className="size-11 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={() => setDiscarding(true)}
        size="icon"
        variant="ghost"
      >
        <X aria-hidden className="size-5" />
      </Button>
      <ConfirmDialog
        body={
          done > 0
            ? `The ${done} ${done === 1 ? "set" : "sets"} you logged will not be saved.`
            : "Its timer will be cleared. Nothing has been saved yet."
        }
        confirmLabel="Discard workout"
        destructive
        onCancel={() => setDiscarding(false)}
        onConfirm={() => {
          discardSession();
          setDiscarding(false);
        }}
        open={discarding}
        // One verb per action (canon 04 §132; canon 01 §131-132): the X
        // discards, it does not also "stop".
        title={`Discard "${session.name}"?`}
      />
    </div>
  );
}

function RestTimerDock() {
  const { session, restTimer, adjustRest, pauseRest, resumeRest, skipRest } =
    useWorkouts();
  const pathname = usePathname();
  const now = useNowTick();

  // The one remaining value the whole component uses (countdown, flash,
  // progress, aria). While paused the frozen pausedRemaining wins; endsAt is
  // stale then, so reading it would tick the clock and fire the auto-skip
  // mid-pause (canon 03 §127: the display must match the real state).
  const paused = restTimer ? restTimer.pausedRemaining != null : false;
  const remaining = restTimer
    ? (restTimer.pausedRemaining ?? Math.ceil((restTimer.endsAt - now) / 1000))
    : 0;

  // When the countdown hits zero: sound + vibration alongside the visual
  // flash (S6 flow audit F-6; canon 03 §130: completion signals through
  // every appropriate channel at once), held long enough to be seen (5s)
  // before the dock clears.
  useEffect(() => {
    if (restTimer && remaining <= 0) {
      playRestOverCue();
      const t = setTimeout(() => skipRest(), 5000);
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
        {/* Calm fact, no exclamation (copy audit F-1; copy.ts
            exclamation-copy). */}
        <span className="font-semibold text-[15px] text-emerald-600 dark:text-emerald-400">
          Rest over.
        </span>
      </div>
    );
  }

  const progress = Math.max(0, Math.min(1, remaining / restTimer.totalSeconds));
  return (
    <div
      aria-label={
        paused
          ? `Rest timer paused: ${remaining} seconds left`
          : `Rest timer: ${remaining} seconds left`
      }
      className="pointer-events-auto overflow-hidden rounded-2xl border border-input bg-popover shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
      role="timer"
    >
      <div className="px-3.5 pt-2 pb-2.5">
        {/* text-xs: the 12px owner type floor is permanent (mobile audit). */}
        <div className="flex items-center gap-1.5 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          <Timer aria-hidden className="size-3.5 text-[var(--progress)]" />
          {/* The frozen clock is explained in words (canon 03 §127). */}
          <span className="truncate">
            Resting · {restTimer.exerciseName}
            {paused && " · Paused"}
          </span>
        </div>
        {/* Clock and controls share a row where they fit; when tight the
            control group wraps beneath the clock as one unit, never an
            orphan control (comp 07 §13). 44px targets, 8px gaps (comp 07
            §51). */}
        <div className="mt-0.5 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <div className="shrink-0 font-bold font-mono text-[30px] text-foreground leading-none tabular-nums">
            {formatClock(remaining)}
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
            {/* Pause swaps in place to Resume: one control, stopwatch
                grammar (canon 01 §135); rest timers offer pause as a
                visible one-tap control (canon 03 §129). */}
            <Button
              aria-label={
                paused ? "Resume the rest timer" : "Pause the rest timer"
              }
              className="size-11 rounded-lg bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={paused ? resumeRest : pauseRest}
              size="icon"
              variant="ghost"
            >
              {paused ? (
                <Play aria-hidden className="size-4 fill-current" />
              ) : (
                <Pause aria-hidden className="size-4 fill-current" />
              )}
            </Button>
            <button
              className="min-h-[44px] cursor-pointer rounded-lg bg-muted/70 px-3 font-semibold text-[13px] text-foreground transition hover:bg-muted"
              onClick={skipRest}
              type="button"
            >
              {/* Verb + object like its siblings (copy audit F-11). */}
              Skip rest
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
