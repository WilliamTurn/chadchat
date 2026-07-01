"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveCheckInSettings } from "@/app/account/actions";
import { Switch } from "@/components/ui/switch";
import type { CheckInFrequency } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

const FREQUENCIES: { value: CheckInFrequency; label: string }[] = [
  { value: "daily", label: "Every day" },
  { value: "three_per_week", label: "A few times a week" },
  { value: "weekly", label: "Once a week" },
];

/**
 * The Elite check-in controls (FEAT-11): an on/off switch for Chad's proactive
 * emails plus a frequency picker, so nobody ever feels spammed. Optimistic like
 * UnitPreference — flips instantly, rolls back on failure.
 */
export function CheckInSettings({
  initialEnabled,
  initialFrequency,
}: {
  initialEnabled: boolean;
  initialFrequency: CheckInFrequency;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [frequency, setFrequency] = useState<CheckInFrequency>(
    initialFrequency
  );
  const [isPending, startTransition] = useTransition();

  function save(
    nextEnabled: boolean,
    nextFrequency: CheckInFrequency,
    successMessage: string
  ) {
    const prev = { enabled, frequency };
    setEnabled(nextEnabled);
    setFrequency(nextFrequency);
    startTransition(async () => {
      try {
        await saveCheckInSettings({
          enabled: nextEnabled,
          frequency: nextFrequency,
        });
        toast.success(successMessage);
      } catch {
        setEnabled(prev.enabled);
        setFrequency(prev.frequency);
        toast.error("Couldn't save that. Try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="font-medium text-sm">Check-ins from Chad</h3>
          <p className="mt-1 text-muted-foreground text-sm">
            Chad emails you first — a morning brief to set the day, and a
            callout if you go quiet. Pick how often he reaches out.
          </p>
        </div>
        <Switch
          aria-label="Email check-ins from Chad"
          checked={enabled}
          disabled={isPending}
          onCheckedChange={(next) =>
            save(
              next,
              frequency,
              next
                ? "Check-ins are on. Chad will reach out."
                : "Check-ins are off. Chad will wait for you."
            )
          }
        />
      </div>

      {enabled && (
        <div className="inline-flex flex-wrap gap-1 self-start rounded-lg border border-border bg-background/40 p-1">
          {FREQUENCIES.map((f) => (
            <button
              className={cn(
                "rounded-md px-3 py-1.5 font-medium text-sm transition-colors",
                frequency === f.value
                  ? "bg-blood/10 text-blood"
                  : "text-muted-foreground hover:text-foreground"
              )}
              disabled={isPending}
              key={f.value}
              onClick={() => {
                if (f.value !== frequency) {
                  save(enabled, f.value, `Chad will check in ${f.label.toLowerCase()}.`);
                }
              }}
              type="button"
            >
              {f.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
