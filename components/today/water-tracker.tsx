"use client";

import {
  Check,
  Coffee,
  Droplet,
  Droplets,
  GlassWater,
  Milk,
  Pencil,
  Plus,
  Undo2,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import {
  type FormEvent,
  useId,
  useOptimistic,
  useState,
  useTransition,
} from "react";
import { Bar, BarChart, Cell, ReferenceLine, XAxis } from "recharts";
import { toast } from "sonner";
import { useReward } from "@/components/dashboard/reward";
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
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useMountReveal } from "@/hooks/use-mount-reveal";
import { DOMAIN } from "@/lib/chart/palette";
import {
  DEFAULT_WATER_GOAL_ML,
  formatOz,
  formatVolume,
  mlToOz,
  ozToMl,
} from "@/lib/today/water-units";
import type { WaterDay } from "@/lib/today/week";
import { WeekStrip } from "@/components/today/week-strip";

// One-shot entries go up to a whole gallon (DSH-48): an end-of-night member
// logging the day's jug shouldn't have to tap small increments repeatedly.
const MAX_CUSTOM_OZ = 128;

/**
 * The quick-add serving row (DSH-47 + DSH-48): common vessel sizes with little
 * icons, so "how many oz was that?" answers itself right where you log — and
 * big one-shot entries (a whole gallon) are one tap. Every button states its
 * ounces, so totals still speak ONLY oz/gallons (DSH-24/DSH-34); the vessel
 * names are just size cues.
 */
const SERVINGS: {
  label: string;
  oz: number;
  icon: typeof GlassWater;
  iconClass?: string;
}[] = [
  { label: "Glass", oz: 8, icon: GlassWater },
  { label: "Mug", oz: 12, icon: Coffee },
  { label: "Bottle", oz: 17, icon: Milk },
  { label: "Big bottle", oz: 24, icon: Milk, iconClass: "size-5" },
  { label: "Gallon", oz: 128, icon: Droplets },
];

/**
 * Hydration module for the /today dashboard. Renders a WaterMinder-style
 * vessel that visually fills with an animated wave proportional to
 * totalMl / goalMl, plus the serving quick-add grid (glass → gallon + custom)
 * and an undo. Volumes speak ONLY US ounces & gallons (DSH-24/DSH-34)
 * though stored in ml; the daily goal defaults to one gallon and
 * is user-customizable.
 *
 * Quick-adds are optimistic (R2-15): the vessel fills the instant a button is
 * tapped, while the server action commits in the background. The actions
 * already revalidate /today and /hydration, so their responses carry the
 * refreshed page and no extra router.refresh() round trip is needed; once the
 * transition settles, the fill reflects the live server total.
 */
