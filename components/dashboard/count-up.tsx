"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/**
 * Headline-number count-up. The dashboards lead with numbers — trend weight, a
 * streak, calories remaining, est. 1RM — and a number that *rolls* up to its
 * value reads as alive where one that snaps reads as static. `CountUp` tweens
 * the first numeric token inside an already-formatted string (so callers keep
 * passing the same `"182.5 lb"` / `"+1.2 lb"` / `"1,850 kcal"` strings) and
 * leaves everything around it — signs, units, "/ 12", emoji — untouched. Strings
 * with no number ("Reached 🎯") render verbatim. Honors reduced motion.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const DEFAULT_DURATION = 0.9;

// First numeric run: optional ASCII sign, digits with optional thousands
// separators, optional decimal part. A real minus glyph ("−", used by the
// signed-delta formatter) is left in the prefix on purpose, so the magnitude
// still counts up while the sign stays put.
const NUMBER_RE = /[+-]?\d[\d,]*(?:\.\d+)?/;

/** Tween a raw number from 0 (on mount) — or its last value — up to `value`. */
function useCountUp(value: number, duration: number): number {
  const reduced = useReducedMotion() ?? false;
  const [display, setDisplay] = useState(() => (reduced ? value : 0));
  const currentRef = useRef(reduced ? value : 0);

  useEffect(() => {
    if (reduced) {
      currentRef.current = value;
      setDisplay(value);
      return;
    }
    const controls = animate(currentRef.current, value, {
      duration,
      ease: EASE,
      onUpdate: (v) => {
        currentRef.current = v;
        setDisplay(v);
      },
    });
    return () => controls.stop();
  }, [value, reduced, duration]);

  return display;
}

export function CountUp({
  value,
  duration = DEFAULT_DURATION,
}: {
  value: string;
  duration?: number;
}) {
  const match = value.match(NUMBER_RE);
  const token = match?.[0] ?? "";
  const target = Number(token.replace(/,/g, ""));
  const animatable = match != null && Number.isFinite(target);

  // Hooks run unconditionally; a non-numeric string just animates a no-op 0.
  const current = useCountUp(animatable ? target : 0, duration);

  if (!(match && animatable)) {
    return <>{value}</>;
  }

  const start = match.index ?? 0;
  const before = value.slice(0, start);
  const after = value.slice(start + token.length);
  const decimals = token.includes(".")
    ? (token.split(".")[1]?.length ?? 0)
    : 0;
  const formatted = current.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: token.includes(","),
  });
  const plus = token.startsWith("+") ? "+" : "";

  return (
    <>
      {before}
      {plus}
      {formatted}
      {after}
    </>
  );
}
