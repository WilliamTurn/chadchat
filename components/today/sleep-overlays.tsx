"use client";

import { Star } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
  AdaptiveDialog,
  AdaptiveDialogContent,
  AdaptiveDialogDescription,
  AdaptiveDialogHeader,
  AdaptiveDialogTitle,
  useOverlayDraft,
} from "@/components/ui/adaptive-dialog";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCalendarDay, todayLocalISO } from "@/lib/date";
import { formatMinutesAsDuration } from "@/lib/contracts/units";
import { cn } from "@/lib/utils";

/**
 * SLEEP OVERLAYS (P56-C, FIX-27). The log and goal-edit flows for the Sleep
 * panel, on the FIX-17 overlay platform (AdaptiveDialog: centered dialog on
 * desktop, bottom sheet on phones) + FIX-38 form primitives. These replace
 * the old SleepTracker/SleepLogForm POPOVER forms, the banned s168 pattern
 * and the DSH-59 anchored-overlay collision class. Nothing auto-focuses on
 * open (owner law); drafts survive accidental dismissal (useOverlayDraft).
 *
 * The date field IS the backfill path (every-logger-needs-backfill law):
 * any past night, picked right where you log, replaces announced up front.
 */

export const QUALITY_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "OK",
  4: "Good",
  5: "Great",
};

const HOUR_OPTIONS = Array.from({ length: 13 }, (_, i) => i); // 0..12
const MINUTE_OPTIONS = [0, 15, 30, 45];

/** An already-logged night, for the "this replaces ..." announcement. */
export type LoggedNight = { iso: string; minutes: number };

export type SleepLogInput = {
  recordedAt: string;
  minutes: number;
  quality: number | null;
};

function StarPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (next: number | null) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Button
          aria-label={`${n} star${n === 1 ? "" : "s"}: ${QUALITY_LABELS[n]}`}
          aria-pressed={value != null && n <= value}
          className="min-h-11 min-w-11 transition-transform hover:scale-110 sm:min-h-8 sm:min-w-8"
          key={n}
          onClick={() => onChange(value === n ? null : n)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Star
            className={cn(
              "size-5",
              value != null && n <= value
                ? "fill-indigo-400 text-indigo-400"
                : "text-muted-foreground/40"
            )}
          />
        </Button>
      ))}
      {value != null && (
        <span className="ml-1.5 text-muted-foreground text-xs">
          {QUALITY_LABELS[value]}
        </span>
      )}
    </div>
  );
}

/**
 * Quick-log overlay: night, duration, optional quality. The panel owns the
 * server action, the receipt toast, and the exact-entry Undo; this form only
 * collects honest input. `mode: "edit"` locks the date to the night being
 * corrected and seeds the saved values.
 */
export function LogSleepDialog({
  open,
  onOpenChange,
  pending,
  mode = "create",
  defaultDate,
  defaultMinutes,
  defaultQuality = null,
  loggedNights = [],
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  mode?: "create" | "edit";
  /** Calendar-day ISO the date field starts at (edit: the fixed night). */
  defaultDate?: string;
  defaultMinutes?: number;
  defaultQuality?: number | null;
  /** Nights that already have an entry, so an overwrite is announced. */
  loggedNights?: LoggedNight[];
  /** Panel-owned save; `replacing` = this overwrites an existing night. */
  onSave: (input: SleepLogInput, opts: { replacing: boolean }) => void;
}) {
  const isEdit = mode === "edit";
  const [date, setDate, clearDate] = useOverlayDraft(
    isEdit ? `sleep-edit-date-${defaultDate}` : "sleep-log-date",
    defaultDate ?? todayLocalISO()
  );
  const [hours, setHours, clearHours] = useOverlayDraft(
    isEdit ? `sleep-edit-hours-${defaultDate}` : "sleep-log-hours",
    defaultMinutes != null ? String(Math.floor(defaultMinutes / 60)) : "7"
  );
  const [minutes, setMinutes, clearMinutes] = useOverlayDraft(
    isEdit ? `sleep-edit-minutes-${defaultDate}` : "sleep-log-minutes",
    defaultMinutes != null ? String(defaultMinutes % 60) : "30"
  );
  const [quality, setQuality] = useState<number | null>(defaultQuality);
  const [error, setError] = useState<string | null>(null);

  // The entry the selected night would replace (create mode only; an edit is
  // an intentional correction).
  const replacing = isEdit
    ? null
    : (loggedNights.find((n) => n.iso === date) ?? null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const total = Number(hours) * 60 + Number(minutes);
    if (!Number.isFinite(total) || total <= 0) {
      setError("Enter how long you slept.");
      return;
    }
    setError(null);
    clearDate();
    clearHours();
    clearMinutes();
    onSave(
      { recordedAt: date, minutes: total, quality },
      { replacing: replacing != null }
    );
  }

  return (
    <AdaptiveDialog onOpenChange={onOpenChange} open={open}>
      <AdaptiveDialogContent>
        <AdaptiveDialogHeader>
          <AdaptiveDialogTitle>
            {isEdit ? "Edit sleep" : "Log sleep"}
          </AdaptiveDialogTitle>
          <AdaptiveDialogDescription>
            {isEdit
              ? `Night of ${formatCalendarDay(new Date(`${date}T12:00:00Z`), {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}.`
              : "How long did you sleep? Pick an earlier night to log a past one."}
          </AdaptiveDialogDescription>
        </AdaptiveDialogHeader>

        <form
          className="flex flex-col gap-4 px-4 pb-4 sm:px-0 sm:pb-0"
          onSubmit={onSubmit}
        >
          {!isEdit && (
            <Field>
              <FieldLabel htmlFor="sleep-log-night">Night of</FieldLabel>
              <DatePicker
                className="min-h-11"
                id="sleep-log-night"
                max={todayLocalISO()}
                onChange={setDate}
                value={date}
              />
              {replacing && (
                <p className="text-amber-500 text-xs dark:text-amber-400">
                  Replaces the {formatMinutesAsDuration(replacing.minutes)}{" "}
                  already logged for this night.
                </p>
              )}
            </Field>
          )}

          <Field>
            <FieldLabel>Time asleep</FieldLabel>
            <div className="flex items-center gap-2">
              <Select onValueChange={setHours} value={hours}>
                <SelectTrigger aria-label="Hours slept" className="min-h-11 sm:min-h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOUR_OPTIONS.map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {h} h
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select onValueChange={setMinutes} value={minutes}>
                <SelectTrigger
                  aria-label="Minutes slept"
                  className="min-h-11 sm:min-h-9"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MINUTE_OPTIONS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} m
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Field>

          <Field>
            <FieldLabel>Quality (optional)</FieldLabel>
            <StarPicker onChange={setQuality} value={quality} />
          </Field>

          {error && <p className="text-critical-text text-sm">{error}</p>}

          <Button className="mt-1" loading={pending} size="lg" type="submit">
            {isEdit ? "Save changes" : "Log sleep"}
          </Button>
        </form>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}

