"use client";

import { Coffee, Droplets, GlassWater, Milk, Plus } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import {
  AdaptiveDialog,
  AdaptiveDialogContent,
  AdaptiveDialogDescription,
  AdaptiveDialogHeader,
  AdaptiveDialogTitle,
  useOverlayDraft,
} from "@/components/ui/adaptive-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { formatQuantity, mlToOz, ozToMl } from "@/lib/contracts/units";

/**
 * HYDRATION OVERLAYS (P2-Z pilot). The quick-log and goal-edit flows for the
 * Hydration panel, on the FIX-17 overlay platform + FIX-38 form primitives.
 * These replace the old WaterTracker popover forms (popover-for-forms is
 * banned, motion-interaction.md section 5) and their autofocused inputs
 * (nothing auto-starts on open, owner law).
 *
 * One-shot entries go up to a whole gallon (DSH-48): an end-of-night member
 * logging the day's jug shouldn't have to tap small increments repeatedly.
 */
const MAX_CUSTOM_OZ = 128;

/**
 * The serving quick-add grid (DSH-47 + DSH-48): common vessel sizes with
 * icons so "how many oz was that?" answers itself right where you log, and a
 * whole gallon lands in one tap. Every button states its ounces, so totals
 * still speak ONLY oz/gallons (DSH-24/DSH-34).
 */
const SERVINGS: {
  label: string;
  oz: number;
  icon: typeof GlassWater;
  iconClass?: string;
}[] = [
  { label: "Glass", oz: 8, icon: GlassWater },
  { label: "Mug", oz: 12, icon: Coffee },
  { label: "Bottle", oz: 17, icon: Milk },
  { label: "Big bottle", oz: 24, icon: Milk, iconClass: "size-5" },
  { label: "Gallon", oz: 128, icon: Droplets },
];

/**
 * Quick-log overlay: tap a serving and it logs and closes (the receipt toast
 * carries Undo), or enter a custom amount below. Desktop gets a dialog,
 * phones a bottom sheet (AdaptiveDialog).
 */
