"use client";

/**
 * The Sleep & recovery card (/today + /sleep): last night's hours + quality,
 * this week's Sunday-start night chart (VF-10), and the log control — in the
 * card BODY, like the
 * hydration quick-adds, so every daily-logger card carries its input where you
 * read its number (audit rule 5). The chart is built on Recharts via the shadcn
 * chart primitive (the same engine as the weight/water trends). Nights that
 * reach the nightly goal (user-editable, DSH-40; defaults to the recommended
 * 7 hours) are full-strength indigo; short nights fade.
 *
 * Honest framing (audit P1-2): an entry only reads as "Last night" when it is
 * actually for last night — an older entry is shown as "Last logged · Sun,
 * Jun 29" with no freshness verdict, and the card asks for last night instead.
 */

import { Moon, Pencil, Star } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveSleepGoal } from "@/app/today/actions";
import { Bar, BarChart, Cell, ReferenceLine, XAxis } from "recharts";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import {
  ModuleCard,
  ModuleFooter,
  ModuleHeader,
} from "@/components/today/module-card";
import {
  formatSleepDuration,
  QUALITY_LABELS,
  SleepLogForm,
} from "@/components/today/sleep-log-form";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMountReveal } from "@/hooks/use-mount-reveal";
import type { LastNight, SleepNight } from "@/lib/today/week";
import { cn } from "@/lib/utils";
import { SLEEP_GOAL_MINUTES } from "@/lib/validation/sleep";

export type { LastNight, SleepNight } from "@/lib/today/week";

const INDIGO = "#818cf8";

const chartConfig = {
  minutes: { label: "Sleep", color: INDIGO },
} satisfies ChartConfig;

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          className={cn(
            "size-3.5",
            n <= value
              ? "fill-indigo-400 text-indigo-400"
              : "text-muted-foreground/30"
          )}
          key={n}
        />
      ))}
    </span>
  );
}

