"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChartRangeState } from "./use-chart-window";

/**
 * The shared time-range segmented control (FIX-18). One per chart, sitting in
 * the ChartFrame header. Targets: 32px visual on desktop, 44px minimum on
 * touch (visual-excellence section 7) via the pointer-coarse variant, so a
 * thumb can actually land on "1M".
 */
export function ChartRangeControl({
  control,
  className,
}: {
  control: ChartRangeState;
  className?: string;
}) {
  if (control.presets.length < 2) {
    return null;
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: role="group" is the APG segmented-control pattern; a <fieldset> brings default chrome and flex/grid layout quirks for zero AT gain.
    <div
      aria-label="Time range"
      className={cn(
        "flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5",
        className
      )}
      role="group"
    >
      {control.presets.map((p) => {
        const active = control.key === p.key;
        return (
          <Button
            aria-pressed={active}
            className={cn(
              "h-8 min-w-8 px-2.5 text-xs pointer-coarse:min-h-11 pointer-coarse:min-w-11",
              active
                ? "bg-card text-foreground shadow-sm hover:bg-card"
                : "text-muted-foreground"
            )}
            key={p.key}
            onClick={() => control.setKey(p.key)}
            size="sm"
            variant="ghost"
          >
            {p.label}
          </Button>
        );
      })}
    </div>
  );
}