export function WaterTracker({
  totalMl,
  goalMl = DEFAULT_WATER_GOAL_ML,
  week,
  viewHref,
  weekChart = true,
}: {
  totalMl: number;
  goalMl?: number;
  /** This week's Sunday-start strip (goal hit / partial / nothing); omit to hide. */
  week?: WaterDay[];
  /** The detail page ("View all →" /hydration) — omit when already on it. */
  viewHref?: string;
  /** /hydration hides this in-card 7-day chart once the page's full trend
   *  chart renders below (one chart per page, VF-2); the streak dot strip
   *  stays either way (owner law s181, `streak-strips-never-removed`). */
  weekChart?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const reward = useReward();
  const [pending, startTransition] = useTransition();
  const [customOpen, setCustomOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [goalOpen, setGoalOpen] = useState(false);
  const clipId = useId();

  // Optimistic total (R2-15): quick-adds apply their delta instantly and the
  // value reconciles to the server total when the transition settles (or
  // reverts on error). Deltas accumulate, so rapid taps all register.
  const [optimisticMl, addOptimisticMl] = useOptimistic(
    totalMl,
    (current, delta: number) => Math.max(current + delta, 0)
  );

  const safeGoal = goalMl > 0 ? goalMl : DEFAULT_WATER_GOAL_ML;
  const ratio = Math.min(optimisticMl / safeGoal, 1);
  const percent = Math.round(ratio * 100);
  const remaining = Math.max(safeGoal - optimisticMl, 0);
  const reached = optimisticMl >= safeGoal;

  function run(
    action: () => Promise<{ ok: boolean; error?: string }>,
    optimisticDelta?: number
  ) {
    // Sensory feedback (DSH-54): a barely-there tick per quick-add, and the
    // full success moment the tap that crosses the goal line (the vessel's
    // pulsing ring is already the visual).
    if (optimisticDelta && optimisticDelta > 0) {
      const crossesGoal =
        optimisticMl < safeGoal && optimisticMl + optimisticDelta >= safeGoal;
      reward.effects(crossesGoal ? "success" : "tick");
    }
    startTransition(async () => {
      if (optimisticDelta) {
        addOptimisticMl(optimisticDelta);
      }
      const result = await action();
      if (!result.ok) {
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
    if (oz > MAX_CUSTOM_OZ) {
      toast.error(
        `That's more than a gallon. Log up to ${MAX_CUSTOM_OZ} oz at a time.`
      );
      return;
    }
    const ml = ozToMl(oz);
    run(() => logWaterAmount(ml), ml);
    setCustomValue("");
    setCustomOpen(false);
  }

  // SVG vessel geometry. The water surface sits at y = top of fill; two stacked
  // sine waves drift sideways for a living surface.
  const VIEW = 100;
  const fillTop = VIEW - ratio * VIEW;

  const fillLabel = reached
    ? `Hydration goal reached: ${formatOz(optimisticMl)} of ${formatVolume(safeGoal)}.`
    : `Hydration ${percent}% of goal: ${formatOz(optimisticMl)} of ${formatVolume(
        safeGoal
      )}, ${formatOz(remaining)} to go.`;

  return (
    <ModuleCard glow="sky">
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
              {formatOz(optimisticMl)}
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

      {/* Serving quick-adds (DSH-47/DSH-48): each button is a common vessel —
          icon + name + its ounces — so the grid doubles as the serving-size
          key, and a whole gallon lands in one tap. */}
      <div className="mt-6 grid grid-cols-3 gap-2">
        {/* Never disabled while pending: each tap applies instantly to the
            optimistic total, so rapid back-to-back adds all land (R2-15). */}
        {SERVINGS.map((s) => {
          const Icon = s.icon;
          return (
            <Button
              aria-label={`Add a ${s.label.toLowerCase()} of water, ${s.oz} ounces`}
              className="h-auto flex-col gap-0.5 py-2"
              key={s.label}
              onClick={() =>
                run(() => logWaterAmount(ozToMl(s.oz)), ozToMl(s.oz))
              }
              variant="outline"
            >
              <Icon className={`${s.iconClass ?? "size-4"} text-sky-400`} />
              <span className="font-semibold text-sm">+{s.oz} oz</span>
              <span className="font-normal text-[11px] text-muted-foreground">
                {s.label}
              </span>
            </Button>
          );
        })}

        <Popover onOpenChange={setCustomOpen} open={customOpen}>
          <PopoverTrigger asChild>
            <Button
              aria-label="Add a custom amount of water"
              className="h-auto flex-col gap-0.5 py-2"
              variant="outline"
            >
              <Plus className="size-4 text-sky-400" />
              <span className="font-semibold text-sm">Custom</span>
              <span className="font-normal text-[11px] text-muted-foreground">
                Any amount
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64">
            <form className="flex flex-col gap-3" onSubmit={onCustomSubmit}>
              <div className="flex flex-col gap-1.5">
                <span className="font-medium text-sm">Add water</span>
                <span className="text-muted-foreground text-xs">
                  Enter an amount in ounces (max {MAX_CUSTOM_OZ} oz, a full
                  gallon).
                </span>
              </div>
              <div className="flex gap-2">
                {[20, 32, 64].map((preset) => (
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

      {/* This week's streak strip + bar chart — BOTH, per owner order s181:
          the dot strip is the at-a-glance habit-streak reward (full dot =
          goal hit, faded = some water, hollow = nothing) and must never be
          removed; the chart is the visual (full-strength bar = goal hit,
          dashed line = the daily goal). Full trend history stays on
          /hydration. */}
      {week?.some((d) => d.logged) ? (
        <>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-background/40 px-4 py-2.5">
            <span className="text-muted-foreground text-xs">This week</span>
            <WeekStrip
              days={week.map((day) => ({
                key: day.t,
                label: day.label,
                dateLabel: day.dateLabel,
                isToday: day.isToday,
                isFuture: day.isFuture,
                dotClassName:
                  day.logged && day.ml >= safeGoal
                    ? "bg-sky-400 shadow-[0_0_8px_var(--color-sky-400)]"
                    : day.logged
                      ? "bg-sky-400/40"
                      : "bg-border",
                value: day.logged ? formatOz(day.ml) : "Not logged",
                status:
                  day.logged && day.ml >= safeGoal ? "Goal hit" : undefined,
              }))}
            />
          </div>
          {weekChart && (
            <div className="mt-3">
              <WaterWeekChart goalMl={safeGoal} week={week} />
            </div>
          )}
        </>
      ) : null}

      <ModuleFooter
        askChad={
          <AskChadButton prompt="How's my water intake today? Am I drinking enough, and when should I top up?" />
        }
      >
        {/* Undo stays pending-gated (not optimistic): the client doesn't know
            the last entry's size, so it waits for the server total. This is
            the quick mis-tap eraser; the itemized per-entry delete lives in
            /hydration's "Today's log" (LC-11). */}
        <Button
          aria-label="Undo last water entry"
          className="gap-1.5 text-muted-foreground text-xs"
          disabled={pending || optimisticMl <= 0}
          onClick={() => run(removeWater)}
          size="sm"
          variant="ghost"
        >
          <Undo2 className="size-3.5" />
          Undo last add
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

const WEEK_CHART_COLOR = DOMAIN.hydration;

const weekChartConfig = {
  ml: { label: "Water", color: WEEK_CHART_COLOR },
} satisfies ChartConfig;

/**
 * The 7-day in-card bar chart — the hydration twin of the Sleep card's week
 * chart (same axis grammar: bold today label, dimmed upcoming days, dashed
 * goal line, full-strength bars on goal-hit days).
 */
function WaterWeekChart({
  week,
  goalMl,
}: {
  week: WaterDay[];
  goalMl: number;
}) {
  const reveal = useMountReveal();
  return (
    <ChartContainer className="h-[120px] w-full" config={weekChartConfig}>
      <BarChart
        barCategoryGap="28%"
        data={week}
        margin={{ top: 6, right: 4, bottom: 0, left: 4 }}
      >
        <XAxis
          axisLine={false}
          dataKey="label"
          tick={(props: {
            x?: number | string;
            y?: number | string;
            index?: number;
            payload?: { value?: unknown };
          }) => {
            const day = props.index == null ? undefined : week[props.index];
            return (
              <text
                fill={
                  day?.isToday
                    ? "var(--foreground)"
                    : "var(--muted-foreground)"
                }
                fillOpacity={day?.isFuture ? 0.5 : 1}
                fontSize={12}
                fontWeight={day?.isToday ? 600 : 400}
                textAnchor="middle"
                x={props.x}
                y={Number(props.y ?? 0) + 10}
              >
                {String(props.payload?.value ?? "")}
              </text>
            );
          }}
          tickLine={false}
          tickMargin={6}
        />
        <ChartTooltip
          content={<WaterWeekTooltip goalMl={goalMl} />}
          cursor={false}
        />
        <ReferenceLine
          stroke={WEEK_CHART_COLOR}
          strokeDasharray="4 4"
          strokeOpacity={0.5}
          y={goalMl}
        />
        <Bar
          animationDuration={750}
          animationEasing="ease-out"
          dataKey="ml"
          isAnimationActive={reveal}
          radius={[3, 3, 0, 0]}
        >
          {week.map((d) => (
            <Cell
              fill={WEEK_CHART_COLOR}
              fillOpacity={d.logged ? (d.ml >= goalMl ? 0.9 : 0.4) : 0}
              key={d.t}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

function WaterWeekTooltip({
  active,
  payload,
  goalMl,
}: {
  active?: boolean;
  payload?: { payload?: WaterDay }[];
  goalMl: number;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  const hit = row.logged && row.ml >= goalMl;
  return (
    <div className="min-w-[10rem] rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <div className="mb-1.5 flex items-center justify-between gap-4">
        <span className="font-medium">{row.dateLabel}</span>
        <span className="font-medium text-foreground tabular-nums">
          {row.logged ? formatOz(row.ml) : "—"}
        </span>
      </div>
      {row.logged ? (
        <div className="flex items-center justify-between gap-4 text-muted-foreground">
          <span>
            {goalMl > 0 ? Math.round((row.ml / goalMl) * 100) : 0}% of goal
          </span>
          <span className={hit ? "font-medium text-emerald-500" : ""}>
            {hit
              ? "Goal hit"
              : `${formatOz(Math.max(0, goalMl - row.ml))} short`}
          </span>
        </div>
      ) : (
        <div className="text-muted-foreground">
          {row.isFuture ? "Upcoming" : "Not logged"}
        </div>
      )}
    </div>
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