export function LogWaterDialog({
  open,
  onOpenChange,
  pending,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  /** Fires the optimistic add + server action + receipt toast (panel-owned). */
  onAdd: (ml: number) => void;
}) {
  const customId = useId();
  const errorId = useId();
  const [custom, setCustom, clearCustom] = useOverlayDraft(
    "hydration-log-custom",
    ""
  );
  const [error, setError] = useState<string | null>(null);

  function add(ml: number) {
    onAdd(ml);
    onOpenChange(false);
  }

  function onCustomSubmit(e: FormEvent) {
    e.preventDefault();
    const oz = Number(custom);
    if (!Number.isFinite(oz) || oz <= 0) {
      setError("Enter how much you drank, in ounces.");
      return;
    }
    if (oz > MAX_CUSTOM_OZ) {
      setError(
        `That's more than a gallon. Log up to ${MAX_CUSTOM_OZ} oz at a time.`
      );
      return;
    }
    setError(null);
    clearCustom();
    add(ozToMl(oz));
  }

  return (
    <AdaptiveDialog onOpenChange={onOpenChange} open={open}>
      <AdaptiveDialogContent>
        <AdaptiveDialogHeader>
          <AdaptiveDialogTitle>Log water</AdaptiveDialogTitle>
          <AdaptiveDialogDescription>
            Tap a serving to add it to today's total.
          </AdaptiveDialogDescription>
        </AdaptiveDialogHeader>

        <div className="flex flex-col gap-4 px-4 pb-4 sm:px-0 sm:pb-0">
          <div className="grid grid-cols-3 gap-2">
            {SERVINGS.map((s) => {
              const Icon = s.icon;
              return (
                <Button
                  aria-label={`Add a ${s.label.toLowerCase()} of water, ${s.oz} ounces`}
                  className="h-auto min-h-11 flex-col gap-0.5 py-2.5"
                  key={s.label}
                  onClick={() => add(ozToMl(s.oz))}
                  variant="outline"
                >
                  <Icon className={`${s.iconClass ?? "size-4"} text-sky-400`} />
                  <span className="font-semibold text-sm">+{s.oz} oz</span>
                  <span className="font-normal text-meta text-muted-foreground">
                    {s.label}
                  </span>
                </Button>
              );
            })}
          </div>

          <form className="flex flex-col gap-3" onSubmit={onCustomSubmit}>
            <Field invalid={error != null}>
              <FieldLabel htmlFor={customId}>Custom amount (oz)</FieldLabel>
              <div className="flex gap-2">
                {[20, 32, 64].map((preset) => (
                  <Button
                    className="min-h-11 flex-1 px-0 text-xs sm:min-h-8"
                    key={preset}
                    onClick={() => {
                      setCustom(String(preset));
                      setError(null);
                    }}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    {preset} oz
                  </Button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  aria-describedby={error ? errorId : undefined}
                  aria-invalid={error ? true : undefined}
                  id={customId}
                  inputMode="numeric"
                  onChange={(e) => {
                    setCustom(e.target.value);
                    setError(null);
                  }}
                  placeholder={`Up to ${MAX_CUSTOM_OZ} oz`}
                  size="lg"
                  value={custom}
                />
                <Button
                  className="shrink-0"
                  loading={pending}
                  size="lg"
                  type="submit"
                >
                  <Plus className="size-4" />
                  Add water
                </Button>
              </div>
              {error && <FieldError id={errorId}>{error}</FieldError>}
            </Field>
          </form>
        </div>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}

/**
 * Goal-edit overlay (the panel's overflow "Edit daily goal"): whole-gallon
 * presets plus a bounded custom entry, saved with a loading-state button.
 */
export function EditWaterGoalDialog({
  open,
  onOpenChange,
  goalMl,
  pending,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goalMl: number;
  pending: boolean;
  /** Saves the goal (panel-owned action); resolves ok=false on failure. */
  onSave: (ml: number) => Promise<{ ok: boolean; error?: string | null }>;
}) {
  const inputId = useId();
  const errorId = useId();
  const [value, setValue, clearValue] = useOverlayDraft(
    "hydration-goal-oz",
    String(Math.round(mlToOz(goalMl)))
  );
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const oz = Number(value);
    if (!Number.isFinite(oz) || oz <= 0) {
      setError("Enter a daily goal in ounces.");
      return;
    }
    setError(null);
    const result = await onSave(ozToMl(oz));
    if (result.ok) {
      clearValue();
      onOpenChange(false);
    } else {
      setError(result.error ?? "We couldn't save your goal. Try again.");
    }
  }

  return (
    <AdaptiveDialog onOpenChange={onOpenChange} open={open}>
      <AdaptiveDialogContent>
        <AdaptiveDialogHeader>
          <AdaptiveDialogTitle>Daily hydration goal</AdaptiveDialogTitle>
          <AdaptiveDialogDescription>
            How much water to aim for each day, in ounces. A gallon is{" "}
            {formatQuantity(128, "oz")}.
          </AdaptiveDialogDescription>
        </AdaptiveDialogHeader>

        <form
          className="flex flex-col gap-3 px-4 pb-4 sm:px-0 sm:pb-0"
          onSubmit={onSubmit}
        >
          <Field invalid={error != null}>
            <FieldLabel htmlFor={inputId}>Daily goal (oz)</FieldLabel>
            <div className="flex gap-2">
              {[
                { oz: 64, label: "1/2 gallon" },
                { oz: 96, label: "3/4 gallon" },
                { oz: 128, label: "1 gallon" },
              ].map((preset) => (
                <Button
                  className="min-h-11 flex-1 px-0 text-xs sm:min-h-8"
                  key={preset.oz}
                  onClick={() => {
                    setValue(String(preset.oz));
                    setError(null);
                  }}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                aria-describedby={error ? errorId : undefined}
                aria-invalid={error ? true : undefined}
                id={inputId}
                inputMode="numeric"
                onChange={(e) => {
                  setValue(e.target.value);
                  setError(null);
                }}
                placeholder="e.g. 128"
                size="lg"
                value={value}
              />
              <Button
                className="shrink-0"
                loading={pending}
                size="lg"
                type="submit"
              >
                Save goal
              </Button>
            </div>
            {error && <FieldError id={errorId}>{error}</FieldError>}
          </Field>
        </form>
      </AdaptiveDialogContent>
    </AdaptiveDialog>
  );
}
