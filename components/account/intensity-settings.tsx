"use client";

import { useState, useTransition } from "react";
import { saveChadIntensity } from "@/app/account/actions";
import { cn } from "@/lib/utils";

type Intensity = "full" | "medium" | "low";

// Clear, exact labels + a plain blurb under each so members know precisely how
// the choice changes Chad. Order is strongest → softest; full is the default
// and carries the "Recommended" tag. Sentence case (canon 04 §127) and one
// scale register (full / medium / low).
const OPTIONS: {
  value: Intensity;
  label: string;
  recommended?: boolean;
  blurb: string;
}[] = [
  {
    value: "full",
    label: "Full intensity",
    recommended: true,
    blurb:
      "Chad holds nothing back: profanity, insults, and blunt accountability when you fall short.",
  },
  {
    value: "medium",
    label: "Medium intensity",
    blurb:
      "Firm, with far less profanity and no personal insults. Chad still calls out every excuse.",
  },
  {
    value: "low",
    label: "Low intensity",
    blurb:
      "No profanity and no insults. Chad stays direct and honest, and still holds you accountable.",
  },
];

/**
 * Chad's harshness dial: its own zone on /account (the three described option
 * tiles outgrew the settings-row rhythm, comp-canon 06 #8/#9; the zone header
 * carries the name). Optimistic like the sibling rows: flip immediately, roll
 * back on failure. The selected tile is the feedback, no toast (ux-canon 03
 * #32); failure renders inline (ux-canon 03 #29, #40). Tiles are the app's
 * one option-tile species (aria-pressed bordered buttons, selected =
 * blood-tinted, comp-canon 01 #4/#39).
 */
export function IntensitySettings({
  initialIntensity,
}: {
  initialIntensity: Intensity;
}) {
  const [intensity, setIntensity] = useState<Intensity>(initialIntensity);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save(next: Intensity) {
    if (next === intensity) {
      return;
    }
    const prev = intensity;
    setIntensity(next);
    setError(null);
    startTransition(async () => {
      try {
        await saveChadIntensity(next);
      } catch {
        setIntensity(prev);
        setError("Chad's intensity didn't save. Try again.");
      }
    });
  }

  return (
    <div className="py-1">
      {error ? (
        <p className="text-destructive text-sm" role="status">
          {error}
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          How harsh his delivery is. He holds you accountable at every
          setting.
        </p>
      )}

      <div
        aria-label="Chad's intensity"
        className="mt-4 flex flex-col gap-3"
        role="group"
      >
        {OPTIONS.map((option) => {
          const selected = intensity === option.value;
          return (
            <button
              aria-pressed={selected}
              className={cn(
                "min-w-0 rounded-lg border px-3 py-2.5 text-left transition-colors",
                selected
                  ? "border-blood bg-blood/10"
                  : "border-border bg-background/40 hover:border-muted-foreground/40"
              )}
              disabled={isPending}
              key={option.value}
              onClick={() => save(option.value)}
              type="button"
            >
              <span className="flex items-center gap-2 font-medium text-sm">
                {option.label}
                {option.recommended && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
                    Recommended
                  </span>
                )}
              </span>
              <span className="mt-1 block font-normal text-muted-foreground text-sm">
                {option.blurb}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
