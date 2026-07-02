"use client";

/**
 * The Sleep & recovery card (/today + /sleep): last night's hours + quality,
 * a 7-night week chart, and the log control — in the card BODY, like the
 * hydration quick-adds, so every daily-logger card carries its input where you
 * read its number (audit rule 5). The chart is built on Recharts via the shadcn
 * chart primitive (the same engine as the weight/water trends). Nights that
 * reach the recommended 7 hours are full-strength indigo; short nights fade.
 *
 * Honest framing (audit P1-2): an entry only reads as "Last night" when it is
 * actually for last night — an older entry is shown as "Last logged · Sun,
 * Jun 29" with no freshness verdict, and the card asks for last night instead.
 */

import { Moon, Star } from "lucide-react";
import { useState } from "react";
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
}: {
  last: LastNight;
  week: SleepNight[];
  /** The detail page ("View all →" /sleep) — omit when already on it. */
  viewHref?: string;
  /** First-run (P1-4): keep the log button quiet so the page has ONE
   *  dominant CTA instead of an empty-state chorus. */
  quiet?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const goalHours = SLEEP_GOAL_MINUTES / 60;
  // Only a genuinely-current entry gets the freshness verdict.
  const current = last?.isCurrent ? last : null;
  const reached = current != null && current.minutes >= SLEEP_GOAL_MINUTES;
  const loggedNights = week
    .filter((n) => n.logged)
    .map((n) => ({ iso: n.iso, minutes: n.minutes }));

  return (
    <ModuleCard>
      <ModuleHeader
        icon={<Moon className="size-4" />}
        title="Sleep & recovery"
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
      {week.some((d) => d.logged) ? (
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
                tickLine={false}
                tickMargin={6}
              />
              <ChartTooltip content={<SleepTooltip />} cursor={false} />
              <ReferenceLine
                stroke={INDIGO}
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                y={SLEEP_GOAL_MINUTES}
              />
              <Bar dataKey="minutes" radius={[3, 3, 0, 0]}>
                {week.map((d) => (
                  <Cell
                    fill={INDIGO}
                    fillOpacity={
                      d.logged ? (d.minutes >= SLEEP_GOAL_MINUTES ? 0.9 : 0.4) : 0
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
        status={`${goalHours}+ hrs a night recommended · last 7 nights`}
      />
    </ModuleCard>
  );
}

function SleepTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: SleepNight }[];
}) {
  if (!active || !payload?.length) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  const hit = row.minutes >= SLEEP_GOAL_MINUTES;
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
              ? "7h+ reached"
              : `${formatSleepDuration(SLEEP_GOAL_MINUTES - row.minutes)} short of 7h`}
          </span>
        </div>
      ) : (
        <div className="text-muted-foreground">Not logged</div>
      )}
    </div>
  );
}
