"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveChadIntensity } from "@/app/account/actions";

type Intensity = "full" | "medium" | "low";

// Clear, exact labels + a plain blurb under each so members know precisely how
// the choice changes Chad. Order is strongest → softest; full is the default
// and carries the "Recommended" tag.
const OPTIONS: {
  value: Intensity;
  label: string;
  recommended?: boolean;
  blurb: string;
}[] = [
  {
    value: "full",
    label: "Full Intensity",
    recommended: true,
    blurb:
      "Chad holds nothing back. Expect to get your feelings hurt when you slack off — profanity, insults, and ruthless accountability.",
  },
  {
    value: "medium",
    label: "Medium Intensity",
    blurb:
      "Firm but not fully intense. Chad still calls out every excuse and pushes you hard, with far less profanity and no personal insults.",
  },
  {
    value: "low",
    label: "Lowest Intensity",
    blurb:
      "No cursing, no insults, and Chad never goes too hard on you. He stays direct and honest, and still holds you fully accountable.",
  },
];

const CONFIRMATION: Record<Intensity, string> = {
  full: "Full intensity. Chad holds nothing back.",
  medium: "Medium intensity. Firm, with the edges taken off.",
  low: "Lowest intensity. Direct and honest, never harsh.",
};

/**
 * Chad's harshness dial on /account. Same optimistic pattern as the other
 * account switches: flip immediately, roll back and toast on failure.
 */
export function IntensitySettings({
  initialIntensity,
}: {
  initialIntensity: Intensity;
}) {
  const [intensity, setIntensity] = useState<Intensity>(initialIntensity);
  const [isPending, startTransition] = useTransition();

  function save(next: Intensity) {
    if (next === intensity) {
      return;
    }
    const prev = intensity;
    setIntensity(next);
    startTransition(async () => {
      try {
        await saveChadIntensity(next);
        toast.success(CONFIRMATION[next]);
      } catch {
        setIntensity(prev);
        toast.error("Couldn't save that. Try again.");
      }
    });
  }

  return (
    <div>
      <h3 className="font-medium text-sm">Chad&apos;s intensity</h3>
      <p className="mt-1 text-muted-foreground text-sm">
        How hard Chad goes on you. He&apos;s an expert who stays honest and holds
        you accountable at every setting — this only changes how harshly he
        delivers it.
      </p>

      <fieldset
        aria-label="Chad's intensity"
        className="mt-4 flex flex-col gap-3"
        disabled={isPending}
      >
        {OPTIONS.map((option) => {
          const selected = intensity === option.value;
          return (
            <label
              className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/40"
              }`}
              htmlFor={`intensity-${option.value}`}
              key={option.value}
            >
              <input
                checked={selected}
                className="mt-1 size-4 shrink-0 accent-primary"
                id={`intensity-${option.value}`}
                name="chad-intensity"
                onChange={() => save(option.value)}
                type="radio"
                value={option.value}
              />
              <span className="flex flex-col gap-1">
                <span className="flex items-center gap-2 font-medium text-sm">
                  {option.label}
                  {option.recommended && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                      Recommended
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground text-sm">
                  {option.blurb}
                </span>
              </span>
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}