/**
 * Goal-edit overlay (the panel's overflow "Edit nightly goal"): the usual
 * 7 to 9 hour presets plus exact hour/minute selects.
 */
export function EditSleepGoalDialog({
  open,
  onOpenChange,
  goalMinutes,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalMinutes: number;
  pending: boolean;
  /** Saves the goal (panel-owned action); resolves ok=false on failure. */
  onSave: (minutes: number) => Promise<{ ok: boolean; error?: string | null }>;
}) {
  const [hours, setHours, clearHours] = useOverlayDraft(
    "sleep-goal-hours",
    String(Math.floor(goalMinutes / 60))
  );
  const [minutes, setMinutes, clearMinutes] = useOverlayDraft(
    "sleep-goal-minutes",
    String(goalMinutes % 60)
  );
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const total = Number(hours) * 60 + Number(minutes);
    if (!Number.isFinite(total) || total <= 0) {
      setError("Enter a nightly sleep goal.");
      return;
    }
    setError(null);
    const result = await onSave(total);
    if (result.ok) {
      clearHours();
      clearMinutes();
      onOpenChange(false);
    } else {
      setError(result.error ?? "We couldn't save your goal. Try again.");
    }
  }

  return (
    <AdaptiveDialog onOpenChange={onOpenChange} open={open}>
      <AdaptiveDialogContent>
        <AdaptiveDialogHeader>
          <AdaptiveDialogTitle>Nightly sleep goal</AdaptiveDialogTitle>
          <AdaptiveDialogDescription>
            How much sleep to aim for each night. 7 to 9 hours is the usual
            recommendation.
          </AdaptiveDialogDescription>
        </AdaptiveDialogHeader>

        <form
          className="flex flex-col gap-3 px-4 pb-4 sm:px-0 sm:pb-0"
          onSubmit={onSubmit}
        >
          <Field>
            <FieldLabel>Goal</FieldLabel>
            <div className="flex gap-2">
              {[7 * 60, 8 * 60, 9 * 60].map((preset) => (
                <Button
                  className="min-h-11 flex-1 px-0 text-xs sm:min-h-8"
                  key={preset}
                  onClick={() => {
                    setHours(String(Math.floor(preset / 60)));
                    setMinutes(String(preset % 60));
                    setError(null);
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {formatMinutesAsDuration(preset)}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Select onValueChange={setHours} value={hours}>
                <SelectTrigger aria-label="Goal hours" className="min-h-11 sm:min-h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                    <SelectItem key={h} value={String(h)}>
                      {h} h
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select onValueChange={setMinutes} value={minutes}>
                <SelectTrigger
                  aria-label="Goal minutes"
                  className="min-h-11 sm:min-h-9"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MINUTE_OPTIONS.map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} m
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="shrink-0" loading={pending} type="submit">
                Save goal
              </Button>
            </div>
            {error && <p className="text-critical-text text-sm">{error}</p>}
          </Field>
        </form>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}
