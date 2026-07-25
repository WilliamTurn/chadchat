"use client";

// The workout start moment (S4). The FIRST Play press opens this full-screen
// 5-4-3-2-1 countdown (the Nike Training Club / interval-timer pattern)
// with a synthesized tick per count, a distinct "workout begun" cue, and
// vibration where the platform supports it. Skip starts the workout
// immediately. Pause/Resume never re-enters this; it exists only between the
// initial Play press and the clock's first second, and it never survives a
// reload (the store strips a persisted countdown on hydrate).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eyebrow, WButton } from "./ui";

// ---------------------------------------------------------------------------
// Synthesized cues, the Strong/Hevy approach: short WebAudio tones, no audio
// assets. The AudioContext is created inside the Play press (a user gesture),
// so autoplay policy never mutes the countdown.
// ---------------------------------------------------------------------------

let audioCtx: AudioContext | null = null;

/** Call from the Play press itself: creates/resumes the shared AudioContext
 * inside the user gesture so the cues scheduled seconds later may sound. */
export function primeStartCues() {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {
        // Still suspended: the countdown runs, just silently.
      });
    }
  } catch {
    // No WebAudio: the countdown still runs, silently.
  }
}

function tone(freq: number, at: number, duration: number, peak: number) {
  if (!audioCtx) {
    return;
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(at);
  osc.stop(at + duration + 0.05);
}

function playTick() {
  try {
    if (audioCtx) {
      tone(620, audioCtx.currentTime, 0.12, 0.12);
    }
  } catch {
    // Audio is a garnish; never let it break the countdown.
  }
}

/** The distinct "workout begun" cue: a short rising two-note. */
function playBegun() {
  try {
    if (audioCtx) {
      const t = audioCtx.currentTime;
      tone(659, t, 0.12, 0.14);
      tone(988, t + 0.12, 0.4, 0.18);
    }
  } catch {
    // Same as above.
  }
}

/** Rest-over completion cue (S6 flow audit F-6; canon 03 §130: completion
 * signals through every appropriate channel, members are mid-set with the
 * phone face-down). Reuses the primed AudioContext from the Play press; if
 * it was never primed the cue is silent and the visual state still carries
 * it. Silent mode wins on iOS; vibration is Android-only best effort. */
export function playRestOverCue() {
  playBegun();
  buzz([120, 60, 120]);
}

/** Android Chrome vibrates; iOS browsers expose no vibration API, so the
 * optional call simply never runs there. */
function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Vibration is best-effort everywhere.
  }
}

// ---------------------------------------------------------------------------
// The overlay
// ---------------------------------------------------------------------------

const RING_RADIUS = 104;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function StartCountdown({
  endsAt,
  totalMs,
  phase,
  onBegin,
  onCancel,
}: {
  /** Epoch ms when the countdown reaches zero. */
  endsAt: number;
  /** Full countdown length in ms (drives the draining ring). */
  totalMs: number;
  /** "counting" while the countdown runs; the parent switches to "begun"
   * for the brief Go flash after the clock has started. */
  phase: "counting" | "begun";
  /** The workout begins: the caller starts the clock (countdown reached
   * zero, or the member pressed Skip). Cues fire in here, not the caller. */
  onBegin: () => void;
  /** A countdown that is already stale on mount (stray state) returns to
   * the pre-start screen instead of auto-starting the workout. */
  onCancel: () => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const reducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    []
  );
  const skipRef = useRef<HTMLButtonElement>(null);
  const lastTicked = useRef<number | null>(null);
  const sawTimeLeft = useRef(false);
  const begun = useRef(false);

  const remaining = Math.max(0, endsAt - nowMs);
  const digit = Math.max(1, Math.ceil(remaining / 1000));
  const ringProgress = totalMs > 0 ? remaining / totalMs : 0;

  // Smooth clock for the draining ring; the digit derives from it too.
  useEffect(() => {
    let raf = requestAnimationFrame(function loop() {
      setNowMs(Date.now());
      raf = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const begin = useCallback(() => {
    if (begun.current) {
      return;
    }
    begun.current = true;
    playBegun();
    buzz([70, 60, 220]);
    onBegin();
  }, [onBegin]);

  // One tick (sound + vibration) per count, including the first.
  useEffect(() => {
    if (phase !== "counting" || remaining <= 0) {
      return;
    }
    if (digit !== lastTicked.current) {
      lastTicked.current = digit;
      playTick();
      buzz(25);
    }
  }, [digit, phase, remaining]);

  // Zero. If the countdown never had time left on this mount it is stale
  // state, and backing out is the only move that can't auto-start anything.
  useEffect(() => {
    if (phase !== "counting") {
      return;
    }
    if (remaining > 0) {
      sawTimeLeft.current = true;
    } else if (sawTimeLeft.current) {
      begin();
    } else {
      onCancel();
    }
  }, [remaining, phase, begin, onCancel]);

  // Keyboard contract: focus lands on Skip (Enter starts immediately);
  // Escape aborts back to the pre-start screen, per platform convention.
  useEffect(() => {
    skipRef.current?.focus();
  }, []);
  useEffect(() => {
    if (phase !== "counting") {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !begun.current) {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, onCancel]);

  return createPortal(
    <div
      aria-label="Starting workout"
      aria-modal="true"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 px-6 backdrop-blur-xl"
      role="dialog"
    >
      <Eyebrow>{phase === "begun" ? "Workout started" : "Get ready"}</Eyebrow>

      {/* The instrument: a draining ring around the count. */}
      <div className="relative mt-6 flex size-56 items-center justify-center">
        <svg
          aria-hidden="true"
          className="-rotate-90 absolute inset-0"
          role="presentation"
          viewBox="0 0 220 220"
        >
          <circle
            className="text-border"
            cx="110"
            cy="110"
            fill="none"
            r={RING_RADIUS}
            stroke="currentColor"
            strokeWidth="3"
          />
          <circle
            className="text-foreground"
            cx="110"
            cy="110"
            fill="none"
            r={RING_RADIUS}
            stroke="currentColor"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={
              phase === "begun" || reducedMotion
                ? 0
                : RING_CIRCUMFERENCE * (1 - ringProgress)
            }
            strokeLinecap="round"
            strokeWidth="3"
          />
        </svg>
        {/* biome-ignore lint/a11y/useSemanticElements: role=status is the live-region idiom used app-wide. */}
        <div aria-live="assertive" role="status">
          <span
            className="block animate-in font-mono font-semibold text-8xl text-foreground tabular-nums leading-none duration-300 fade-in zoom-in-75 motion-reduce:animate-none"
            key={phase === "begun" ? "begun" : digit}
          >
            {phase === "begun" ? "Go" : digit}
          </span>
        </div>
      </div>

      {/* Reserved slot either way, so the stage never jumps when Skip goes. */}
      <div className="mt-10 flex min-h-12 items-center">
        {phase === "counting" && (
          <WButton onClick={begin} ref={skipRef} variant="secondary">
            Skip countdown
          </WButton>
        )}
      </div>
    </div>,
    document.body
  );
}
