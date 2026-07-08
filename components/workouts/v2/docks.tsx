"use client";

// Floating layer at the bottom of every /workouts page: the rest-timer
// countdown and the workout-in-progress mini bar (music-player pattern), so a
// live session is always one tap away and never silently lost.

import { Play, Timer } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { formatClock, sessionCompletedSets } from "./format";
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
  const { session, ready } = useWorkouts();
  const pathname = usePathname();
  const now = useNowTick();
  // Hidden on the player itself; shown everywhere else while a session runs.
  if (!(ready && session) || pathname.startsWith("/workouts/session")) {
    return null;
  }
  const done = sessionCompletedSets(session.exercises);
  const elapsed = timerElapsedSeconds(session.timer, now);
  return (
    <Link
      className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-blood/40 bg-card px-4 py-3 shadow-[0_12px_32px_rgba(0,0,0,0.45)] transition-transform active:scale-[0.99]"
      href="/workouts/session"
    >
      <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-blood text-white">
        <Play aria-hidden className="size-5 fill-current" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold text-[15px] text-foreground">
          {session.name}
        </span>
        <span className="block text-[12.5px] text-muted-foreground">
          Workout in progress · {done} {done === 1 ? "set" : "sets"} done
        </span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-mono font-semibold text-[17px] text-blood tabular-nums">
          {session.timer.running || elapsed > 0 ? formatClock(elapsed) : "-"}
        </span>
        <span className="block font-semibold text-[11px] text-blood/70 uppercase tracking-wider">
          Resume
        </span>
      </span>
    </Link>
  );
}

function RestTimerDock() {
  const { session, restTimer, adjustRest, skipRest } = useWorkouts();
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

  if (!restTimer) {
    return null;
  }

  if (remaining <= 0) {
    return (
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
          <Timer aria-hidden className="size-3.5 text-blood" />
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
      {/* Draining track */}
      <div className="h-1 w-full bg-muted/60">
        <div
          className="h-full bg-blood transition-[width] duration-1000 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}

/** Fixed layer above the bottom edge: rest timer + session mini bar. */
export function WorkoutDocks() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-40 mx-auto flex w-full max-w-[560px] flex-col gap-2 px-3 md:bottom-5">
      <RestTimerDock />
      <SessionMiniBar />
    </div>
  );
}
