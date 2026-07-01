"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveProfile } from "@/app/account/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cmToFtIn,
  EXPERIENCE_OPTIONS,
  type ExperienceLevel,
  ftInToCm,
  GOAL_OPTIONS,
  type PrimaryGoal,
  type Sex,
  SEX_OPTIONS,
  TRAINING_DAY_OPTIONS,
  unitSystemFor,
} from "@/lib/profile";
import { cn } from "@/lib/utils";

const segmentedButtonClass = (selected: boolean) =>
  cn(
    "rounded-lg border px-3 py-2.5 font-medium text-sm transition-colors",
    selected
      ? "border-blood/60 bg-blood/10 text-blood"
      : "border-border bg-background/40 text-muted-foreground hover:border-border hover:text-foreground"
  );

/** Segmented single-select over {value,label} options. Click a selected option
 * again to clear it, so a mis-set field can be emptied. */
function LabeledSegmented<T extends string | number>({
  options,
  value,
  onChange,
  columns,
}: {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  columns?: string;
}) {
  return (
    <div className={cn("grid gap-2", columns ?? "grid-cols-2")}>
      {options.map((opt) => (
        <button
          className={segmentedButtonClass(value === opt.value)}
          key={String(opt.value)}
          onClick={() => onChange(value === opt.value ? null : opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const DAY_OPTIONS = TRAINING_DAY_OPTIONS.map((d) => ({
  value: d,
  label: String(d),
}));

export function ProfileForm({
  initial,
  weightUnit,
}: {
  initial: {
    sex: Sex | null;
    age: number | null;
    heightCm: number | null;
    experienceLevel: ExperienceLevel | null;
    primaryGoal: PrimaryGoal | null;
    trainingDaysPerWeek: number | null;
  };
  weightUnit: "lb" | "kg" | null;
}) {
  const system = unitSystemFor(weightUnit);
  const initialFtIn =
    initial.heightCm != null ? cmToFtIn(initial.heightCm) : null;

  const [isPending, startTransition] = useTransition();
  const [sex, setSex] = useState<Sex | null>(initial.sex);
  const [age, setAge] = useState(initial.age != null ? String(initial.age) : "");
  const [heightFt, setHeightFt] = useState(
    initialFtIn ? String(initialFtIn.ft) : ""
  );
  const [heightIn, setHeightIn] = useState(
    initialFtIn ? String(initialFtIn.inches) : ""
  );
  const [heightCm, setHeightCm] = useState(
    system === "metric" && initial.heightCm != null
      ? String(initial.heightCm)
      : ""
  );
  const [experience, setExperience] = useState<ExperienceLevel | null>(
    initial.experienceLevel
  );
  const [goal, setGoal] = useState<PrimaryGoal | null>(initial.primaryGoal);
  const [trainingDays, setTrainingDays] = useState<number | null>(
    initial.trainingDaysPerWeek
  );

  function currentHeightCm(): number | null {
    if (system === "imperial") {
      return heightFt.trim()
        ? ftInToCm(Number(heightFt), Number(heightIn || "0"))
        : null;
    }
    return heightCm.trim() ? Math.round(Number(heightCm)) : null;
  }

  function handleSave() {
    startTransition(async () => {
      try {
        await saveProfile({
          sex,
          age: age.trim() ? Number(age) : null,
          heightCm: currentHeightCm(),
          experienceLevel: experience,
          primaryGoal: goal,
          trainingDaysPerWeek: trainingDays,
        });
        toast.success("Stats saved.");
      } catch {
        toast.error("Couldn't save that. Check your entries and try again.");
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="font-medium text-sm">Your stats</h3>
      <p className="mt-1 text-muted-foreground text-sm">
        Chad uses these as the truth about you. If he ever gets something wrong,
        fix it here.
      </p>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Sex</Label>
          <LabeledSegmented options={SEX_OPTIONS} onChange={setSex} value={sex} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-age">Age</Label>
          <Input
            id="profile-age"
            inputMode="numeric"
            onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="e.g. 30"
            value={age}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Height</Label>
          {system === "imperial" ? (
            <div className="grid grid-cols-2 gap-2">
              <Input
                aria-label="Height (feet)"
                inputMode="numeric"
                onChange={(e) =>
                  setHeightFt(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="Feet"
                value={heightFt}
              />
              <Input
                aria-label="Height (inches)"
                inputMode="numeric"
                onChange={(e) =>
                  setHeightIn(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="Inches"
                value={heightIn}
              />
            </div>
          ) : (
            <Input
              aria-label="Height (centimeters)"
              inputMode="numeric"
              onChange={(e) =>
                setHeightCm(e.target.value.replace(/[^0-9]/g, ""))
              }
              placeholder="Centimeters"
              value={heightCm}
            />
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Training experience</Label>
          <LabeledSegmented
            columns="grid-cols-3"
            options={EXPERIENCE_OPTIONS}
            onChange={setExperience}
            value={experience}
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label>Primary goal</Label>
          <LabeledSegmented
            columns="grid-cols-2 sm:grid-cols-4"
            options={GOAL_OPTIONS}
            onChange={setGoal}
            value={goal}
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label>Training days per week</Label>
          <LabeledSegmented
            columns="grid-cols-7"
            onChange={setTrainingDays}
            options={DAY_OPTIONS}
            value={trainingDays}
          />
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button disabled={isPending} onClick={handleSave} type="button">
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Save stats
        </Button>
      </div>
    </div>
  );
}
