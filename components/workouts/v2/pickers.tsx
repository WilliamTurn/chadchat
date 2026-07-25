"use client";

// The two selection surfaces the player's menus open (S6 #3): the
// rest-duration picker and the RPE picker. Both ride AdaptiveDialog (canon 02
// §17.171: phone bottom sheet, desktop centered dialog, one deliberate pair;
// never the anchored options menu, which canon 01 §95 reserves for
// dispatching actions, not collecting form input).

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AdaptiveDialog,
  AdaptiveDialogContent,
  AdaptiveDialogDescription,
  AdaptiveDialogFooter,
  AdaptiveDialogHeader,
  AdaptiveDialogTitle,
} from "@/components/ui/adaptive-dialog";
import { Input } from "@/components/ui/input";
import type { SessionExercise } from "./types";
import {
  formatRestSeconds,
  REST_MAX_SECONDS,
  REST_MIN_SECONDS,
  REST_OPTIONS,
  RPE_OPTIONS,
} from "./types";
import { WButton } from "./ui";

/** Parse a typed duration: "2:30" (min:sec), "2" (whole minutes), or a bare
 * seconds count like "90" once it exceeds 59 on its own. Returns seconds, or
 * null when the text does not resolve to a duration. */
function parseCustomRest(raw: string): number | null {
  const text = raw.trim();
  if (text === "") {
    return null;
  }
  if (text.includes(":")) {
    const [minPart, secPart, extra] = text.split(":");
    if (extra !== undefined || secPart === "") {
      return null;
    }
    const min = minPart === "" ? 0 : Number.parseInt(minPart, 10);
    const sec = Number.parseInt(secPart, 10);
    if (Number.isNaN(min) || Number.isNaN(sec) || sec > 59) {
      return null;
    }
    return min * 60 + sec;
  }
  const min = Number.parseInt(text, 10);
  if (Number.isNaN(min)) {
    return null;
  }
  // A bare number reads as minutes ("2" is 2 min), matching the label's
  // min-first order; the echo line restates it so nothing lands silently
  // (canon 01 §157/§163).
  return min * 60;
}

/**
 * Rest-duration picker (owner order S6 #3): presets highlight but nothing
 * applies or closes by itself; the explicit Save commits, with a toast
 * receipt (owner-required). Custom minutes:seconds accepts anything from
 * 5 sec to 10 min.
 */
