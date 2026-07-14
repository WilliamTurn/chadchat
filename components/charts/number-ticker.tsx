"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

/**
 * NUMBER TICKER (P56-C, new chart-system text primitive per briefing rule 9).
 * Headline values roll to their new value instead of snapping, so every
 * quick-add visibly "fills" the number (reward-visual.md: filling things
 * fill). Zero new dependencies: motion/react is already installed (the
 * MagicUI Number Ticker pattern, reimplemented on our stack; see
 * evidence-p56c/visual-hunt.md).
 *
 * Honesty: this animates PRESENTATION of one registered-metric value; the
 * value itself always comes from the caller's canonical source. First render
 * is the true value (no count-up-from-zero theater), reduced motion snaps.
 */
export function NumberTicker({
  value,
  format,
  className,
}: {
  value: number;
  /** Formats the displayed value (pass the contract formatter). */
  format: (value: number) => string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  const reduce = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const from = previous.current;
    previous.current = value;
    if (from === value) {
      el.textContent = format(value);
      return;
    }
    if (reduce) {
      el.textContent = format(value);
      return;
    }
    const controls = animate(from, value, {
      duration: 0.45,
      ease: "easeOut",
      onUpdate: (v) => {
        el.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [value, format, reduce]);

  // Server render + hydration carry the true final value.
  return (
    <span className={className} ref={ref}>
      {format(value)}
    </span>
  );
}
