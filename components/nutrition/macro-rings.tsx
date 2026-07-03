"use client";

/**
 * Today's fuel — a single hero calorie dial plus three clearly-labeled macro
 * bars (protein / carbs / fat), styled the way pro nutrition apps do it.
 *
 * - The calorie ring is the hero: amber (the nutrition accent, VF-7) while
 *   filling toward the target, flipping to blood red ONLY when over — so red
 *   stays a genuine alert instead of the ring's everyday color. Its center
 *   shows calories REMAINING (or the overage in blood red, or just the
 *   running total when no target is set).
 * - Each macro is its own labeled row with a horizontal progress bar, its own
 *   accent color, and an "Xg left" / "Xg over" hint.
 * - Tapping the ring or any macro reveals an inline detail (consumed vs target
 *   vs % of goal). Everything animates in on mount and respects reduced motion.
 *
 * Renders inside a parent card that already supplies chrome + a "Today's fuel"
 * title, so the root is a plain <div> with no card/title of its own.
 *
 * Two variants (LC-17): the default "diary" reads as today's live eating
 * status ("calories remaining", "Xg left"). The meal plan passes
 * variant="plan", which speaks plan-vs-target ("164 cal under target",
 * "28g under target") and colors the ring by how well the planned day hits
 * its target (same ±8% band as the day-switcher cards: emerald on target,
 * amber under, blood over), so a planned day can never be mistaken for
 * today's eating status.
 */

import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { CountUp } from "@/components/dashboard/count-up";

type RingVariant = "diary" | "plan";

type RingProps = {
  caloriesConsumed: number;
  caloriesTarget: number | null;
  proteinConsumed: number;
  proteinTarget: number | null;
  carbsConsumed: number;
  carbsTarget: number | null;
  fatConsumed: number;
  fatTarget: number | null;
  /**
   * "diary" (default) = today's live eating status ("calories remaining").
   * "plan" = a planned day judged against its target ("164 cal under target").
   */
  variant?: RingVariant;
  /**
   * Copy overrides for non-diary contexts. The defaults read for "today's
   * diary" (what you've eaten); a meal plan, for example, passes "Planned" /
   * "kcal / day" so the same dial reads correctly against a planned day.
   */
  consumedLabel?: string;
  noTargetSub?: string;
  /**
   * Optional call-to-action shown below the dial when no calorie target is set
   * (e.g. a "Set your targets" button). With no target the ring is rendered as
   * a deliberate dashed ghost rather than a full gray ring that reads as broken.
   */
  emptyCta?: React.ReactNode;
};

const EASE = [0.22, 1, 0.36, 1] as const;

// Hero ring geometry.
const SIZE = 168;
const CENTER = SIZE / 2;
const STROKE = 14;
const RADIUS = CENTER - STROKE / 2 - 2;
const CIRC = 2 * Math.PI * RADIUS;

const round = (n: number) => Math.round(n);

function pct(consumed: number, target: number | null): number | null {
  if (!target || target <= 0) {
    return null;
  }
  return Math.round((consumed / target) * 100);
}

/**
 * Plan mode: how well a planned amount hits its target. The ±8% band matches
 * the meal plan's day-switcher cards so the whole page judges a day the same
 * way: emerald within the band, amber meaningfully under, blood over.
 */
type PlanBand = "under" | "on" | "over";

function planBand(planned: number, target: number): PlanBand {
  const ratio = planned / target;
  if (ratio > 1.08) {
    return "over";
  }
  if (ratio < 0.92) {
    return "under";
  }
  return "on";
}

const PLAN_BAND_TEXT: Record<PlanBand, string> = {
  under: "text-amber-500",
  on: "text-emerald-500",
  over: "text-blood",
};

/** Exact plan-vs-target wording: "164 cal under target" / "on target". */
function planDeltaCopy(planned: number, target: number, unit: string): string {
  const delta = round(planned) - round(target);
  if (delta === 0) {
    return "on target";
  }
  const dir = delta < 0 ? "under" : "over";
  return `${Math.abs(delta).toLocaleString()}${unit} ${dir} target`;
}

/* ------------------------------------------------------------------ */
/* Hero calorie dial                                                  */
/* ------------------------------------------------------------------ */

