"use client";

import { cn } from "@/lib/utils";

/**
 * A segmented pill picker — the same blood-bordered button grid as the nutrition
 * diary's MealCategoryPicker, generalized for the meal-plan generate form (NUT-4)
 * so every preference is a tap target instead of a native dropdown. Pass a grid
 * column class via `className` (e.g. "grid-cols-3"); it merges over the default.
 */
export function SegmentedPicker<T extends string>({
  options,
  value,
  onChange,
  className,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className={cn("grid grid-cols-2 gap-2", className)}
      role="group"
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            aria-pressed={active}
            className={cn(
              "rounded-lg border px-2 py-2 text-center font-medium text-xs transition-colors",
              active
                ? "border-blood bg-blood/10 text-foreground"
                : "border-border bg-background/40 text-muted-foreground hover:bg-accent/50"
            )}
            key={o.value}
            onClick={() => onChange(o.value)}
            type="button"
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
