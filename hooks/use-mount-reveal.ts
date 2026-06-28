"use client";

import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

/**
 * A one-time "draw-in on mount" gate for Recharts series. Returns `true` for the
 * first ~`durationMs` after the chart mounts so its native reveal can play (a
 * line's stroke-dashoffset draw, an area fade, bars growing up), then flips to
 * `false` so every later repaint — range toggles, metric switches, and the
 * scrub/hover crosshair — renders instantly instead of re-animating. Honors
 * `prefers-reduced-motion` by never animating at all.
 *
 * Wire it straight into Recharts: `isAnimationActive={useMountReveal()}`.
 */
export function useMountReveal(durationMs = 750): boolean {
  const reduced = useReducedMotion() ?? false;
  const [done, setDone] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDone(true), durationMs + 150);
    return () => clearTimeout(id);
  }, [durationMs]);

  return !(reduced || done);
}
