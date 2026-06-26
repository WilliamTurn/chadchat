"use client";

import type { ReactNode } from "react";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import type { RangeControlProps } from "@/hooks/use-chart-range";
import { cn } from "@/lib/utils";

/**
 * The shared shell for every dashboard chart (weight, 1RM, nutrition, water).
 * Owns the card chrome, the title row (+ optional Ask-Chad deep-link), the KPI
 * strip layout (wraps to two columns on mobile), the segmented range toggle,
 * the chart slot and an optional footer caption — so each chart collapses to
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

function RangeToggle({ range, setRange, presets }: RangeControlProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
      {presets.map((p) => (
        <button
          className={cn(
            "rounded-md px-2.5 py-1 font-medium text-xs transition-colors",
            range === p.key
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          key={p.key}
          onClick={() => setRange(p.key)}
          type="button"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
