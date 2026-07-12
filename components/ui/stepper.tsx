"use client";

import { Minus, Plus } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * NUMBER STEPPER (FIX-38, P2-E). The quantity control every logger composes
 * for bounded numeric entry (oz of water, sets, reps, hours), following the
 * MacroFactor / MyFitnessPal quantity-row convention: a decrement button, a
 * directly editable value, an increment button.
 *
 * - Buttons are 44px on touch, 40px under a pointer (target-size law), and
 *   disable at min/max instead of silently clamping a tap.
 * - The center field stays keyboard-editable (inputmode="decimal"); typed
 *   values are clamped to [min, max] and snapped to the step's precision on
 *   blur, never while typing.
 * - Buttons carry "Decrease {label}" / "Increase {label}" accessible names;
 *   pass the same label the visible FieldLabel shows, unit included.
 */
export function NumberStepper({
  value,
  onChange,
  label,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  id,
  disabled = false,
  className,
  inputClassName,
}: {
  value: number;
  onChange: (next: number) => void;
  /** The field's visible label text, unit included ("Amount (oz)"). */
  label: string;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}) {
  // Track the in-progress text so typing "1." or clearing the field works;
  // commit (clamp + snap) on blur or Enter.
  const [draft, setDraft] = React.useState<string | null>(null);

  const decimals = countDecimals(step);
  const shown = draft ?? formatValue(value, decimals);

  const commit = (raw: string) => {
    setDraft(null);
    const parsed = Number.parseFloat(raw);
    if (Number.isNaN(parsed)) {
      return; // keep the prior value; never wipe input to zero
    }
    onChange(clamp(roundTo(parsed, decimals), min, max));
  };

  const nudge = (direction: 1 | -1) => {
    setDraft(null);
    onChange(clamp(roundTo(value + direction * step, decimals), min, max));
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        aria-label={`Decrease ${label}`}
        className="shrink-0"
        disabled={disabled || value <= min}
        onClick={() => nudge(-1)}
        size="icon-lg"
        type="button"
        variant="outline"
      >
        <Minus />
      </Button>
      <Input
        aria-label={label}
        className={cn("text-center tabular-nums", inputClassName)}
        disabled={disabled}
        id={id}
        inputMode="decimal"
        onBlur={(e) => commit(e.target.value)}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit((e.target as HTMLInputElement).value);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            nudge(1);
          } else if (e.key === "ArrowDown") {
            e.preventDefault();
            nudge(-1);
          }
        }}
        size="lg"
        type="text"
        value={shown}
      />
      <Button
        aria-label={`Increase ${label}`}
        className="shrink-0"
        disabled={disabled || value >= max}
        onClick={() => nudge(1)}
        size="icon-lg"
        type="button"
        variant="outline"
      >
        <Plus />
      </Button>
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function countDecimals(step: number): number {
  const text = String(step);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
}

function roundTo(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

function formatValue(n: number, decimals: number): string {
  return decimals > 0 ? n.toFixed(decimals) : String(n);
}
