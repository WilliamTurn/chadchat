"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { saveTimezone } from "@/app/account/actions";
import { SettingsRow } from "@/components/account/settings-row";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  isCuratedZone,
  TIMEZONE_GROUPS,
  zoneOffsetLabel,
} from "@/lib/timezones";

/** "America/New_York" → "New York" for a zone outside the curated list. */
function fallbackLabel(tz: string): string {
  const city = tz.split("/").pop() ?? tz;
  return city.replace(/_/g, " ");
}

/**
 * The short label the closed trigger shows: the curated city label with no
 * offset ("Los Angeles (Pacific)"). The live GMT offset is decision support
 * while choosing, so it stays on the LIST items only; with it, the longest
 * stored value overflowed the trigger at every width (the pinned clipped-text
 * defect, canon 04 §15; forms canon 03 #18: design the row at 320px first).
 */
function triggerLabel(tz: string): string {
  for (const group of TIMEZONE_GROUPS) {
    const zone = group.zones.find((z) => z.id === tz);
    if (zone) {
      return zone.label;
    }
  }
  return fallbackLabel(tz);
}

/**
 * The /account time-zone row (FEAT-8). The zone is normally captured
 * silently from the browser (TimezoneSync / the report-settings save), so most
 * members never touch this — it exists so the value is visible and fixable.
 * The list is the CURATED major-city set every mainstream app shows, grouped
 * by region with live GMT offsets — never the browser's full IANA dump. A
 * stored or detected zone outside the curated set is appended so it stays
 * selectable. Optimistic like the sibling preference rows — flips instantly,
 * rolls back on failure. The trigger's new value is the success feedback, no
 * toast (ux-canon 03 #32); failure renders inline (ux-canon 03 #29, #40).
 */
export function TimezonePreference({
  initialTimezone,
}: {
  initialTimezone: string | null;
}) {
  const [timezone, setTimezone] = useState(initialTimezone);
  const [error, setError] = useState<string | null>(null);
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

  // Until a zone is stored, day math on the server falls back — show the
  // detected browser zone as what's effectively about to be captured.
  const effective = timezone ?? detected;

  // Whatever is stored/detected must stay selectable even when it's not one
  // of the curated majors (e.g. America/Boise).
  const extraZones = useMemo(() => {
    const extras: string[] = [];
    for (const z of [timezone, detected]) {
      if (z && !isCuratedZone(z) && !extras.includes(z)) {
        extras.push(z);
      }
    }
    return extras;
  }, [timezone, detected]);

  // Offsets are computed on the client after mount (they're DST-dependent, so
  // rendering them during SSR could hydration-mismatch across midnight).
  const [offsets, setOffsets] = useState<Record<string, string>>({});
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const group of TIMEZONE_GROUPS) {
      for (const z of group.zones) {
        map[z.id] = zoneOffsetLabel(z.id);
      }
    }
    for (const z of extraZones) {
      map[z] = zoneOffsetLabel(z);
    }
    setOffsets(map);
  }, [extraZones]);

  function save(next: string) {
    if (next === timezone) {
      return;
    }
    const prev = timezone;
    setTimezone(next);
    setError(null);
    startTransition(async () => {
      try {
        await saveTimezone(next);
      } catch {
        setTimezone(prev);
        setError("Time zone didn't save. Try again.");
      }
    });
  }

  function itemText(label: string, id: string): string {
    const off = offsets[id];
    return off ? `${label} (${off})` : label;
  }

  return (
    <SettingsRow
      control={
        <Select
          disabled={isPending}
          onValueChange={save}
          value={effective ?? undefined}
        >
          <SelectTrigger aria-label="Time zone" className="w-[15rem] max-w-full">
            {/* Children override Radix's default item text: the closed
                trigger renders the short label so the value never clips
                (canon 04 §15). */}
            <SelectValue placeholder="Set your time zone">
              {effective ? triggerLabel(effective) : null}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {extraZones.length > 0 && (
              <SelectGroup>
                <SelectLabel>Your zone</SelectLabel>
                {extraZones.map((z) => (
                  <SelectItem key={z} value={z}>
                    {itemText(fallbackLabel(z), z)}
                  </SelectItem>
                ))}
              </SelectGroup>
            )}
            {TIMEZONE_GROUPS.map((group) => (
              <SelectGroup key={group.region}>
                <SelectLabel>{group.region}</SelectLabel>
                {group.zones.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {itemText(z.label, z.id)}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      }
      error={error}
      label="Time zone"
      supporting="Sets when your day rolls over: streaks, today's log, and Chad's emails. Detected from your browser."
    />
  );
}
