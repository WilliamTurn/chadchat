"use client";

import {
  Check,
  Droplet,
  Droplets,
  Pencil,
  Plus,
  Undo2,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  logWaterAmount,
  removeWater,
  saveWaterGoal,
} from "@/app/nutrition/actions";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import {
  ModuleCard,
  ModuleFooter,
  ModuleHeader,
} from "@/components/today/module-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DEFAULT_WATER_GOAL_ML,
  formatOz,
  formatVolume,
  mlToOz,
  ozToMl,
} from "@/lib/today/water-units";
import type { WaterDay } from "@/lib/today/week";
import { WeekStrip } from "@/components/today/week-strip";

const MAX_CUSTOM_OZ = 64;

/**
 * Hydration module for the /today dashboard. Renders a WaterMinder-style
 * vessel that visually fills with an animated wave proportional to
 * totalMl / goalMl, plus quick-add controls (+8 oz / +16 oz / custom) and an
 * undo. Volumes speak ONLY US ounces & gallons (DSH-24/DSH-34 — no "glasses"
 * or "bottles") though stored in ml; the daily goal defaults to one gallon and
 * is user-customizable. Reads totalMl from props and re-renders after
 * router.refresh() so the fill always reflects the live server total.
 */
export function WaterTracker({
  totalMl,
  goalMl = DEFAULT_WATER_GOAL_ML,
  week,
  viewHref,
}: {
  totalMl: number;
  goalMl?: number;
  /** Rolling 7-day strip (goal hit / partial / nothing) — omit to hide. */
  week?: WaterDay[];
  /** The detail page ("View all →" /hydration) — omit when already on it. */
  viewHref?: string;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [pending, startTransition] = useTransition();
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const clipId = useId();

  const safeGoal = goalMl > 0 ? goalMl : DEFAULT_WATER_GOAL_ML;
  const ratio = Math.min(totalMl / safeGoal, 1);
  const percent = Math.round(ratio * 100);
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
    const oz = Number(customValue);
    if (!Number.isFinite(oz) || oz <= 0) {
      toast.error("Enter how much you drank, in ounces.");
      return;
    }
    run(() => logWaterAmount(ozToMl(oz)));
    setCustomValue("");
    setCustomOpen(false);
  }

  // SVG vessel geometry. The water surface sits at y = top of fill; two stacked
  // sine waves drift sideways for a living surface.
  const VIEW = 100;
  const fillTop = VIEW - ratio * VIEW;

  const fillLabel = reached
    ? `Hydration goal reached: ${formatOz(totalMl)} of ${formatVolume(safeGoal)}.`
    : `Hydration ${percent}% of goal: ${formatOz(totalMl)} of ${formatVolume(
        safeGoal
      )}, ${formatOz(remaining)} to go.`;

  return (
    <ModuleCard>
      <ModuleHeader
        icon={<Droplets className="size-4" />}
        title="Hydration"
        tone="sky"
        viewHref={viewHref}
      />

      {/* Hero vessel + readout */}
      <div className="mt-3 flex items-center gap-6">
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
              {formatOz(totalMl)}
            </span>
            <span className="text-muted-foreground text-sm">
              / {formatVolume(safeGoal)}
            </span>
          </div>
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
              `${formatOz(remaining)} to go`
            )}
          </p>
        </div>
      </div>

      {/* Quick-add controls — plain ounce amounts (DSH-34) */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Button
          aria-label="Add 8 ounces of water"
          className="h-11 gap-1.5 font-medium text-sm"
          disabled={pending}
          onClick={() => run(() => logWaterAmount(ozToMl(8)))}
          variant="outline"
        >
          <Droplet className="size-4 text-sky-400" />
          +8 oz
        </Button>

        <Button
          aria-label="Add 16 ounces of water"
          className="h-11 gap-1.5 font-medium text-sm"
          disabled={pending}
          onClick={() => run(() => logWaterAmount(ozToMl(16)))}
          variant="outline"
        >
          <Droplet className="size-4 text-sky-400" />
          +16 oz
        </Button>

        <Popover onOpenChange={setCustomOpen} open={customOpen}>
          <PopoverTrigger asChild>
            <Button
              aria-label="Add a custom amount of water"
              className="col-span-2 h-11 gap-1.5 font-medium text-sm sm:col-span-1"
              disabled={pending}
              variant="outline"
            >
              <Plus className="size-4 text-sky-400" />
              Custom
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <form className="flex flex-col gap-3" onSubmit={onCustomSubmit}>
              <div className="flex flex-col gap-1.5">
                <span className="font-medium text-sm">Add water</span>
                <span className="text-muted-foreground text-xs">
                  Enter an amount in ounces (max {MAX_CUSTOM_OZ} oz).
                </span>
              </div>
              <div className="flex gap-2">
                {[12, 24, 32].map((preset) => (
                  <Button
                    className="h-8 flex-1 px-0 text-xs"
                    key={preset}
                    onClick={() => setCustomValue(String(preset))}
                    type="button"
                    variant="secondary"
                  >
                    {preset} oz
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  aria-label="Custom water amount in ounces"
                  autoFocus
                  className="h-10"
                  inputMode="numeric"
                  onChange={(e) => setCustomValue(e.target.value)}
                  placeholder="e.g. 20"
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

      {/* Rolling 7-day strip — the compact in-card readout (the full history
          chart lives on the detail page, one surface per domain). Full dot =
          goal hit, faded dot = some water logged, hollow = nothing. Shared
          WeekStrip treatment (R2-1): two-letter labels, Today marker, real
          dates on hover. */}
      {week?.some((d) => d.logged) ? (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-2.5">
          <span className="text-muted-foreground text-xs">Last 7 days</span>
          <WeekStrip
            days={week.map((day) => ({
              key: day.t,
              label: day.label,
              dateLabel: day.dateLabel,
              isToday: day.isToday,
              dotClassName: `size-3 rounded-full ${
                day.logged && day.ml >= safeGoal
                  ? "bg-sky-400 shadow-[0_0_8px_var(--color-sky-400)]"
                  : day.logged
                    ? "bg-sky-400/40"
                    : "bg-border"
              } ${day.isToday ? "ring-2 ring-sky-400/40 ring-offset-1 ring-offset-background" : ""}`,
              value: day.logged ? formatOz(day.ml) : "Not logged",
              status:
                day.logged && day.ml >= safeGoal ? "Goal hit" : undefined,
            }))}
          />
        </div>
      ) : null}

      <ModuleFooter>
        <AskChadButton prompt="How's my water intake today? Am I drinking enough, and when should I top up?" />
        <Button
          aria-label="Undo last water entry"
          className="gap-1.5 text-muted-foreground text-xs"
          disabled={pending || totalMl <= 0}
          onClick={() => run(removeWater)}
          size="sm"
          variant="ghost"
        >
          <Undo2 className="size-3.5" />
          Undo last
        </Button>
        <WaterGoalEditor
          goalMl={safeGoal}
          onOpenChange={setGoalOpen}
          open={goalOpen}
          pending={pending}
          run={run}
        />
      </ModuleFooter>
    </ModuleCard>
  );
}

/**
 * Popover to set the daily hydration goal in ounces, with whole-gallon presets.
 * Defaults the input to the current goal. Stored back in ml by the action.
 */
function WaterGoalEditor({
  goalMl,
  open,
  onOpenChange,
  pending,
  run,
}: {
  goalMl: number;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pending: boolean;
  run: (action: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const [value, setValue] = useState("");

  // Seed the input with the current goal each time the popover opens.
  function handleOpenChange(next: boolean) {
    if (next) {
      setValue(String(Math.round(mlToOz(goalMl))));
    }
    onOpenChange(next);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const oz = Number(value);
    if (!Number.isFinite(oz) || oz <= 0) {
      toast.error("Enter a daily goal in ounces.");
      return;
    }
    run(async () => {
      const res = await saveWaterGoal(ozToMl(oz));
      if (res.ok) {
        onOpenChange(false);
      }
      return res;
    });
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label="Edit daily hydration goal"
          className="h-8 gap-1.5 text-muted-foreground text-xs"
          size="sm"
          variant="ghost"
        >
          <Pencil className="size-3.5" />
          Goal
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <div className="flex flex-col gap-1.5">
            <span className="font-medium text-sm">Daily goal</span>
            <span className="text-muted-foreground text-xs">
              How much water to aim for each day, in ounces. A gallon is 128 oz.
            </span>
          </div>
          <div className="flex gap-2">
            {[
              { oz: 64, label: "½ gal" },
              { oz: 96, label: "¾ gal" },
              { oz: 128, label: "1 gal" },
            ].map((preset) => (
              <Button
                className="h-8 flex-1 px-0 text-xs"
                key={preset.oz}
                onClick={() => setValue(String(preset.oz))}
                type="button"
                variant="secondary"
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              aria-label="Daily hydration goal in ounces"
              autoFocus
              className="h-10"
              inputMode="numeric"
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 128"
              value={value}
            />
            <Button className="h-10 shrink-0" disabled={pending} type="submit">
              Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
