"use client";

import { ArrowLeft, ArrowRight, Dumbbell, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { finishOnboarding } from "@/app/welcome/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EXPERIENCE_OPTIONS,
  type ExperienceLevel,
  experienceLabel,
  ftInToCm,
  GOAL_OPTIONS,
  goalLabel,
  type PrimaryGoal,
  type Sex,
  SEX_OPTIONS,
  sexLabel,
  TRAINING_DAY_OPTIONS,
} from "@/lib/profile";
import { cn } from "@/lib/utils";

type UnitSystem = "imperial" | "metric";

const STEP_COUNT = 3;

const segmentedButtonClass = (selected: boolean) =>
  cn(
    "rounded-lg border px-3 py-2.5 font-medium text-sm transition-colors",
    selected
      ? "border-blood/60 bg-blood/10 text-blood"
      : "border-border bg-background/40 text-muted-foreground hover:border-border hover:text-foreground"
  );

/** A compact segmented single-select over raw values, matching the /account
 * unit picker (used for the units toggle + training days). */
function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  columns,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: string;
}) {
  return (
    <div className={cn("grid gap-2", columns ?? "grid-cols-2")}>
      {options.map((opt) => (
        <button
          className={segmentedButtonClass(value === opt)}
          key={String(opt)}
          onClick={() => onChange(opt)}
          type="button"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/** Segmented single-select over {value,label} options — stores the canonical
 * value while showing the human label (sex / experience / goal). */
function LabeledSegmented<T extends string>({
  options,
  value,
  onChange,
  columns,
}: {
  options: readonly { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: string;
}) {
  return (
    <div className={cn("grid gap-2", columns ?? "grid-cols-2")}>
      {options.map((opt) => (
        <button
          className={segmentedButtonClass(value === opt.value)}
          key={opt.value}
          onClick={() => onChange(opt.value)}
          type="button"
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * First-run onboarding wizard (ONB-1). A short, familiar three-step form for a
 * member's stats. On finish it hands everything to Chad as the opening chat
 * message (auto-submitted via the `?query=` param the chat already honors), so
 * Chad starts already knowing them instead of interrogating them. "Skip" hands
 * the whole thing to Chad conversationally instead. Both paths mark the user
 * onboarded so this never shows twice.
 */
export function OnboardingWizard({
  initialName,
  initialWeightUnit,
}: {
  initialName: string;
  initialWeightUnit: "lb" | "kg" | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);

  const [name, setName] = useState(initialName);
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<Sex | null>(null);

  const [units, setUnits] = useState<UnitSystem>(
    initialWeightUnit === "kg" ? "metric" : "imperial"
  );
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weight, setWeight] = useState("");

  const [experience, setExperience] = useState<ExperienceLevel | null>(null);
  const [goal, setGoal] = useState<PrimaryGoal | null>(null);
  const [trainingDays, setTrainingDays] = useState<number | null>(null);

  const weightUnit: "lb" | "kg" = units === "metric" ? "kg" : "lb";

  /** Height in canonical whole centimeters from whichever inputs are filled. */
  const heightCmValue: number | null =
    units === "imperial"
      ? heightFt.trim()
        ? ftInToCm(Number(heightFt), Number(heightIn || "0"))
        : null
      : heightCm.trim()
        ? Math.round(Number(heightCm))
        : null;

  /** Build the natural-language first message Chad receives (filled fields only). */
  const firstMessage = useMemo(() => {
    const height =
      units === "imperial"
        ? heightFt.trim()
          ? `${heightFt.trim()}'${(heightIn.trim() || "0").trim()}"`
          : ""
        : heightCm.trim()
          ? `${heightCm.trim()} cm`
          : "";
    const weightLine = weight.trim() ? `${weight.trim()} ${weightUnit}` : "";

    const lines: string[] = [];
    if (name.trim()) {
      lines.push(`- Name: ${name.trim()}`);
    }
    if (age.trim()) {
      lines.push(`- Age: ${age.trim()}`);
    }
    if (sex) {
      lines.push(`- Sex: ${sexLabel(sex)}`);
    }
    if (height) {
      lines.push(`- Height: ${height}`);
    }
    if (weightLine) {
      lines.push(`- Current weight: ${weightLine}`);
    }
    if (experience) {
      lines.push(`- Training experience: ${experienceLabel(experience)}`);
    }
    if (goal) {
      lines.push(`- Primary goal: ${goalLabel(goal)}`);
    }
    if (trainingDays) {
      lines.push(`- Training days per week: ${trainingDays}`);
    }

    if (lines.length === 0) {
      return "";
    }

    return `Here are my stats to get started:\n\n${lines.join("\n")}\n\nLet's get to work.`;
  }, [
    name,
    age,
    sex,
    units,
    heightFt,
    heightIn,
    heightCm,
    weight,
    weightUnit,
    experience,
    goal,
    trainingDays,
  ]);

  function handleStart() {
    startTransition(async () => {
      try {
        await finishOnboarding({
          weightUnit,
          // Persist the structured stats so they're the trusted source of truth
          // from message one and editable later on /account (ONB-2).
          profile: {
            sex,
            age: age.trim() ? Number(age) : null,
            heightCm: heightCmValue,
            experienceLevel: experience,
            primaryGoal: goal,
            trainingDaysPerWeek: trainingDays,
          },
        });
      } catch {
        toast.error("Couldn't save that. Try again.");
        return;
      }
      // Hand the stats to Chad as an auto-submitted opening message. If somehow
      // nothing was filled, just open a fresh chat.
      if (firstMessage) {
        router.push(`/?query=${encodeURIComponent(firstMessage)}`);
      } else {
        router.push("/");
      }
    });
  }

  function handleSkip() {
    startTransition(async () => {
      try {
        await finishOnboarding();
      } catch {
        // Don't trap them on the form over a bookkeeping write — let them into
        // the chat regardless; Chad will still onboard them.
      }
      router.push("/");
    });
  }

  const isLast = step === STEP_COUNT - 1;

  return (
    <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-float)] sm:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-muted/60">
          <Dumbbell className="size-5" />
        </div>
        <div>
          <h1 className="font-display font-bold text-xl tracking-tight">
            Let&apos;s get you set up
          </h1>
          <p className="text-muted-foreground text-sm">
            Give Chad your numbers so he can get to work.
          </p>
        </div>
      </div>

      {/* Progress dots */}
      <div className="mb-6 flex gap-1.5" aria-hidden>
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <div
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static bar
              i <= step ? "bg-blood" : "bg-border"
            )}
            key={i}
          />
        ))}
      </div>

      <div className="flex flex-col gap-5">
        {step === 0 && (
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="onb-name">What should Chad call you?</Label>
              <Input
                autoComplete="given-name"
                id="onb-name"
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                value={name}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="onb-age">Age</Label>
              <Input
                id="onb-age"
                inputMode="numeric"
                onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="e.g. 30"
                value={age}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Sex</Label>
              <LabeledSegmented
                options={SEX_OPTIONS}
                onChange={setSex}
                value={sex}
              />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="flex flex-col gap-2">
              <Label>Units</Label>
              <Segmented
                options={["imperial", "metric"] as const}
                onChange={(u) => setUnits(u)}
                value={units}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Height</Label>
              {units === "imperial" ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <Input
                      inputMode="numeric"
                      onChange={(e) =>
                        setHeightFt(e.target.value.replace(/[^0-9]/g, ""))
                      }
                      placeholder="Feet"
                      value={heightFt}
                    />
                  </div>
                  <div className="relative">
                    <Input
                      inputMode="numeric"
                      onChange={(e) =>
                        setHeightIn(e.target.value.replace(/[^0-9]/g, ""))
                      }
                      placeholder="Inches"
                      value={heightIn}
                    />
                  </div>
                </div>
              ) : (
                <Input
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
              <Label htmlFor="onb-weight">
                Current weight ({weightUnit})
              </Label>
              <Input
                id="onb-weight"
                inputMode="decimal"
                onChange={(e) =>
                  setWeight(e.target.value.replace(/[^0-9.]/g, ""))
                }
                placeholder={units === "metric" ? "e.g. 82" : "e.g. 180"}
                value={weight}
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex flex-col gap-2">
              <Label>Training experience</Label>
              <LabeledSegmented
                columns="grid-cols-3"
                options={EXPERIENCE_OPTIONS}
                onChange={setExperience}
                value={experience}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Primary goal</Label>
              <LabeledSegmented
                options={GOAL_OPTIONS}
                onChange={setGoal}
                value={goal}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Training days per week</Label>
              <Segmented
                columns="grid-cols-7"
                options={TRAINING_DAY_OPTIONS}
                onChange={setTrainingDays}
                value={trainingDays}
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        {step > 0 ? (
          <Button
            disabled={isPending}
            onClick={() => setStep((s) => s - 1)}
            type="button"
            variant="ghost"
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
        ) : (
          <span />
        )}

        {isLast ? (
          <Button disabled={isPending} onClick={handleStart} type="button">
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Dumbbell className="size-4" />
            )}
            Start with Chad
          </Button>
        ) : (
          <Button
            disabled={isPending}
            onClick={() => setStep((s) => s + 1)}
            type="button"
          >
            Next
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>

      <button
        className="mt-5 w-full text-center text-muted-foreground text-xs transition-colors hover:text-foreground disabled:opacity-50"
        disabled={isPending}
        onClick={handleSkip}
        type="button"
      >
        Skip — I&apos;ll tell Chad myself
      </button>
    </div>
  );
}
