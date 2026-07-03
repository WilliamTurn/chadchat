"use client";

import { MEAL_CATEGORIES, type MealCategory } from "@/lib/validation/nutrition";

export const MEAL_LABELS: Record<MealCategory, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

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
}: {
  value: MealCategory;
  onChange: (v: MealCategory) => void;
}) {
  return (
    // 2x2 on narrow phones: four-across squeezes "Breakfast" into a mid-word
    // wrap below ~420px.
    <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
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
  );
}
