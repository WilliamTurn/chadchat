"use client";

// The Add Cardio PAGE (calories-burned Phase 3): pick an activity from the
// vendored catalog, enter minutes (+ an optional effort), and it lands in
// workout history as a logged session. The estimated burn (net METs at the
// member's latest weigh-in) previews live and is always labeled estimated;
// with no weigh-in yet the flow still saves and simply shows no number.
//
// Styling stays on the design system (FIX-37): shared Input/Select/Button
// primitives and the standard type scale only.

import { Flame, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { logCardio } from "@/app/workouts/actions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACTIVITY_CATALOG,
  ACTIVITY_GROUPS,
  type Activity,
} from "@/lib/energy/activity-catalog";
import { cardioNetKcal, netKcalPerMinute } from "@/lib/energy/workout-energy";
import { Eyebrow, WButton, WCard } from "./ui";

/** "~9 cal/min" at the member's weight; null hides the hint (no guess). */
function perMinuteHint(met: number, weightKg: number | null): string | null {
  const rate = netKcalPerMinute(met, weightKg);
  if (rate == null) {
    return null;
  }
  return `~${Math.max(1, Math.round(rate))} cal/min`;
}

function ActivityList({
  weightKg,
  onPick,
}: {
  weightKg: number | null;
  onPick: (activity: Activity) => void;
}) {
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ACTIVITY_GROUPS.map((group) => ({
      ...group,
      activities: ACTIVITY_CATALOG.filter(
        (a) => a.group === group.id && (!q || a.label.toLowerCase().includes(q))
      ),
    })).filter((group) => group.activities.length > 0);
  }, [query]);

  return (
    <>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground/70"
        />
        <Input
          aria-label="Search activities"
          className="h-12 rounded-xl pl-10"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search activities…"
          type="search"
          value={query}
        />
      </div>

      {sections.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-semibold text-foreground text-sm">
            No activities match
          </p>
          <p className="mt-1 text-muted-foreground text-sm">
            Try a different name. The list covers gym cardio, outdoor
            training, and sports.
          </p>
        </div>
      ) : (
        sections.map((group) => (
          <section aria-label={group.label} className="mt-5" key={group.id}>
            <Eyebrow className="mb-2">{group.label}</Eyebrow>
            {/* Multi-column card grid on desktop (LAY-1); explicit
                grid-cols-1 + min-w-0 so the implicit column never sizes to
                max-content. Columns start at lg, like the exercise picker. */}
            <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
              {group.activities.map((activity) => {
                const hint = perMinuteHint(activity.met, weightKg);
                return (
                  <li className="min-w-0" key={activity.id}>
                    <Button
                      className="h-auto min-h-14 w-full justify-between gap-3 rounded-xl px-4 py-2.5 text-left"
                      onClick={() => onPick(activity)}
                      type="button"
                      variant="outline"
                    >
                      <span className="min-w-0 flex-1 whitespace-normal font-semibold text-foreground text-sm">
                        {activity.label}
                      </span>
                      {hint && (
                        <span className="shrink-0 text-right">
                          <span className="block font-mono font-semibold text-foreground text-sm tabular-nums">
                            {hint}
                          </span>
                          <span className="block font-normal text-muted-foreground text-xs">
                            at your weight
                          </span>
                        </span>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </>
  );
}

export function CardioLog({
  weightKg,
  todayISO,
}: {
  /** Latest weigh-in in kg; null = no weigh-in yet (estimates hidden). */
  weightKg: number | null;
  /** The member's local today (yyyy-mm-dd), for the backfill cap. */
  todayISO: string;
}) {
  const router = useRouter();
  const [activity, setActivity] = useState<Activity | null>(null);
  const [variantId, setVariantId] = useState<string | undefined>(undefined);
  const [minutes, setMinutes] = useState("");
  const [dayISO, setDayISO] = useState(todayISO);
  const [saving, setSaving] = useState(false);

  const minutesNum = (() => {
    const n = Number(minutes);
    return Number.isInteger(n) && n >= 1 && n <= 1440 ? n : null;
  })();

  const estimate =
    activity && minutesNum != null
      ? cardioNetKcal({
          activityId: activity.id,
          variantId,
          minutes: minutesNum,
          weightKg,
        })
      : null;

  function pick(next: Activity) {
    setActivity(next);
    // Preselect the effort that matches the activity's default MET, so the
    // picker's number and the logged number always agree.
    setVariantId(next.variants?.find((v) => v.met === next.met)?.id);
  }

  async function save() {
    if (!(activity && minutesNum != null) || saving) {
      return;
    }
    setSaving(true);
    const result = await logCardio({
      activityId: activity.id,
      variantId,
      minutes: minutesNum,
      performedAt: dayISO === todayISO ? undefined : dayISO,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error ?? "Couldn't log that cardio.");
      return;
    }
    toast.success(
      result.estimatedKcal != null
        ? `${activity.label} logged. ~${result.estimatedKcal.toLocaleString()} cal estimated.`
        : `${activity.label} logged.`
    );
    router.push("/workouts");
    router.refresh();
  }

  if (!activity) {
    return (
      <div className="pb-24">
        <ActivityList onPick={pick} weightKg={weightKg} />
      </div>
    );
  }

  const saveHint = minutesNum == null ? "Enter the minutes to log it" : null;

  return (
    <div className="pb-24">
      <WCard className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-bold text-foreground text-lg">
              {activity.label}
            </h2>
            <p className="mt-0.5 text-muted-foreground text-sm">
              {ACTIVITY_GROUPS.find((g) => g.id === activity.group)?.label}
            </p>
          </div>
          <WButton
            onClick={() => {
              setActivity(null);
              setVariantId(undefined);
            }}
            size="sm"
          >
            Change activity
          </WButton>
        </div>

        <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-5">
          {/* Minutes */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cardio-minutes">Minutes</Label>
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                className="h-12 w-24 rounded-xl text-center font-bold font-mono tabular-nums md:text-lg"
                id="cardio-minutes"
                inputMode="numeric"
                max={1440}
                min={1}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="30"
                type="number"
                value={minutes}
              />
              <span className="text-muted-foreground text-sm">minutes</span>
            </div>
          </div>

          {/* Effort, only when the activity has real intensity options. */}
          {activity.variants && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cardio-effort">Effort</Label>
              <Select onValueChange={setVariantId} value={variantId}>
                <SelectTrigger
                  className="h-12 min-w-44 rounded-xl"
                  id="cardio-effort"
                >
                  <SelectValue placeholder="Pick the effort" />
                </SelectTrigger>
                <SelectContent>
                  {activity.variants.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Day (backfill like the meal logger; never a future day). */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cardio-day">Day</Label>
            <DatePicker
              className="h-12 min-w-52 rounded-xl"
              id="cardio-day"
              max={todayISO}
              onChange={setDayISO}
              value={dayISO}
            />
          </div>
        </div>

        {/* Estimated burn, labeled estimated; absent with no weigh-in. */}
        <div className="mt-5 border-border border-t pt-4">
          {weightKg == null ? (
            <p className="text-muted-foreground text-sm">
              This will still be saved.{" "}
              <Link
                className="text-foreground underline underline-offset-4"
                href="/progress"
              >
                Log a weigh-in
              </Link>{" "}
              and estimated calories appear here and on your day.
            </p>
          ) : estimate != null ? (
            <div>
              <p className="flex items-center gap-2 font-bold text-foreground text-lg tabular-nums">
                <Flame aria-hidden className="size-5 text-amber-500" />
                ~{estimate.toLocaleString()} cal estimated
              </p>
              <p className="mt-1 text-muted-foreground text-sm">
                Estimated from time and effort at your body weight. It counts
                toward your day&apos;s calories.
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Enter the minutes and the estimated calories show here.
            </p>
          )}
        </div>
      </WCard>

      {/* Full-width on phones, left-anchored auto width on desktop (the
          s180 form-button ruling). */}
      {saveHint && (
        <p className="mt-3 text-muted-foreground text-xs">{saveHint}</p>
      )}
      <WButton
        className="mt-3 w-full sm:w-auto"
        disabled={!(activity && minutesNum != null)}
        loading={saving}
        onClick={save}
        size="lg"
        variant="primary"
      >
        Log {activity.label}
      </WButton>
    </div>
  );
}
