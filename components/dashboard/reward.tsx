"use client";

import { motion, useReducedMotion } from "motion/react";
import { createContext, type ReactNode, useCallback, useContext } from "react";
import { toast } from "sonner";

/**
 * The shared logging reward (DSH-54): every logger's success moment plays the
 * same short chime, fires a light haptic double-tap on devices that support
 * it, and shows an animated emerald-check toast: the pattern mainstream
 * fitness apps use to make a log feel like a win. Both channels honor the
 * member's /account preferences (User.soundEnabled / hapticsEnabled), threaded
 * in by each logger page via <RewardProvider>. Without a provider both
 * default ON, matching the DB defaults.
 */

type SensoryPrefs = { sound: boolean; haptics: boolean };

const SensoryContext = createContext<SensoryPrefs>({
  sound: true,
  haptics: true,
});

export function RewardProvider({
  sound,
  haptics,
  children,
}: SensoryPrefs & { children: ReactNode }) {
  return (
    <SensoryContext.Provider value={{ sound, haptics }}>
      {children}
    </SensoryContext.Provider>
  );
}

// One lazily-created AudioContext, reused across chimes. Created inside a
// click handler, so autoplay policies allow it.
let audioCtx: AudioContext | null = null;

/** A short two-note rising chime, synthesized so there's no audio asset to
 * load. Quiet by design; failures are swallowed (sound is a nicety). */
function playChime() {
  try {
    if (typeof window === "undefined" || !window.AudioContext) {
      return;
    }
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
    const t0 = audioCtx.currentTime;
    const notes: [number, number][] = [
      [659.25, 0], // E5
      [880, 0.09], // A5
    ];
    for (const [freq, start] of notes) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t0 + start);
      gain.gain.linearRampToValueAtTime(0.06, t0 + start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + 0.22);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + 0.25);
    }
  } catch {
    // Audio is a nicety; never let it break a save.
  }
}

/** Vibration patterns (ms). Only phones/tablets support navigator.vibrate;
 * everywhere else this is a silent no-op. */
const VIBRATION: Record<"success" | "tick" | "timer", number | number[]> = {
  success: [30, 40, 30], // light double-tap: "it landed"
  tick: 15, // barely-there nudge for quick-adds
  timer: 400, // the rest timer's long buzz
};

function vibrate(kind: keyof typeof VIBRATION) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate?.(VIBRATION[kind]);
  }
}

function RewardToastCard({
  message,
  sub,
}: {
  message: string;
  sub?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="flex min-w-72 max-w-full items-center gap-3 rounded-xl border border-border/50 bg-card px-4 py-3 text-foreground shadow-[var(--shadow-float)]">
      <motion.span
        animate={{ scale: 1, opacity: 1 }}
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15"
        initial={reduce ? false : { scale: 0.4, opacity: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 22 }}
      >
        <svg
          aria-hidden="true"
          className="size-4 text-emerald-500"
          fill="none"
          viewBox="0 0 24 24"
        >
          <motion.path
            animate={{ pathLength: 1 }}
            d="M4 12.5l5 5L20 6.5"
            initial={reduce ? false : { pathLength: 0 }}
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
          />
        </svg>
      </motion.span>
      <div className="min-w-0">
        <div className="font-medium text-sm">{message}</div>
        {sub ? (
          <div className="text-muted-foreground text-xs">{sub}</div>
        ) : null}
      </div>
    </div>
  );
}

export function useReward() {
  const prefs = useContext(SensoryContext);

  /** Sound + haptics only, for optimistic quick-adds and moments that
   * already have their own visual (the water vessel, an Undo toast). */
  const effects = useCallback(
    (kind: "success" | "tick" | "timer" = "success") => {
      if (prefs.haptics) {
        vibrate(kind);
      }
      if (prefs.sound && kind !== "tick") {
        playChime();
      }
    },
    [prefs]
  );

  /** The full success moment: animated check toast + chime + haptic. */
  const celebrate = useCallback(
    (message: string, opts?: { sub?: string }) => {
      effects("success");
      toast.custom(() => <RewardToastCard message={message} sub={opts?.sub} />, {
        duration: 3000,
      });
    },
    [effects]
  );

  return { celebrate, effects };
}
