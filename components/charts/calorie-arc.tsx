"use client";

import { motion, useReducedMotion } from "motion/react";
import { NumberTicker } from "@/components/charts/number-ticker";
import { formatQuantity } from "@/lib/contracts/units";
import { cn } from "@/lib/utils";

/**
 * CALORIE GAUGE ARC (P56-C, FIX-25; new signature visual type per briefing
 * rule 9). The nutrition panel's hero: a 270-degree energy gauge with the
 * REMAINING budget in the center, the framing every category leader hangs
 * its nutrition card on (rule-8 evidence: MacroFactor's remaining-first
 * energy hero, MyFitnessPal's Today calorie dial; see
 * evidence-p56c/benchmark-teardown.md). Pure SVG + motion on installed deps:
 * zero added first-load bytes (FIX-41).
 *
 * Honesty rules: the arc is exactly consumed/target (clamped at a full lap),
 * "over" is a genuine at-most alert so the arc and center flip to the
 * critical token (Color Law), and with no target set the gauge shows the
 * consumed value with a quiet track, never a fake goal. Missing data never
 * reaches this component (the panel's designed empty state owns that).
 */

const VIEW = 100;
const R = 42;
const STROKE = 9;
/** The gauge sweep: 270 degrees, opening at the bottom. */
const SWEEP = 0.75;

export function CalorieArc({
  consumed,
  target,
  size = 104,
  className,
}: {
  consumed: number;
  /** Today's effective-dated calorie target; null = no target set. */
  target: number | null;
  size?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const c = 2 * Math.PI * R;
  const arcLen = c * SWEEP;
  const hasTarget = target != null && target > 0;
  const fraction = hasTarget ? consumed / (target as number) : 0;
  const filled = Math.min(Math.max(fraction, 0), 1);
  const over = hasTarget && consumed > (target as number);
  const remaining = hasTarget ? Math.abs((target as number) - consumed) : 0;

  const arcColor = over ? "var(--critical)" : "var(--chart-3)";

  const ariaLabel = hasTarget
    ? over
      ? `${formatQuantity(consumed, "kcal")} eaten, ${formatQuantity(remaining, "kcal")} over your ${formatQuantity(target as number, "kcal")} target.`
      : `${formatQuantity(consumed, "kcal")} eaten, ${formatQuantity(remaining, "kcal")} left of your ${formatQuantity(target as number, "kcal")} target.`
    : `${formatQuantity(consumed, "kcal")} eaten today. No daily target set.`;

  return (
    <div
      aria-label={ariaLabel}
      className={cn("relative shrink-0", className)}
      role="img"
      style={{ width: size, height: size }}
    >
      <svg aria-hidden className="size-full" viewBox={`0 0 ${VIEW} ${VIEW}`}>
        {/* Track: the full gauge sweep */}
        <circle
          className="stroke-border"
          cx="50"
          cy="50"
          fill="none"
          r={R}
          strokeDasharray={`${arcLen} ${c}`}
          strokeLinecap="round"
          strokeWidth={STROKE}
          transform="rotate(135 50 50)"
        />
        {/* Value arc */}
        {hasTarget && filled > 0 && (
          <motion.circle
            animate={{ strokeDasharray: `${arcLen * filled} ${c}` }}
            cx="50"
            cy="50"
            fill="none"
            initial={
              reduce ? false : { strokeDasharray: `${arcLen * 0.001} ${c}` }
            }
            r={R}
            stroke={arcColor}
            strokeLinecap="round"
            strokeWidth={STROKE}
            transform="rotate(135 50 50)"
            transition={
              reduce
                ? { duration: 0 }
                : { type: "spring", stiffness: 80, damping: 20 }
            }
          />
        )}
      </svg>

      {/* Center: remaining-first framing (or plain consumed with no target) */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <NumberTicker
          className={cn(
            "font-display font-bold text-2xl tabular-nums leading-none",
            over ? "text-critical-text" : "text-foreground"
          )}
          format={(v) => Math.round(v).toLocaleString("en-US")}
          value={hasTarget ? remaining : consumed}
        />
        <span
          className={cn(
            "mt-0.5 text-meta",
            over ? "font-medium text-critical-text" : "text-muted-foreground"
          )}
        >
          {hasTarget ? (over ? "kcal over" : "kcal left") : "kcal today"}
        </span>
      </div>
    </div>
  );
}
