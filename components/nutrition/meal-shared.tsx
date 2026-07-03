"use client";

import { Input } from "@/components/ui/input";
import { MEAL_CATEGORIES, type MealCategory } from "@/lib/validation/nutrition";

export const MEAL_LABELS: Record<MealCategory, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  other: "Other",
};

/** What to show for a logged meal's slot: the member's own name for a custom
 * slot ("Post-workout shake"), else the standard bucket label. */
export function mealDisplayLabel(
  meal: MealCategory | null,
  mealLabel: string | null | undefined
): string | null {
  if (!meal) {
    return null;
  }
  if (meal === "other" && mealLabel?.trim()) {
    return mealLabel.trim();
  }
  return MEAL_LABELS[meal] ?? null;
}

/** Sensible default category from the time of day. */
export function defaultMealForNow(): MealCategory {
  const h = new Date().getHours();
  if (h < 11) {
    return "breakfast";
  }
  if (h < 15) {
    return "lunch";
  }
  if (h < 21) {
    return "dinner";
  }
  return "snack";
}

/** Parse a macro input: blank → null, bad → "bad", else a non-negative int. */
export function parseMacro(raw: string): number | null | "bad" {
  if (!raw.trim()) {
    return null;
  }
  const n = Math.round(Number(raw));
  if (Number.isNaN(n) || n < 0) {
    return "bad";
  }
  return n;
}

export function MealCategoryPicker({
  value,
  onChange,
  customLabel,
  onCustomLabelChange,
}: {
  value: MealCategory;
  onChange: (v: MealCategory) => void;
  /** The member's name for the "Other" slot ("Post-workout shake"). */
  customLabel: string;
  onCustomLabelChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      {/* 2x3 on narrow phones: five-across squeezes "Breakfast" into a
          mid-word wrap below ~420px. */}
      <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-5">
        {MEAL_CATEGORIES.map((m) => {
          const active = value === m;
          return (
            <button
              className={`min-w-0 whitespace-normal break-words rounded-lg border px-2 py-1.5 text-center font-medium text-xs transition-colors ${
                active
                  ? "border-blood bg-blood/10 text-foreground"
                  : "border-border bg-background/40 text-muted-foreground hover:bg-accent/50"
              }`}
              key={m}
              onClick={() => onChange(m)}
              type="button"
            >
              {MEAL_LABELS[m]}
            </button>
          );
        })}
      </div>
      {value === "other" && (
        <Input
          aria-label="Name this meal slot"
          maxLength={40}
          onChange={(e) => onCustomLabelChange(e.target.value)}
          placeholder="Name it, e.g. Post-workout shake"
          value={customLabel}
        />
      )}
    </div>
  );
}