function CalorieDial({
  consumed,
  target,
  reduced,
  consumedLabel,
  noTargetSub,
  variant,
}: {
  consumed: number;
  target: number | null;
  reduced: boolean;
  consumedLabel: string;
  noTargetSub: string;
  variant: RingVariant;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  const isPlan = variant === "plan";
  const hasTarget = target != null && target > 0;
  const fraction = hasTarget ? consumed / (target as number) : 0;
  const over = hasTarget && consumed > (target as number);
  const remaining = hasTarget ? (target as number) - consumed : 0;
  const percent = pct(consumed, target);
  const band: PlanBand | null =
    isPlan && hasTarget ? planBand(consumed, target as number) : null;

  // Visible sweep is clamped to a full ring; overage is signaled by color.
  const sweep = Math.max(0, Math.min(1, fraction));
  const dashOffset = CIRC * (1 - sweep);

  const ariaLabel = hasTarget
    ? isPlan
      ? `Planned: ${round(consumed)} of ${round(target as number)} cal, ${planDeltaCopy(consumed, target as number, " cal")}. Tap for details.`
      : over
        ? `Calories: ${round(consumed)} of ${round(target as number)} cal, ${round(consumed - (target as number))} over target. Tap for details.`
        : `Calories: ${round(consumed)} of ${round(target as number)} cal, ${round(remaining)} remaining. Tap for details.`
    : isPlan
      ? `Planned: ${round(consumed)} cal. Tap for details.`
      : `Calories: ${round(consumed)} cal logged today. Tap for details.`;

  // Center copy.
  let big: string;
  let sub: string;
  let bigClass = "fill-foreground";
  if (!hasTarget) {
    big = consumed > 0 ? round(consumed).toLocaleString() : "—";
    sub = consumed > 0 ? noTargetSub : "no target yet";
  } else if (isPlan) {
    // Plan mode: the big number is what the day plans, never a "remaining"
    // countdown; the delta pill below the dial carries the target verdict.
    big = round(consumed).toLocaleString();
    sub = "calories planned";
  } else if (over) {
    big = round(consumed - (target as number)).toLocaleString();
    sub = "calories over";
    bigClass = "fill-blood";
  } else {
    big = round(remaining).toLocaleString();
    sub = "calories remaining";
  }

  // Ring fill: diary fills amber and flips blood only when over; plan is
  // judged by the band so the two rings never read as the same instrument.
  const fillClass = isPlan
    ? band === "over"
      ? "text-blood"
      : band === "under"
        ? "text-amber-500"
        : "text-emerald-500"
    : over
      ? "text-blood"
      : "text-amber-500";
  const glowClass = isPlan
    ? band === "over"
      ? "bg-blood/12"
      : band === "under"
        ? "bg-amber-400/12"
        : "bg-emerald-400/12"
    : hasTarget && consumed > 0
      ? "bg-amber-400/15"
      : "bg-amber-400/8";

  return (
    <div className="flex flex-col items-center">
      <button
        aria-expanded={open}
        aria-label={ariaLabel}
        className="group relative rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-blood focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        {/* Soft domain glow behind the hero dial (VF-18) — a touch stronger
            once there's real fill to light up. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-3 rounded-full blur-2xl ${glowClass}`}
        />
        <svg
          aria-labelledby={titleId}
          height={SIZE}
          role="img"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width={SIZE}
        >
          <title id={titleId}>{ariaLabel}</title>
          {/* Track — a dashed ghost ring when there's no target, so the empty
              state reads as "set a goal" rather than a broken full ring. */}
          <circle
            className={hasTarget ? "text-border/60" : "text-border"}
            cx={CENTER}
            cy={CENTER}
            fill="none"
            r={RADIUS}
            stroke="currentColor"
            strokeDasharray={hasTarget ? undefined : "2 8"}
            strokeLinecap={hasTarget ? undefined : "round"}
            strokeWidth={hasTarget ? STROKE : STROKE - 6}
          />
          {/* Fill — only when a target exists; overage is signaled by color:
              amber while on track, blood ONLY when over (VF-7). */}
          {hasTarget && (
            <motion.circle
              animate={{ strokeDashoffset: dashOffset }}
              className={fillClass}
              cx={CENTER}
              cy={CENTER}
              fill="none"
              initial={{ strokeDashoffset: reduced ? dashOffset : CIRC }}
              r={RADIUS}
              stroke="currentColor"
              strokeDasharray={CIRC}
              strokeLinecap="round"
              strokeWidth={STROKE}
              transform={`rotate(-90 ${CENTER} ${CENTER})`}
              transition={{ duration: reduced ? 0 : 1, ease: EASE }}
            />
          )}
          {/* Center text */}
          <text
            className={`${bigClass} font-display font-bold`}
            dominantBaseline="middle"
            fontSize="34"
            textAnchor="middle"
            x={CENTER}
            y={CENTER - 8}
          >
            <CountUp value={big} />
          </text>
          <text
            className="fill-muted-foreground"
            dominantBaseline="middle"
            fontSize="13"
            textAnchor="middle"
            x={CENTER}
            y={CENTER + 18}
          >
            {sub}
          </text>
        </svg>
        {/* hover/focus affordance dot */}
        <span
          aria-hidden
          className="-bottom-0.5 -translate-x-1/2 absolute left-1/2 size-1.5 rounded-full bg-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        />
      </button>

      {/* Plan mode: the target verdict in words ("164 cal under target"),
          never the diary's "remaining" (LC-17). */}
      {isPlan && hasTarget && band && (
        <span
          className={`mt-2 rounded-full border border-border bg-background/60 px-3 py-1 font-medium text-xs ${PLAN_BAND_TEXT[band]}`}
        >
          {planDeltaCopy(consumed, target as number, " cal")}
        </span>
      )}

      {/* Inline detail — calories */}
      <motion.div
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        className="overflow-hidden"
        initial={false}
        transition={{ duration: reduced ? 0 : 0.28, ease: EASE }}
      >
        <div className="mt-3 flex items-center gap-4 rounded-xl border border-border bg-background/60 px-4 py-2.5 text-sm">
          <Detail
            label={consumedLabel}
            value={`${round(consumed).toLocaleString()}`}
          />
          {hasTarget && (
            <>
              <Divider />
              <Detail
                label="Target"
                value={`${round(target as number).toLocaleString()}`}
              />
              <Divider />
              <Detail
                accent={
                  band
                    ? PLAN_BAND_TEXT[band]
                    : over
                      ? "text-blood"
                      : "text-emerald-500"
                }
                label={
                  isPlan
                    ? round(remaining) === 0
                      ? "on target"
                      : over
                        ? "Over"
                        : "Under"
                    : over
                      ? "Over"
                      : "Left"
                }
                value={
                  isPlan && round(remaining) === 0
                    ? "±0"
                    : `${round(Math.abs(remaining)).toLocaleString()}`
                }
              />
              {percent != null && (
                <>
                  <Divider />
                  <Detail
                    label={isPlan ? "of target" : "of goal"}
                    value={`${percent}%`}
                  />
                </>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function Detail({
  label,
  value,
  accent = "text-foreground",
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col">
      <span className={`font-display font-semibold text-base ${accent}`}>
        {value}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="h-7 w-px shrink-0 bg-border" />;
}

/* ------------------------------------------------------------------ */
/* Macro row                                                          */
/* ------------------------------------------------------------------ */

function MacroBar({
  label,
  consumed,
  target,
  textColor,
  barColor,
  reduced,
  consumedLabel,
  variant,
}: {
  label: string;
  consumed: number;
  target: number | null;
  textColor: string;
  barColor: string;
  reduced: boolean;
  consumedLabel: string;
  variant: RingVariant;
}) {
  const [open, setOpen] = useState(false);

  const isPlan = variant === "plan";
  const hasTarget = target != null && target > 0;
  const fraction = hasTarget ? consumed / (target as number) : 0;
  const over = hasTarget && consumed > (target as number);
  const remaining = hasTarget ? (target as number) - consumed : 0;
  const percent = pct(consumed, target);
  const band: PlanBand | null =
    isPlan && hasTarget ? planBand(consumed, target as number) : null;
  // With no target there's nothing to fill toward, so the bar stays a ghost
  // track (a full bar would falsely read as "100% / maxed out").
  const width = hasTarget ? Math.max(0, Math.min(1, fraction)) * 100 : 0;

  const hint = hasTarget
    ? isPlan
      ? planDeltaCopy(consumed, target as number, "g")
      : over
        ? `${round(consumed - (target as number))}g over`
        : `${round(remaining)}g left`
    : "no goal set";
  const hintClass = hasTarget
    ? band
      ? PLAN_BAND_TEXT[band]
      : over
        ? "text-blood"
        : "text-emerald-500"
    : "text-muted-foreground";

  const ariaLabel = hasTarget
    ? `${label}: ${round(consumed)} of ${round(target as number)} grams, ${hint}. Tap for details.`
    : `${label}: ${round(consumed)} grams logged. Tap for details.`;

  return (
    <button
      aria-expanded={open}
      aria-label={ariaLabel}
      className="group block w-full rounded-xl px-2 py-2 text-left outline-none transition-colors hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-blood/70"
      onClick={() => setOpen((v) => !v)}
      type="button"
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-2">
          <span aria-hidden className={`size-2.5 rounded-full ${barColor}`} />
          <span className="font-medium text-foreground text-sm">{label}</span>
        </span>
        <span className="font-display font-semibold text-base tabular-nums">
          {round(consumed)}
          <span className="text-muted-foreground text-xs">
            {hasTarget ? ` / ${round(target as number)}g` : "g"}
          </span>
        </span>
      </div>

      {/* Track + fill */}
      <div
        className={`mt-2 h-2.5 w-full overflow-hidden rounded-full ${
          hasTarget ? "bg-border/60" : "bg-border/40"
        }`}
      >
        <motion.div
          animate={{ width: `${width}%` }}
          className={`h-full rounded-full ${
            (isPlan ? band === "over" : over) ? "bg-blood" : barColor
          }`}
          initial={{ width: reduced ? `${width}%` : 0 }}
          transition={{ duration: reduced ? 0 : 0.9, ease: EASE }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <span className={`text-xs ${hintClass}`}>{hint}</span>
        {percent != null && (
          <span
            className={`text-xs tabular-nums ${
              (isPlan ? band === "over" : over) ? "text-blood" : textColor
            }`}
          >
            {percent}%
          </span>
        )}
      </div>

      {/* Inline detail */}
      <motion.div
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        className="overflow-hidden"
        initial={false}
        transition={{ duration: reduced ? 0 : 0.28, ease: EASE }}
      >
        <div className="mt-2 flex items-center gap-4 rounded-lg border border-border bg-background/60 px-3 py-2 text-sm">
          <Detail label={consumedLabel} value={`${round(consumed)}g`} />
          {hasTarget && (
            <>
              <Divider />
              <Detail label="Target" value={`${round(target as number)}g`} />
              <Divider />
              <Detail
                accent={
                  band
                    ? PLAN_BAND_TEXT[band]
                    : over
                      ? "text-blood"
                      : "text-emerald-500"
                }
                label={
                  isPlan
                    ? round(remaining) === 0
                      ? "on target"
                      : over
                        ? "Over"
                        : "Under"
                    : over
                      ? "Over"
                      : "Left"
                }
                value={
                  isPlan && round(remaining) === 0
                    ? "±0"
                    : `${round(Math.abs(remaining))}g`
                }
              />
            </>
          )}
        </div>
      </motion.div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Public component                                                   */
/* ------------------------------------------------------------------ */

export function MacroRings({
  caloriesConsumed,
  caloriesTarget,
  proteinConsumed,
  proteinTarget,
  carbsConsumed,
  carbsTarget,
  fatConsumed,
  fatTarget,
  variant = "diary",
  consumedLabel = "Eaten",
  noTargetSub = "calories today",
  emptyCta,
}: RingProps) {
  const reduced = useReducedMotion() ?? false;
  const noTarget = caloriesTarget == null || caloriesTarget <= 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
        <div className="flex shrink-0 justify-center sm:justify-start">
          <CalorieDial
            consumed={caloriesConsumed}
            consumedLabel={consumedLabel}
            noTargetSub={noTargetSub}
            reduced={reduced}
            target={caloriesTarget}
            variant={variant}
          />
        </div>

        <div className="flex w-full flex-col gap-1">
          <MacroBar
            barColor="bg-sky-400"
            consumed={proteinConsumed}
            consumedLabel={consumedLabel}
            label="Protein"
            reduced={reduced}
            target={proteinTarget}
            textColor="text-sky-400"
            variant={variant}
          />
          <MacroBar
            barColor="bg-amber-400"
            consumed={carbsConsumed}
            consumedLabel={consumedLabel}
            label="Carb"
            reduced={reduced}
            target={carbsTarget}
            textColor="text-amber-400"
            variant={variant}
          />
          <MacroBar
            barColor="bg-violet-400"
            consumed={fatConsumed}
            consumedLabel={consumedLabel}
            label="Fat"
            reduced={reduced}
            target={fatTarget}
            textColor="text-violet-400"
            variant={variant}
          />
        </div>
      </div>

      {noTarget && emptyCta && (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-border border-dashed bg-background/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            No daily target set. Add one so your calorie ring and macro bars fill
            toward a goal.
          </p>
          <div className="shrink-0">{emptyCta}</div>
        </div>
      )}
    </div>
  );
}
