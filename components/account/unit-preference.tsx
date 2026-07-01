"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setPreferredWeightUnit } from "@/app/account/actions";
import { cn } from "@/lib/utils";

const UNITS: { value: "lb" | "kg"; label: string }[] = [
  { value: "lb", label: "Pounds (lb)" },
  { value: "kg", label: "Kilograms (kg)" },
];

/**
 * Segmented lb/kg picker for the member's preferred body-weight unit. Optimistic
 * — flips instantly, rolls back on failure. The preference drives how weight
 * reads across /today and /progress and the default unit for new weigh-ins.
 */
export function UnitPreference({
  initialUnit,
}: {
  initialUnit: "lb" | "kg" | null;
}) {
  const [unit, setUnit] = useState<"lb" | "kg">(initialUnit ?? "lb");
  const [isPending, startTransition] = useTransition();

  function choose(next: "lb" | "kg") {
    if (next === unit) {
      return;
    }
    const prev = unit;
    setUnit(next);
    startTransition(async () => {
      try {
        await setPreferredWeightUnit(next);
        toast.success(`Weight now shows in ${next}.`);
      } catch {
        setUnit(prev);
        toast.error("Couldn't save that. Try again.");
      }
    });
  }

  return (
    <div className="inline-flex rounded-lg border border-border bg-background/40 p-1">
      {UNITS.map((u) => (
        <button
          className={cn(
            "rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
            unit === u.value
              ? "bg-blood/10 text-blood"
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
  );
}
