"use client";

import { SegmentedPicker } from "@/components/meal-plan/segmented-picker";
import { Label } from "@/components/ui/label";
import { ACTIVITY_OPTIONS, type ActivityLevel } from "@/lib/profile";

/**
 * The everyday-activity question (calories-burned Phase 2, D6), shared by the
 * onboarding wizard, the account profile, and the target editor so all three
 * ask it with identical options and microcopy. The TDEE multiplier this feeds
 * EXCLUDES intentional exercise (MFP semantics), so the "don't count workouts"
 * line is part of the field itself, not per-surface copy.
 */
export function ActivityLevelField({
  value,
  onChange,
  clearable = false,
}: {
  value: ActivityLevel | null;
  onChange: (v: ActivityLevel | null) => void;
  /** Account-form behavior: tapping the selected option clears it. */
  clearable?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label>Everyday activity</Label>
      <p className="text-muted-foreground text-xs">
        How you spend a normal day. Don&apos;t count workouts here; you log
        those separately.
      </p>
      <SegmentedPicker
        ariaLabel="Everyday activity"
        className="grid-cols-1"
        onChange={(v) => onChange(clearable && v === value ? null : v)}
        options={ACTIVITY_OPTIONS.map((o) => ({
          value: o.value,
          label: o.label,
          description: o.description,
        }))}
        value={value as ActivityLevel}
      />
    </div>
  );
}