export function RestTimerPicker({
  wex,
  open,
  onOpenChange,
  onSave,
  returnFocusTo,
}: {
  wex: SessionExercise;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (seconds: number) => void;
  /** Where focus lands on close (flow audit F-5): the menu row that opened
   * this picker unmounts with its menu, so without an explicit home the
   * dialog's default return target is gone and focus falls to <body>. */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}) {
  const isPreset = REST_OPTIONS.some((o) => o.seconds === wex.restSeconds);
  // Staged selection (canon 01 §80/§82: batched commit, explicit Save).
  // null preset means the custom field is the active source.
  const [preset, setPreset] = useState<number | null>(
    isPreset ? wex.restSeconds : null
  );
  const [customText, setCustomText] = useState(
    isPreset
      ? ""
      : `${Math.floor(wex.restSeconds / 60)}:${String(wex.restSeconds % 60).padStart(2, "0")}`
  );
  const [error, setError] = useState<string | null>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const customFieldRef = useRef<HTMLInputElement>(null);

  // Re-stage from the store value when it changes underneath (a different
  // exercise instance, or a save that landed elsewhere). An accidental
  // scrim dismissal deliberately KEEPS the draft (canon 01 §22: dismissal
  // never destroys typed input); the explicit Cancel resets below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    reset();
  }, [wex.restSeconds]);

  function reset() {
    const matches = REST_OPTIONS.some((o) => o.seconds === wex.restSeconds);
    setPreset(matches ? wex.restSeconds : null);
    setCustomText(
      matches
        ? ""
        : `${Math.floor(wex.restSeconds / 60)}:${String(wex.restSeconds % 60).padStart(2, "0")}`
    );
    setError(null);
  }

  // One exclusive value (canon 01 §72): a preset selection clears the custom
  // field; typing in the custom field clears the preset highlight.
  function choosePreset(seconds: number) {
    setPreset(seconds);
    setCustomText("");
    setError(null);
  }

  const customSeconds = parseCustomRest(customText);

  function handleSave() {
    if (preset != null) {
      commit(preset);
      return;
    }
    if (customSeconds == null) {
      fail("Enter the time as minutes and seconds, like 2:30.");
      return;
    }
    if (customSeconds < REST_MIN_SECONDS) {
      fail("Enter 5 sec or more.");
      return;
    }
    if (customSeconds > REST_MAX_SECONDS) {
      fail("Enter 10 min or less.");
      return;
    }
    commit(customSeconds);
  }

  // A failed Save moves focus to the erred field (canon 01 §44).
  function fail(message: string) {
    setError(message);
    customFieldRef.current?.focus();
  }

  function commit(seconds: number) {
    // Save with nothing changed just closes: no receipt for a change that
    // did not happen (flow audit F-19; canon 01 §5/§82).
    if (seconds === wex.restSeconds) {
      setError(null);
      onOpenChange(false);
      return;
    }
    onSave(seconds);
    // The owner-required receipt (S6 #3): the sheet occluded the card, so
    // the result was not observed at the locus of action (canon 03 §33).
    toast.success(
      seconds === 0
        ? `Rest timer turned off for ${wex.name}.`
        : `Rest timer set to ${formatRestSeconds(seconds)} for ${wex.name}.`
    );
    setError(null);
    onOpenChange(false);
  }

  // Roving radiogroup keyboard contract (canon 01 §103): one tab stop,
  // arrows move and select with wrap, Home/End jump.
  function onChipKeyDown(e: React.KeyboardEvent, index: number) {
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (index + 1) % REST_OPTIONS.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (index - 1 + REST_OPTIONS.length) % REST_OPTIONS.length;
    } else if (e.key === "Home") {
      next = 0;
    } else if (e.key === "End") {
      next = REST_OPTIONS.length - 1;
    }
    if (next != null) {
      e.preventDefault();
      choosePreset(REST_OPTIONS[next].seconds);
      chipRefs.current[next]?.focus();
    }
  }

  // The echo confirms only values that will be ACCEPTED (flow audit F-8;
  // canon 01 §140/§49: a positive echo for a value Save will reject reads
  // as acceptance).
  const echo =
    preset == null &&
    customSeconds != null &&
    customSeconds >= REST_MIN_SECONDS &&
    customSeconds <= REST_MAX_SECONDS &&
    !error
      ? formatRestSeconds(customSeconds)
      : null;
  // Staged-but-unsaved is said in words (flow audit F-2; canon 01 §82: the
  // member must be able to answer "have I saved?" at a glance), because an
  // abandoned draft survives dismissal (canon 01 §22) and would otherwise
  // masquerade as the saved value on reopen.
  const staged = preset ?? (echo ? customSeconds : null);
  const dirty = staged != null && staged !== wex.restSeconds;
  // The staged zero case is phrased as an action on the timer (copy audit
  // F-10): "No rest timer selected." garden-paths into its opposite.
  const feedback =
    error ??
    (dirty
      ? staged === 0
        ? "Rest timer will be turned off. Not saved yet."
        : `${echo ?? formatRestSeconds(staged)} selected. Not saved yet.`
      : echo);

  return (
    <AdaptiveDialog onOpenChange={onOpenChange} open={open}>
      <AdaptiveDialogContent
        className="sm:max-w-md"
        // Focus home on close (flow audit F-5; canon 01 §89): the opening
        // menu row is gone, so the default return target would be <body>.
        onCloseAutoFocus={(e) => {
          if (returnFocusTo?.current) {
            e.preventDefault();
            returnFocusTo.current.focus();
          }
        }}
      >
        <AdaptiveDialogHeader>
          <AdaptiveDialogTitle>Rest timer for {wex.name}</AdaptiveDialogTitle>
          <AdaptiveDialogDescription>
            The countdown starts each time you check off a set.
          </AdaptiveDialogDescription>
        </AdaptiveDialogHeader>

        {/* Preset chips (canon 01 §159: rest timers get chips at the values
            people actually pick; §68: all options visible). */}
        <div
          aria-label="Rest duration"
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
          role="radiogroup"
        >
          {REST_OPTIONS.map((o, i) => {
            const isSelected = preset === o.seconds;
            return (
              <WButton
                aria-checked={isSelected}
                // h-11, not min-h-11 (placement audit F-9): size="sm" sets
                // its own 40px min-height and two min-heights race in the
                // cascade; an explicit height wins and holds the 44px floor.
                className={`h-11 w-full px-2 text-sm ${
                  o.seconds === 0 ? "col-span-2 sm:col-span-3" : ""
                } ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/10 text-foreground"
                    : "text-muted-foreground"
                }`}
                key={o.seconds}
                onClick={() => choosePreset(o.seconds)}
                onKeyDown={(e) => onChipKeyDown(e, i)}
                ref={(el) => {
                  chipRefs.current[i] = el;
                }}
                role="radio"
                size="sm"
                tabIndex={isSelected || (preset == null && i === 0) ? 0 : -1}
                variant="secondary"
              >
                {o.label}
              </WButton>
            );
          })}
        </div>

        {/* Custom duration: one masked field (canon 01 §157). Slot order
            label, hint, input, feedback (comp 03 §26); the hint states the
            bounds before any error can happen (canon 01 §140). */}
        <div className="mt-1">
          <label
            className="font-semibold text-foreground text-sm"
            htmlFor="custom-rest"
          >
            Custom rest (min:sec)
          </label>
          <p className="mt-1 text-muted-foreground text-xs">
            Anything from 5 sec to 10 min.
          </p>
          <Input
            aria-describedby="custom-rest-feedback"
            aria-invalid={error != null || undefined}
            className="mt-2 h-12 w-24 text-center font-mono text-base tabular-nums"
            id="custom-rest"
            inputMode="numeric"
            onChange={(e) => {
              setCustomText(e.target.value.replace(/[^0-9:]/g, ""));
              setPreset(null);
              setError(null);
            }}
            onFocus={(e) => e.target.select()}
            placeholder="2:30"
            ref={customFieldRef}
            type="text"
            value={customText}
          />
          {/* Reserved feedback slot (owner-resolved reserve-space rule:
              nothing ever jumps). The echo restates the resolved value so a
              typed "2" can never silently mean the wrong thing (canon 01
              §157/§163). */}
          <p
            aria-live="polite"
            className={`mt-1.5 min-h-5 text-sm ${
              error ? "text-blood" : "text-muted-foreground"
            }`}
            id="custom-rest-feedback"
            role={error ? "alert" : undefined}
          >
            {feedback}
          </p>
        </div>

        <AdaptiveDialogFooter>
          {/* Stacked on phones: Save on top, Cancel below (owner-resolved
              2026-07-23); inline on desktop: Cancel then Save trailing
              (comp 04 §28). */}
          <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <WButton
              // Cancel closes without applying, same as every other
              // dismissal (copy audit F-16: two same-looking exits must not
              // behave differently). The staged draft survives (canon 01
              // §22) and the "Not saved yet." line owns the disambiguation
              // on reopen; the store value is untouched either way.
              onClick={() => onOpenChange(false)}
              variant="ghost"
            >
              Cancel
            </WButton>
            <WButton onClick={handleSave} variant="primary">
              Save rest timer
            </WButton>
          </div>
        </AdaptiveDialogFooter>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}

