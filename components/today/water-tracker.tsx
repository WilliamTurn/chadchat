"use client";

import {
  Check,
  Droplet,
  Droplets,
  GlassWater,
  Plus,
  Undo2,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { addWater, logWaterAmount, removeWater } from "@/app/nutrition/actions";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { IconChip } from "@/components/today/icon-chip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const GLASS_ML = 250;
const MAX_CUSTOM_ML = 2000;

/** Pretty-print a milliliter amount as "1.25 L" / "750 ml". */
function formatMl(ml: number): string {
  if (ml >= 1000) {
    const liters = ml / 1000;
    const text = liters.toFixed(ml % 1000 === 0 ? 0 : 2).replace(/\.?0+$/, "");
    return `${text} L`;
  }
  return `${Math.round(ml)} ml`;
}

/**
 * Hydration module for the /today dashboard. Renders a WaterMinder-style
 * vessel that visually fills with an animated wave proportional to
 * totalMl / goalMl, plus quick-add controls (glass / bottle / custom) and an
 * undo. Reads totalMl from props and re-renders after router.refresh() so the
 * fill always reflects the live server total.
 */
export function WaterTracker({
  totalMl,
  goalMl = 2000,
}: {
  totalMl: number;
  goalMl?: number;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [pending, startTransition] = useTransition();
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const clipId = useId();

  const safeGoal = goalMl > 0 ? goalMl : 2000;
  const ratio = Math.min(totalMl / safeGoal, 1);
  const percent = Math.round(ratio * 100);
  const glasses = Math.round(totalMl / GLASS_ML);
  const remaining = Math.max(safeGoal - totalMl, 0);
  const reached = totalMl >= safeGoal;

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't update water.");
      }
    });
  }

  function onCustomSubmit(e: FormEvent) {
    e.preventDefault();
    const ml = Math.round(Number(customValue));
    if (!Number.isFinite(ml) || ml <= 0) {
      toast.error("Enter how much you drank, in ml.");
      return;
    }
    run(() => logWaterAmount(ml));
    setCustomValue("");
    setCustomOpen(false);
  }

  // SVG vessel geometry. The water surface sits at y = top of fill; two stacked
  // sine waves drift sideways for a living surface.
  const VIEW = 100;
  const fillTop = VIEW - ratio * VIEW;

  const fillLabel = reached
    ? `Hydration goal reached: ${formatMl(totalMl)} of ${formatMl(safeGoal)}.`
    : `Hydration ${percent}% of goal: ${formatMl(totalMl)} of ${formatMl(
        safeGoal
      )}, ${formatMl(remaining)} to go.`;

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <IconChip tone="sky">
            <Droplets className="size-4" />
          </IconChip>
          <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
            Hydration
          </h2>
        </div>
        <AskChadButton prompt="How's my water intake today? Am I drinking enough, and when should I top up?" />
      </div>

      {/* Hero vessel + readout */}
      <div className="mt-6 flex items-center gap-6">
        <div
          aria-label={fillLabel}
          className="relative size-32 shrink-0 sm:size-36"
          role="img"
        >
          <svg
            aria-hidden="true"
            className="size-full"
            viewBox={`0 0 ${VIEW} ${VIEW}`}
          >
            <defs>
              <linearGradient id={`grad-${clipId}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-sky-300, #7dd3fc)" />
                <stop offset="100%" stopColor="var(--color-sky-500, #0ea5e9)" />
              </linearGradient>
              <clipPath id={`clip-${clipId}`}>
                <circle cx="50" cy="50" r="46" />
              </clipPath>
            </defs>

            {/* Vessel base + ring */}
            <circle className="fill-sky-400/10" cx="50" cy="50" r="46" />

            {/* Water fill, clipped to the circle */}
            <g clipPath={`url(#clip-${clipId})`}>
              <motion.g
                animate={{ y: fillTop }}
                initial={false}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 90, damping: 18 }
                }
              >
                {/* Drifting wave surface */}
                <motion.path
                  animate={reduceMotion ? undefined : { x: [0, -40] }}
                  d="M-40 6 Q -20 0 0 6 T 40 6 T 80 6 T 120 6 T 160 6 V 120 H -40 Z"
                  fill={`url(#grad-${clipId})`}
                  opacity={0.95}
                  transition={
                    reduceMotion
                      ? undefined
                      : {
                          duration: 6,
                          repeat: Number.POSITIVE_INFINITY,
                          ease: "linear",
                        }
                  }
                />
                {/* Second, offset wave for depth */}
                <motion.path
                  animate={reduceMotion ? undefined : { x: [0, -40] }}
                  d="M-40 8 Q -20 14 0 8 T 40 8 T 80 8 T 120 8 T 160 8 V 120 H -40 Z"
                  fill="var(--color-sky-400, #38bdf8)"
                  opacity={0.55}
                  transition={
                    reduceMotion
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

            {/* Crisp ring on top */}
            <circle
              className="fill-none stroke-border"
              cx="50"
              cy="50"
              r="46"
              strokeWidth="2"
            />
            {reached ? (
              <motion.circle
                animate={
                  reduceMotion ? { opacity: 1 } : { opacity: [0.2, 0.7, 0.2] }
                }
                className="fill-none stroke-sky-400"
                cx="50"
                cy="50"
                r="46"
                strokeWidth="3"
                transition={
                  reduceMotion
                    ? undefined
                    : {
                        duration: 2.4,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: "easeInOut",
                      }
                }
              />
            ) : null}
          </svg>

          {/* Centered overlay: percent or celebratory check */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            {reached ? (
              <motion.div
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center"
                initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 16 }}
              >
                <Check
                  className="size-9 text-white drop-shadow"
                  strokeWidth={3}
                />
                <span className="mt-0.5 font-semibold text-white text-xs">
                  Goal hit
                </span>
              </motion.div>
            ) : (
              <span
                className={`font-display font-bold text-3xl ${
                  ratio > 0.55 ? "text-white" : "text-foreground"
                }`}
              >
                {percent}
                <span className="font-semibold text-base">%</span>
              </span>
            )}
          </div>
        </div>

        {/* Numeric readout */}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-display font-bold text-2xl text-foreground tabular-nums">
              {formatMl(totalMl)}
            </span>
            <span className="text-muted-foreground text-sm">
              / {formatMl(safeGoal)}
            </span>
          </div>
          <p className="text-muted-foreground text-sm">
            {glasses} {glasses === 1 ? "glass" : "glasses"} today
          </p>
          <p
            className={`mt-1 font-medium text-sm ${
              reached ? "text-sky-400" : "text-foreground"
            }`}
          >
            {reached ? (
              <span className="inline-flex items-center gap-1">
                Goal hit
                <Droplet className="size-4 fill-sky-400 text-sky-400" />
              </span>
            ) : (
              `${formatMl(remaining)} to go`
            )}
          </p>
        </div>
      </div>

      {/* Quick-add controls */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Button
          aria-label="Add a glass, 250 milliliters"
          className="h-11 flex-col gap-0.5"
          disabled={pending}
          onClick={() => run(addWater)}
          variant="outline"
        >
          <span className="flex items-center gap-1.5 font-medium text-sm">
            <Droplet className="size-4 text-sky-400" />
            Glass
          </span>
          <span className="text-muted-foreground text-xs">+250 ml</span>
        </Button>

        <Button
          aria-label="Add a bottle, 500 milliliters"
          className="h-11 flex-col gap-0.5"
          disabled={pending}
          onClick={() => run(() => logWaterAmount(500))}
          variant="outline"
        >
          <span className="flex items-center gap-1.5 font-medium text-sm">
            <GlassWater className="size-4 text-sky-400" />
            Bottle
          </span>
          <span className="text-muted-foreground text-xs">+500 ml</span>
        </Button>

        <Popover onOpenChange={setCustomOpen} open={customOpen}>
          <PopoverTrigger asChild>
            <Button
              aria-label="Add a custom amount of water"
              className="col-span-2 h-11 flex-col gap-0.5 sm:col-span-1"
              disabled={pending}
              variant="outline"
            >
              <span className="flex items-center gap-1.5 font-medium text-sm">
                <Plus className="size-4 text-sky-400" />
                Custom
              </span>
              <span className="text-muted-foreground text-xs">Any amount</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <form className="flex flex-col gap-3" onSubmit={onCustomSubmit}>
              <div className="flex flex-col gap-1.5">
                <span className="font-medium text-sm">Add water</span>
                <span className="text-muted-foreground text-xs">
                  Enter an amount in milliliters (max {MAX_CUSTOM_ML} ml).
                </span>
              </div>
              <div className="flex gap-2">
                {[330, 750, 1000].map((preset) => (
                  <Button
                    className="h-8 flex-1 px-0 text-xs"
                    key={preset}
                    onClick={() => setCustomValue(String(preset))}
                    type="button"
                    variant="secondary"
                  >
                    {preset}
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  aria-label="Custom water amount in milliliters"
                  autoFocus
                  className="h-10"
                  inputMode="numeric"
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="e.g. 350"
                  value={customValue}
                />
                <Button
                  className="h-10 shrink-0"
                  disabled={pending}
                  type="submit"
                >
                  Add
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      </div>

      {/* Undo */}
      <div className="mt-3 flex justify-end">
        <Button
          aria-label="Undo last water entry"
          className="h-9 gap-1.5 text-muted-foreground text-xs"
          disabled={pending || totalMl <= 0}
          onClick={() => run(removeWater)}
          size="sm"
          variant="ghost"
        >
          <Undo2 className="size-3.5" />
          Undo last
        </Button>
      </div>
    </section>
  );
}
