"use client";

import { CalendarRange } from "lucide-react";
import { type ReactNode, useState } from "react";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { RangeControlProps } from "@/hooks/use-chart-range";
import { cn } from "@/lib/utils";

/**
 * The shared shell for every dashboard chart (weight, 1RM, nutrition, water).
 * Owns the card chrome, the title row (+ optional Ask-Chad deep-link), the KPI
 * strip layout (wraps to two columns on mobile), the segmented range toggle
 * (presets + a custom from/to picker, DSH-52), the chart slot and an optional
 * footer caption — so each chart collapses to
 * `<ChartCard …><SomeRechartsThing /></ChartCard>` and they all look and behave
 * the same.
 */
export function ChartCard({
  title,
  askChadPrompt,
  range,
  kpis,
  footer,
  children,
  className,
}: {
  title: string;
  askChadPrompt?: string;
  range?: RangeControlProps;
  kpis?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const showRange = range && range.presets.length > 1;

  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-6",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium text-lg">{title}</h2>
        {askChadPrompt && <AskChadButton prompt={askChadPrompt} />}
      </div>

      {(kpis || showRange) && (
        <div className="mt-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          {kpis && (
            <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:flex sm:flex-wrap sm:items-end">
              {kpis}
            </div>
          )}
          {showRange && <RangeToggle {...range} />}
        </div>
      )}

      <div className="mt-5">{children}</div>

      {footer && (
        <div className="mt-4 text-center text-muted-foreground text-sm">
          {footer}
        </div>
      )}
    </section>
  );
}

const segmentClass = (active: boolean) =>
  cn(
    "rounded-md px-2.5 py-1 font-medium text-xs transition-colors",
    active
      ? "bg-card text-foreground shadow-sm"
      : "text-muted-foreground hover:text-foreground"
  );

function RangeToggle({
  range,
  setRange,
  presets,
  custom,
  setCustom,
  dataBounds,
}: RangeControlProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
      {presets.map((p) => (
        <button
          className={segmentClass(range === p.key)}
          key={p.key}
          onClick={() => setRange(p.key)}
          type="button"
        >
          {p.label}
        </button>
      ))}
      {dataBounds && (
        <CustomRangePicker
          active={range === "custom"}
          custom={custom}
          dataBounds={dataBounds}
          setCustom={setCustom}
        />
      )}
    </div>
  );
}

/** ms (noon-UTC anchored day) → the ISO day string the DatePicker speaks. */
function msToISO(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * The "pick any window" escape hatch next to the presets (DSH-52): a small
 * calendar segment that opens From/To pickers bounded to the data's extent.
 * Applying switches the toggle to the custom window; picking a preset again
 * simply switches away.
 */
function CustomRangePicker({
  active,
  custom,
  setCustom,
  dataBounds,
}: {
  active: boolean;
  custom: { from: number; to: number } | null;
  setCustom: RangeControlProps["setCustom"];
  dataBounds: { min: number; max: number };
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const minISO = msToISO(dataBounds.min);
  const maxISO = msToISO(dataBounds.max);

  // Seed the pickers each open: the active custom window, else the full span.
  function handleOpenChange(next: boolean) {
    if (next) {
      setFrom(custom ? msToISO(custom.from) : minISO);
      setTo(custom ? msToISO(custom.to) : maxISO);
    }
    setOpen(next);
  }

  function apply() {
    // Inclusive UTC day bounds; logs anchor at noon UTC so these always catch
    // the picked days. A backwards pick is just swapped, not an error.
    let fromMs = Date.parse(`${from}T00:00:00Z`);
    let toMs = Date.parse(`${to}T23:59:59Z`);
    if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
      return;
    }
    if (fromMs > toMs) {
      [fromMs, toMs] = [
        Date.parse(`${to}T00:00:00Z`),
        Date.parse(`${from}T23:59:59Z`),
      ];
    }
    setCustom({ from: fromMs, to: toMs });
    setOpen(false);
  }

  return (
    <Popover onOpenChange={handleOpenChange} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label="Pick a custom date range"
          className={cn(segmentClass(active), "flex items-center gap-1")}
          type="button"
        >
          <CalendarRange className="size-3.5" />
          {active && custom ? "Custom" : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="font-medium text-sm">Custom date range</span>
            <span className="text-muted-foreground text-xs">
              Show just the window you care about.
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-xs" htmlFor="range-from">
              From
            </Label>
            <DatePicker
              id="range-from"
              max={maxISO}
              min={minISO}
              onChange={setFrom}
              value={from}
            />
            <Label className="text-xs" htmlFor="range-to">
              To
            </Label>
            <DatePicker
              id="range-to"
              max={maxISO}
              min={minISO}
              onChange={setTo}
              value={to}
            />
          </div>
          <div className="flex gap-2">
            {active && custom && (
              <Button
                className="h-9 flex-1"
                onClick={() => {
                  setCustom(null);
                  setOpen(false);
                }}
                type="button"
                variant="secondary"
              >
                Clear
              </Button>
            )}
            <Button className="h-9 flex-1" onClick={apply} type="button">
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