/**
 * RPE picker: a plain selection list (comp 04 §21: full-width rows, no
 * enclosing card). Instant-apply stays, matching the pre-S6 behavior: one
 * setting whose result (the RPE chip on the set row) is visible right after
 * close.
 */
export function RpePicker({
  setIndex,
  exerciseName,
  current,
  open,
  onOpenChange,
  onSelect,
  returnFocusTo,
}: {
  setIndex: number;
  /** Carried in the title (copy audit F-17): three exercises can each have
   * a set 2, so "Effort for set 2" alone is ambiguous. */
  exerciseName: string;
  current: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (rpe: number | null) => void;
  /** Where focus lands on close (flow audit F-5), same as RestTimerPicker. */
  returnFocusTo?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <AdaptiveDialog onOpenChange={onOpenChange} open={open}>
      <AdaptiveDialogContent
        className="sm:max-w-md"
        onCloseAutoFocus={(e) => {
          if (returnFocusTo?.current) {
            e.preventDefault();
            returnFocusTo.current.focus();
          }
        }}
      >
        <AdaptiveDialogHeader>
          <AdaptiveDialogTitle>
            Effort for set {setIndex + 1} · {exerciseName}
          </AdaptiveDialogTitle>
          <AdaptiveDialogDescription>
            Rate of perceived exertion, how hard the set felt.
          </AdaptiveDialogDescription>
        </AdaptiveDialogHeader>
        <div className="flex flex-col gap-1">
          {RPE_OPTIONS.map((o) => {
            const isSelected = current === o.value;
            return (
              <WButton
                aria-pressed={isSelected}
                className={`min-h-12 w-full justify-between gap-3 border-0 px-3 py-2 text-left shadow-none ${
                  isSelected
                    ? "bg-emerald-500/10 text-foreground"
                    : "bg-transparent text-foreground hover:bg-muted/60"
                }`}
                key={o.label}
                onClick={() => {
                  onSelect(o.value);
                  onOpenChange(false);
                }}
                variant="secondary"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-sm">{o.label}</span>
                  <span className="block font-normal text-muted-foreground text-xs">
                    {o.hint}
                  </span>
                </span>
                {isSelected && (
                  <span className="shrink-0 font-bold text-emerald-600 text-xs dark:text-emerald-400">
                    Current
                  </span>
                )}
              </WButton>
            );
          })}
        </div>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}
