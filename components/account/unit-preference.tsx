"use client";

import { useState, useTransition } from "react";
import { setPreferredWeightUnit } from "@/app/account/actions";
import { SettingsRow } from "@/components/account/settings-row";
import { cn } from "@/lib/utils";

const UNITS: { value: "lb" | "kg"; label: string }[] = [
  { value: "lb", label: "Pounds (lb)" },
  { value: "kg", label: "Kilograms (kg)" },
];

/**
 * The Units settings row: a segmented lb/kg picker (2 options stay inline,
 * ux-canon 01 #75). Optimistic: flips instantly, rolls back on failure. The
 * moved segment is the success feedback, no toast (ux-canon 03 #32; house
 * rule: if the result is plainly visible, stay quiet). Failure renders
 * inline in the row's supporting slot (ux-canon 03 #29, #40).
 */
export function UnitPreference({
  initialUnit,
}: {
  initialUnit: "lb" | "kg" | null;
}) {
  const [unit, setUnit] = useState<"lb" | "kg">(initialUnit ?? "lb");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function choose(next: "lb" | "kg") {
    if (next === unit) {
      return;
    }
    const prev = unit;
    setUnit(next);
    setError(null);
    startTransition(async () => {
      try {
        await setPreferredWeightUnit(next);
      } catch {
        setUnit(prev);
        setError("Units didn't save. Try again.");
      }
    });
  }

  return (
    <SettingsRow
      control={
        <div className="inline-flex rounded-lg border border-border bg-background/40 p-1">
          {UNITS.map((u) => (
            <button
              className={cn(
                "rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
                unit === u.value
                  ? // DSH-61: blood is fill-only in dark; readable red text
                    // takes the AA token (axe color-contrast pin, /account).
                    "bg-blood/10 text-blood-text"
                  : "text-muted-foreground hover:text-foreground"
              )}
              disabled={isPending}
              key={u.value}
              onClick={() => choose(u.value)}
              type="button"
            >
              {u.label}
            </button>
          ))}
        </div>
      }
      error={error}
      label="Units"
      supporting="How your weight shows across the app."
    />
  );
}