export function SleepTracker({
  last,
  week,
  viewHref,
  quiet = false,
  weekChart = true,
  goalMinutes = SLEEP_GOAL_MINUTES,
}: {
  last: LastNight;
  week: SleepNight[];
  /** The detail page ("View all →" /sleep) — omit when already on it. */
  viewHref?: string;
  /** First-run (P1-4): keep the log button quiet so the page has ONE
   *  dominant CTA instead of an empty-state chorus. */
  quiet?: boolean;
  /** /sleep hides this strip once the full Sleep-trend chart renders below,
   *  so the page carries ONE sleep chart (VF-2). */
  weekChart?: boolean;
  /** The user's nightly target (DSH-40); defaults to the recommended 7h. */
  goalMinutes?: number;
}) {
  const [open, setOpen] = useState(false);
  const reveal = useMountReveal();

  // Custom goal vs the recommended default drives the footer wording.
  const isDefaultGoal = goalMinutes === SLEEP_GOAL_MINUTES;
  // Only a genuinely-current entry gets the freshness verdict.
  const current = last?.isCurrent ? last : null;
  const reached = current != null && current.minutes >= goalMinutes;
  const loggedNights = week
    .filter((n) => n.logged)
    .map((n) => ({ iso: n.iso, minutes: n.minutes }));

  return (
    <ModuleCard glow="indigo">
      <ModuleHeader
        icon={<Moon className="size-4" />}
        title="Sleep"
        tone="indigo"
        viewHref={viewHref}
      />

      {/* Last night readout */}
      <div className="mt-3 flex min-w-0 flex-col gap-1">
        <span className="text-muted-foreground text-xs">Last night</span>
        {current ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="font-display font-bold text-3xl text-foreground tabular-nums">
                {formatSleepDuration(current.minutes)}
              </span>
              {current.quality != null && <Stars value={current.quality} />}
            </div>
            <p
              className={cn(
                "font-medium text-sm",
                reached ? "text-emerald-500" : "text-foreground"
              )}
            >
              {reached ? "Well rested" : "Short on sleep"}
            </p>
          </>
        ) : (
          <>
            <span className="font-display font-bold text-3xl text-muted-foreground tabular-nums">
              —
            </span>
            <p className="text-muted-foreground text-sm">
              {last
                ? `Not logged yet · last logged ${last.dateLabel} (${formatSleepDuration(last.minutes)})`
                : "No sleep logged yet."}
            </p>
          </>
        )}
      </div>

      {/* 7-night week chart */}
      {weekChart && week.some((d) => d.logged) ? (
        <div className="mt-6">
          <ChartContainer className="h-[120px] w-full" config={chartConfig}>
            <BarChart
              barCategoryGap="28%"
              data={week}
              margin={{ top: 6, right: 4, bottom: 0, left: 4 }}
            >
              <XAxis
                axisLine={false}
                dataKey="label"
                // Same structural today-cue as the dot strips (VF-11): bold
                // foreground label for today, dimmed labels for upcoming days.
                tick={(props: {
                  x?: number | string;
                  y?: number | string;
                  index?: number;
                  payload?: { value?: unknown };
                }) => {
                  const day =
                    props.index == null ? undefined : week[props.index];
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
                content={<SleepTooltip goalMinutes={goalMinutes} />}
                cursor={false}
              />
              <ReferenceLine
                stroke={INDIGO}
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                y={goalMinutes}
              />
              <Bar
                animationDuration={750}
                animationEasing="ease-out"
                dataKey="minutes"
                isAnimationActive={reveal}
                radius={[3, 3, 0, 0]}
              >
                {week.map((d) => (
                  <Cell
                    fill={INDIGO}
                    fillOpacity={
                      d.logged ? (d.minutes >= goalMinutes ? 0.9 : 0.4) : 0
                    }
                    key={d.t}
                  />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </div>
      ) : null}

      {/* Log control — in the body, like the hydration quick-adds. Prominent
          when last night still needs logging; quiet once it's in. */}
      <div className="mt-4">
        <Popover onOpenChange={setOpen} open={open}>
          <PopoverTrigger asChild>
            <Button
              className="h-11 w-full gap-1.5"
              variant={current || quiet ? "outline" : "default"}
            >
              <Moon className="size-4" />
              {current ? "Log sleep" : "Log last night"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-72">
            <SleepLogForm
              loggedNights={loggedNights}
              onDone={() => setOpen(false)}
            />
          </PopoverContent>
        </Popover>
      </div>

      <ModuleFooter
        askChad={
          <AskChadButton prompt="Look at my sleep over the last week. Am I getting enough to recover and build muscle, and what should I change?" />
        }
        status={
          isDefaultGoal
            ? `${formatSleepDuration(goalMinutes)}+ a night recommended · this week`
            : `Goal: ${formatSleepDuration(goalMinutes)}+ a night · this week`
        }
      >
        <SleepGoalEditor goalMinutes={goalMinutes} />
      </ModuleFooter>
    </ModuleCard>
  );
}

/**
 * Popover to set the nightly sleep goal — hour/quarter-hour selects (like the
 * log form) plus common presets. Mirrors the hydration card's goal editor
 * (DSH-40: every daily tracker's target is user-editable, rule-1 parity).
 */
function SleepGoalEditor({ goalMinutes }: { goalMinutes: number }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [hours, setHours] = useState(String(Math.floor(goalMinutes / 60)));
  const [minutes, setMinutes] = useState(String(goalMinutes % 60));

  // Re-seed the selects with the current goal each time the popover opens.
  function handleOpenChange(next: boolean) {
    if (next) {
      setHours(String(Math.floor(goalMinutes / 60)));
      setMinutes(String(goalMinutes % 60));
    }
    setOpen(next);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const total = Number(hours) * 60 + Number(minutes);
    if (!Number.isFinite(total) || total <= 0) {
      toast.error("Enter a nightly sleep goal.");
      return;
    }
    startTransition(async () => {
      const result = await saveSleepGoal(total);
      if (result.ok) {
        setOpen(false);
      } else {
        toast.error(result.error ?? "Couldn't save that goal.");
      }
    });
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label="Edit nightly sleep goal"
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
            <span className="font-medium text-sm">Nightly goal</span>
            <span className="text-muted-foreground text-xs">
              How much sleep to aim for each night. 7 to 9 hours is the usual
              recommendation.
            </span>
          </div>
          <div className="flex gap-2">
            {[7 * 60, 8 * 60, 9 * 60].map((preset) => (
              <Button
                className="h-8 flex-1 px-0 text-xs"
                key={preset}
                onClick={() => {
                  setHours(String(Math.floor(preset / 60)));
                  setMinutes(String(preset % 60));
                }}
                type="button"
                variant="secondary"
              >
                {formatSleepDuration(preset)}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Select onValueChange={setHours} value={hours}>
              <SelectTrigger aria-label="Goal hours" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {h} h
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={setMinutes} value={minutes}>
              <SelectTrigger aria-label="Goal minutes" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 15, 30, 45].map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} m
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="h-9 shrink-0" disabled={pending} type="submit">
              Save
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

function SleepTooltip({
  active,
  payload,
  goalMinutes,
}: {
  active?: boolean;
  payload?: { payload?: SleepNight }[];
  goalMinutes: number;
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  const hit = row.minutes >= goalMinutes;
  const goalLabel = formatSleepDuration(goalMinutes);
  return (
    <div className="min-w-[10rem] rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <div className="mb-1.5 flex items-center justify-between gap-4">
        <span className="font-medium">{row.dateLabel}</span>
        <span className="font-medium text-foreground tabular-nums">
          {row.logged ? formatSleepDuration(row.minutes) : "—"}
        </span>
      </div>
      {row.logged ? (
        <div className="flex items-center justify-between gap-4 text-muted-foreground">
          {row.quality == null ? (
            <span>Logged</span>
          ) : (
            <span>{QUALITY_LABELS[row.quality]}</span>
          )}
          <span className={hit ? "font-medium text-emerald-500" : ""}>
            {hit
              ? `${goalLabel}+ reached`
              : `${formatSleepDuration(goalMinutes - row.minutes)} short of ${goalLabel}`}
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
