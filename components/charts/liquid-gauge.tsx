"use client";

import { Check } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

/**
 * LIQUID GAUGE (P56-C, FIX-26; new signature visual type per briefing rule 9).
 * A vessel that visibly fills with a living liquid surface as the member
 * logs: the category-defining hydration visual (rule-8 evidence: WaterMinder
 * and Waterllama, the two leading hydration apps, both build their entire
 * experience around a filling vessel; see evidence-p56c/benchmark-teardown.md
 * and the registry candidates in evidence-p56c/visual-hunt.md). Refined from
 * the in-house WaterTracker vessel rather than a new dependency: zero added
 * first-load bytes (FIX-41).
 *
 * Honesty rules: the fill height is exactly `fraction` of the vessel (clamped
 * at a full lap for display; the label may exceed 100%), there is no fill
 * without logs, and reduced motion renders a calm, static surface. Colors
 * ride the chart tokens (Color Law: domain accent for data, emerald only for
 * a goal verdict, which here is the `reached` ring).
 */
export function LiquidGauge({
  fraction,
  reached = false,
  size = 88,
  label,
  ariaLabel,
  className,
  colors = {
    /** Wave gradient top / bottom + the offset second wave (hydration sky;
     *  Tailwind v4 palette tokens, resolved from the compiled theme). */
    surface: "var(--color-sky-300)",
    deep: "var(--color-sky-500)",
    back: "var(--color-sky-400)",
    /** The faint vessel tint behind the liquid. */
    tint: "var(--color-sky-400)",
  },
}: {
  /** 0..1+ of the daily goal. The visual clamps; the label may exceed 100%. */
  fraction: number;
  /** Goal-reached celebration: pulsing ring + check (a real verdict only). */
  reached?: boolean;
  size?: number;
  /** Center overlay; defaults to the rounded percent. */
  label?: ReactNode;
  /** One plain sentence for screen readers (the visual is one image). */
  ariaLabel: string;
  className?: string;
  colors?: { surface: string; deep: string; back: string; tint: string };
}) {
  const reduce = useReducedMotion();
  const uid = useId();
  const ratio = Math.min(Math.max(fraction, 0), 1);
  const VIEW = 100;
  // The liquid surface's resting y inside the viewBox; the wave paths carry
  // ~6px of crest above their own origin, so an empty vessel stays empty.
  const fillTop = VIEW - ratio * VIEW;
  const percent = Math.round(fraction * 100);

  return (
    <div
      aria-label={ariaLabel}
      className={cn("relative shrink-0", className)}
      role="img"
      style={{ width: size, height: size }}
    >
      <svg aria-hidden="true" className="size-full" viewBox={`0 0 ${VIEW} ${VIEW}`}>
        <defs>
          <linearGradient id={`lg-grad-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={colors.surface} />
            <stop offset="100%" stopColor={colors.deep} />
          </linearGradient>
          <clipPath id={`lg-clip-${uid}`}>
            <circle cx="50" cy="50" r="46" />
          </clipPath>
        </defs>

        {/* Vessel base tint */}
        <circle cx="50" cy="50" fill={colors.tint} opacity={0.1} r="46" />

        {/* Liquid, clipped to the vessel */}
        <g clipPath={`url(#lg-clip-${uid})`}>
          <motion.g
            animate={{ y: fillTop }}
            initial={false}
            transition={
              reduce
                ? { duration: 0 }
                : { type: "spring", stiffness: 90, damping: 18 }
            }
          >
            {/* Drifting front wave */}
            <motion.path
              animate={reduce ? undefined : { x: [0, -40] }}
              d="M-40 6 Q -20 0 0 6 T 40 6 T 80 6 T 120 6 T 160 6 V 120 H -40 Z"
              fill={`url(#lg-grad-${uid})`}
              opacity={0.95}
              transition={
                reduce
                  ? undefined
                  : {
                      duration: 6,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "linear",
                    }
              }
            />
            {/* Offset back wave for depth */}
            <motion.path
              animate={reduce ? undefined : { x: [0, -40] }}
              d="M-40 8 Q -20 14 0 8 T 40 8 T 80 8 T 120 8 T 160 8 V 120 H -40 Z"
              fill={colors.back}
              opacity={0.55}
              transition={
                reduce
                  ? undefined
                  : {
                      duration: 4.5,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: "linear",
                    }
              }
            />
          </motion.g>
        </g>

        {/* Crisp vessel ring */}
        <circle
          className="fill-none stroke-border"
          cx="50"
          cy="50"
          r="46"
          strokeWidth="2"
        />
        {/* Goal-reached ring: emerald verdict pulse (Color Law), calm when
            reduced motion is on. */}
        {reached && (
          <motion.circle
            animate={reduce ? { opacity: 0.7 } : { opacity: [0.25, 0.75, 0.25] }}
            cx="50"
            cy="50"
            fill="none"
            r="46"
            stroke="var(--positive)"
            strokeWidth="3"
            transition={
              reduce
                ? undefined
                : {
                    duration: 2.4,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "easeInOut",
                  }
            }
          />
        )}
      </svg>

      {/* Center overlay: percent, or the goal-reached check */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        {reached ? (
          <motion.div
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center"
            initial={reduce ? false : { scale: 0.6, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 16 }}
          >
            {/* Dark ink on the light liquid fill (the WaterMinder pattern):
                sky-950 holds >= 5:1 on the sky-300..500 fill, both themes. */}
            <Check
              aria-hidden="true"
              className="size-7 text-sky-950"
              strokeWidth={3}
            />
            <span className="font-semibold text-meta text-sky-950">
              Goal hit
            </span>
          </motion.div>
        ) : (
          (label ?? (
            <span
              className={cn(
                "font-display font-bold text-xl tabular-nums",
                // Dark ink once the label sits on the liquid (the WaterMinder
                // pattern): sky-950 holds >= 5:1 on the sky fill in both
                // themes, where white measured 2.18 (mobile audit P2).
                ratio > 0.62 ? "text-sky-950" : "text-foreground"
              )}
            >
              {percent}
              <span className="font-semibold text-xs">%</span>
            </span>
          ))
        )}
      </div>
    </div>
  );
}
