"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveTimezone } from "@/app/account/actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** "America/New_York" → "America/New York" for display. */
function zoneLabel(tz: string): string {
  return tz.replace(/_/g, " ");
}

/**
 * The /account timezone dropdown (FEAT-8). The zone is normally captured
 * silently from the browser (TimezoneSync / the report-settings save), so most
 * members never touch this — it exists so the value is visible and fixable,
 * the same way every serious tracker exposes it in settings. Optimistic like
 * the sibling preference controls — flips instantly, rolls back on failure.
 */
export function TimezonePreference({
  initialTimezone,
}: {
  initialTimezone: string | null;
}) {
  const [timezone, setTimezone] = useState(initialTimezone);
  const [detected, setDetected] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Resolved after mount — the server doesn't know the browser's zone, and
  // rendering it during SSR would hydration-mismatch.
  useEffect(() => {
    try {
      setDetected(Intl.DateTimeFormat().resolvedOptions().timeZone ?? null);
    } catch {
      setDetected(null);
    }
  }, []);

  const options = useMemo(() => {
    let zones: string[] = [];
    try {
      zones = Intl.supportedValuesOf("timeZone");
    } catch {
      zones = [];
    }
    // Whatever is stored/detected must be selectable even if the browser's
    // canonical list doesn't include it.
    for (const extra of [timezone, detected]) {
      if (extra && !zones.includes(extra)) {
        zones = [...zones, extra].sort();
      }
    }
    return zones;
  }, [timezone, detected]);

  // Until a zone is stored, day math on the server falls back — show the
  // detected browser zone as what's effectively about to be captured.
  const effective = timezone ?? detected;

  function save(next: string) {
    if (next === timezone) {
      return;
    }
    const prev = timezone;
    setTimezone(next);
    startTransition(async () => {
      try {
        await saveTimezone(next);
        toast.success(`Time zone set to ${zoneLabel(next)}.`);
      } catch {
        setTimezone(prev);
        toast.error("Couldn't save that. Try again.");
      }
    });
  }

  return (
    <Select
      disabled={isPending || options.length === 0}
      onValueChange={save}
      value={effective ?? undefined}
    >
      <SelectTrigger aria-label="Time zone" className="w-[15rem] max-w-full">
        <SelectValue placeholder="Set your time zone" />
      </SelectTrigger>
      <SelectContent>
        {options.map((tz) => (
          <SelectItem key={tz} value={tz}>
            {zoneLabel(tz)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
