"use client";

/**
 * The /today "Sleep & recovery" card: last night's hours + quality, a one-tap
 * log popover, and a 7-night week chart. The chart is built on Recharts via the
 * shadcn chart primitive (the same engine as the weight/water/volume trends), so
 * it matches the rest of the dashboard rather than being hand-rolled SVG. Nights
 * that hit the 7-hour target are drawn in full-strength indigo; short nights are
 * faded.
 */

import { Moon, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Bar, BarChart, Cell, ReferenceLine, XAxis } from "recharts";
import { toast } from "sonner";
import { logSleep } from "@/app/today/actions";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { IconChip } from "@/components/today/icon-chip";
import { Button } from "@/components/ui/button";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
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
import { todayLocalISO } from "@/lib/date";
import { cn } from "@/lib/utils";
import { SLEEP_GOAL_MINUTES } from "@/lib/validation/sleep";

const INDIGO = "#818cf8";

const chartConfig = {
  minutes: { label: "Sleep", color: INDIGO },
} satisfies ChartConfig;

const QUALITY_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "OK",
  4: "Good",
  5: "Great",
};

/** One night in the rolling 7-day week strip. */
export type SleepNight = {
  /** Midnight-UTC ms of the day (stable key + chart x). */
  t: number;
  /** Single-letter weekday label. */
  label: string;
  /** Minutes slept that night; 0 if not logged. */
  minutes: number;
  quality: number | null;
  logged: boolean;
  isToday: boolean;
};

export type LastNight = {
  minutes: number;
  quality: number | null;
  /** "Today" / "Yesterday" / "Jun 24" — when the latest entry is for. */
  whenLabel: string;
} | null;

/** "7h 30m" / "45m" / "0h". */
function formatDuration(minutes: number): string {
  if (minutes <= 0) {
    return "0h";
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) {
    return `${m}m`;
  }
  if (m === 0) {
    return `${h}h`;
  }
  return `${h}h ${m}m`;
}

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

const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => i); // 0–12
const MINUTE_OPTIONS = [0, 15, 30, 45];

export function SleepTracker({
  last,
  week,
}: {
  last: LastNight;
  week: SleepNight[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(todayLocalISO);
  const [hours, setHours] = useState("7");
  const [minutes, setMinutes] = useState("30");
  const [quality, setQuality] = useState<number | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const total = Number(hours) * 60 + Number(minutes);
    if (!Number.isFinite(total) || total <= 0) {
      toast.error("Enter how long you slept.");
      return;
    }
    startTransition(async () => {
      const result = await logSleep({
        recordedAt: date,
        minutes: total,
        quality,
      });
      if (result.ok) {
        toast.success("Sleep logged.");
        setQuality(null);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't log that.");
      }
    });
  }

  const goalHours = SLEEP_GOAL_MINUTES / 60;
  const reached = last != null && last.minutes >= SLEEP_GOAL_MINUTES;

  const logForm = (
    <PopoverContent align="end" className="w-72">
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <div className="flex flex-col gap-1.5">
          <span className="font-medium text-sm">Log sleep</span>
          <span className="text-muted-foreground text-xs">
            How long did you sleep last night?
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs" htmlFor="sleep-date">
            Night of
          </Label>
          <DatePicker
            id="sleep-date"
            max={todayLocalISO()}
            onChange={setDate}
            value={date}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs">Time asleep</Label>
          <div className="flex items-center gap-2">
            <Select onValueChange={setHours} value={hours}>
              <SelectTrigger aria-label="Hours slept" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOUR_OPTIONS.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {h} h
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={setMinutes} value={minutes}>
              <SelectTrigger aria-label="Minutes slept" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINUTE_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} m
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-xs">Quality (optional)</Label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                aria-label={`${n} star${n === 1 ? "" : "s"}: ${QUALITY_LABELS[n]}`}
                aria-pressed={quality != null && n <= quality}
                className="rounded p-0.5 transition-transform hover:scale-110"
                key={n}
                onClick={() => setQuality((q) => (q === n ? null : n))}
                type="button"
              >
                <Star
                  className={cn(
                    "size-5",
                    quality != null && n <= quality
                      ? "fill-indigo-400 text-indigo-400"
                      : "text-muted-foreground/40"
                  )}
                />
              </button>
            ))}
            {quality != null && (
              <span className="ml-1 text-muted-foreground text-xs">
                {QUALITY_LABELS[quality]}
              </span>
            )}
          </div>
        </div>

        <Button className="mt-1" disabled={pending} type="submit">
          {pending ? "Saving…" : "Log sleep"}
        </Button>
      </form>
    </PopoverContent>
  );

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <IconChip tone="indigo">
            <Moon className="size-4" />
          </IconChip>
          <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
            Sleep & recovery
          </h2>
        </div>
        <AskChadButton prompt="Look at my sleep over the last week. Am I getting enough to recover and build muscle, and what should I change?" />
      </div>

      {/* Last night readout */}
      <div className="mt-6 flex items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-muted-foreground text-xs">
            {last ? `Last night · ${last.whenLabel}` : "Last night"}
          </span>
          {last ? (
            <>
              <div className="flex items-baseline gap-2">
                <span className="font-display font-bold text-3xl text-foreground tabular-nums">
                  {formatDuration(last.minutes)}
                </span>
                {last.quality != null && <Stars value={last.quality} />}
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
                No sleep logged yet.
              </p>
            </>
          )}
        </div>

        <Popover onOpenChange={setOpen} open={open}>
          <PopoverTrigger asChild>
            <Button className="gap-1.5 shrink-0" size="sm" variant="outline">
              <Moon className="size-3.5" />
              Log sleep
            </Button>
          </PopoverTrigger>
          {logForm}
        </Popover>
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

      <p className="mt-4 text-center text-muted-foreground text-xs">
        {goalHours}+ hrs a night recommended · last 7 nights
      </p>
    </section>
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
        <span className="font-medium">{row.label}</span>
        <span className="font-medium text-foreground tabular-nums">
          {row.logged ? formatDuration(row.minutes) : "—"}
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
              ? "goal hit"
              : `${formatDuration(SLEEP_GOAL_MINUTES - row.minutes)} short`}
          </span>
        </div>
      ) : (
        <div className="text-muted-foreground">Not logged</div>
      )}
    </div>
  );
}
