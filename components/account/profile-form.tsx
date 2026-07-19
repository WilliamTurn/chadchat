"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveProfile } from "@/app/account/actions";
import { ActivityLevelField } from "@/components/profile/activity-level-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type ActivityLevel,
  cmToFtIn,
  EXPERIENCE_OPTIONS,
  type ExperienceLevel,
  ftInToCm,
  GOAL_OPTIONS,
  type PrimaryGoal,
  PROFILE_TEXT_MAX,
  type Sex,
  SEX_OPTIONS,
  TRAINING_DAY_OPTIONS,
  unitSystemFor,
} from "@/lib/profile";
import { cn } from "@/lib/utils";

// min-w-0 + wrapping: a label must NEVER spill past its button's border on a
// narrow phone (user report: "Intermediate" overflowing its box). Long labels
// wrap to a second line inside the button instead.
const segmentedButtonClass = (selected: boolean) =>
  cn(
    "min-w-0 whitespace-normal break-words rounded-lg border px-2 py-2.5 text-center font-medium text-sm transition-colors",
    selected
      ? "border-blood/60 bg-blood/10 text-blood"
      : "border-border bg-background/40 text-muted-foreground hover:border-border hover:text-foreground"
  );

/** Segmented multi-select (s157: goals are rarely singular — people pick two
 * or more). Click toggles membership; clearing every pick is allowed. */
function LabeledMultiSegmented<T extends string>({
  options,
  values,
  onChange,
  columns,
}: {
  options: readonly { value: T; label: string }[];
  values: T[];
  onChange: (v: T[]) => void;
  columns?: string;
}) {
  return (
    <div className={cn("grid gap-2", columns ?? "grid-cols-2")}>
      {options.map((opt) => (
        <button
          aria-pressed={values.includes(opt.value)}
          className={segmentedButtonClass(values.includes(opt.value))}
          key={String(opt.value)}
          onClick={() =>
            onChange(
              values.includes(opt.value)
                ? values.filter((v) => v !== opt.value)
                : [...values, opt.value]
            )
          }
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

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
    activityLevel: ActivityLevel | null;
    experienceLevel: ExperienceLevel | null;
    primaryGoal: PrimaryGoal | null;
    primaryGoals: PrimaryGoal[] | null;
    trainingDaysPerWeek: number | null;
    primaryGoalDetail: string | null;
    trainingDescription: string | null;
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
  const [activity, setActivity] = useState<ActivityLevel | null>(
    initial.activityLevel
  );
  const [experience, setExperience] = useState<ExperienceLevel | null>(
    initial.experienceLevel
  );
  // Multi-select (s157): the stored list when present, else the legacy
  // single pick lifted into a one-item list.
  const [goals, setGoals] = useState<PrimaryGoal[]>(
    initial.primaryGoals ?? (initial.primaryGoal ? [initial.primaryGoal] : [])
  );
  const [goalDetail, setGoalDetail] = useState(initial.primaryGoalDetail ?? "");
  const [trainingDays, setTrainingDays] = useState<number | null>(
    initial.trainingDaysPerWeek
  );
  const [trainingDescription, setTrainingDescription] = useState(
    initial.trainingDescription ?? ""
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
          activityLevel: activity,
          experienceLevel: experience,
          // The first pick mirrors into the legacy single-goal column so
          // every older reader keeps working.
          primaryGoal: goals[0] ?? null,
          primaryGoals: goals,
          trainingDaysPerWeek: trainingDays,
          // The schema turns an empty string into null, so clearing the box
          // deletes the note.
          primaryGoalDetail: goalDetail,
          trainingDescription,
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

        {/* Container query, not a viewport breakpoint: this cell is half the
            card, and the card's width now varies with the LAY-1 page column.
            Below ~21rem the three labels can't fit on one row, so stack. */}
        <div className="@container flex flex-col gap-2">
          <Label>Training experience</Label>
          <LabeledSegmented
            columns="grid-cols-1 @[21rem]:grid-cols-3"
            options={EXPERIENCE_OPTIONS}
            onChange={setExperience}
            value={experience}
          />
        </div>

        {/* Everyday activity (calories-burned Phase 2, D6): full-width like
            the goals block because each option carries a description. Feeds
            the recommended calorie target in the target editor. */}
        <div className="sm:col-span-2">
          <ActivityLevelField
            clearable
            onChange={setActivity}
            value={activity}
          />
        </div>

        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label>Training goals</Label>
          <p className="text-muted-foreground text-xs">
            Pick everything you&apos;re training for. Most people want more
            than one. The Goals on your dashboard are the measurable targets
            that serve them.
          </p>
          <LabeledMultiSegmented
            columns="grid-cols-2 sm:grid-cols-4"
            options={GOAL_OPTIONS}
            onChange={setGoals}
            values={goals}
          />
          {/* ONB-3: the member's own words about their goals. Chad reads
              every word of this, verbatim. "Other" up front (owner, s157):
              this box is for everything the buttons don't cover. */}
          <Label className="mt-2" htmlFor="profile-goal-detail">
            Other goals: tell us more{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <Textarea
            id="profile-goal-detail"
            maxLength={PROFILE_TEXT_MAX}
            onChange={(e) => setGoalDetail(e.target.value)}
            placeholder="The event, the deadline, the number you want to hit, the reason behind it. Chad reads every word."
            value={goalDetail}
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

        {/* ONB-4: how they train, in their own words, so Chad plans around
            what they actually do. */}
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="profile-training-description">
            About your training{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <p className="text-muted-foreground text-xs">
            Describe your training in your own words: lifting, cardio, HIIT,
            sports, classes, or nothing yet. Chad plans around it.
          </p>
          <Textarea
            id="profile-training-description"
            maxLength={PROFILE_TEXT_MAX}
            onChange={(e) => setTrainingDescription(e.target.value)}
            placeholder="e.g. Push/pull/legs in a commercial gym, plus basketball on Saturdays."
            value={trainingDescription}
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
