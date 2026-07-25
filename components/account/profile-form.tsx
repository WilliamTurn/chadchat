"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
      ? // DSH-61: blood is fill-only in dark; readable red text takes the AA
        // token (axe color-contrast pin, /account).
        "border-blood/60 bg-blood/10 text-blood-text"
      : "border-border bg-background/40 text-muted-foreground hover:border-border hover:text-foreground"
  );

/** Segmented multi-select (s157: goals are rarely singular: people pick two
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

/** The eyebrow header naming a group of fields (comp-canon 05 #52, 01 #24:
 *  nine fields is enough to need names; headers over whitespace, not boxes). */
function GroupHeader({ children }: { children: string }) {
  return (
    <h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
      {children}
    </h2>
  );
}

type FormState = {
  sex: Sex | null;
  age: string;
  heightFt: string;
  heightIn: string;
  heightCm: string;
  activity: ActivityLevel | null;
  experience: ExperienceLevel | null;
  goals: PrimaryGoal[];
  goalDetail: string;
  trainingDays: number | null;
  trainingDescription: string;
};

/**
 * The stats form on /account/profile. Explicit Save (ux-canon 01 #81:
 * document-like identity record), single column at every width (comp-canon
 * 05 #55), Save anchored to the form's LEFT content edge (comp-canon 03 #40).
 * The unsaved-changes guard is DRAFT PERSISTENCE (ux-canon 03 #83: drafts
 * survive navigation, refresh, and crash): edits mirror to localStorage and
 * restore on return, so back never loses work (ux-canon 02 #44) without a
 * navigation intercept.
 */
export function ProfileForm({
  draftId,
  initial,
  weightUnit,
}: {
  /** Scopes the local draft to this member (shared browsers). */
  draftId: string;
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
  const draftKey = `chad-stats-draft-${draftId}`;

  const initialState = useMemo<FormState>(() => {
    const initialFtIn =
      initial.heightCm != null ? cmToFtIn(initial.heightCm) : null;
    return {
      sex: initial.sex,
      age: initial.age != null ? String(initial.age) : "",
      heightFt: initialFtIn ? String(initialFtIn.ft) : "",
      heightIn: initialFtIn ? String(initialFtIn.inches) : "",
      heightCm:
        system === "metric" && initial.heightCm != null
          ? String(initial.heightCm)
          : "",
      activity: initial.activityLevel,
      experience: initial.experienceLevel,
      // Multi-select (s157): the stored list when present, else the legacy
      // single pick lifted into a one-item list.
      goals:
        initial.primaryGoals ??
        (initial.primaryGoal ? [initial.primaryGoal] : []),
      goalDetail: initial.primaryGoalDetail ?? "",
      trainingDays: initial.trainingDaysPerWeek,
      trainingDescription: initial.trainingDescription ?? "",
    };
  }, [initial, system]);

  const [form, setForm] = useState<FormState>(initialState);
  // What the server currently holds; updated after each successful save so
  // dirtiness always compares against the latest saved truth.
  const [baseline, setBaseline] = useState<FormState>(initialState);
  const [isPending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">(
    "idle"
  );
  const restored = useRef(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(baseline);

  function patch(next: Partial<FormState>) {
    setForm((f) => ({ ...f, ...next }));
    setSaveState("idle");
  }

  // Restore an unfinished draft on mount (ux-canon 03 #83). Server values
  // stay the baseline; the draft becomes the visible, dirty state.
  useEffect(() => {
    if (restored.current) {
      return;
    }
    restored.current = true;
    try {
      const raw = localStorage.getItem(draftKey);
      if (raw) {
        const draft = JSON.parse(raw) as FormState;
        if (JSON.stringify(draft) !== JSON.stringify(initialState)) {
          setForm({ ...initialState, ...draft });
        } else {
          localStorage.removeItem(draftKey);
        }
      }
    } catch {
      // A malformed draft is discarded; the server values stand.
    }
  }, [draftKey, initialState]);

  // Mirror edits to the draft; clear it once the form matches the baseline.
  useEffect(() => {
    if (!restored.current) {
      return;
    }
    try {
      if (dirty) {
        localStorage.setItem(draftKey, JSON.stringify(form));
      } else {
        localStorage.removeItem(draftKey);
      }
    } catch {
      // Storage full/blocked: the in-memory state still works.
    }
  }, [form, dirty, draftKey]);

  function currentHeightCm(): number | null {
    if (system === "imperial") {
      return form.heightFt.trim()
        ? ftInToCm(Number(form.heightFt), Number(form.heightIn || "0"))
        : null;
    }
    return form.heightCm.trim() ? Math.round(Number(form.heightCm)) : null;
  }

  function handleSave() {
    const snapshot = form;
    startTransition(async () => {
      try {
        await saveProfile({
          sex: snapshot.sex,
          age: snapshot.age.trim() ? Number(snapshot.age) : null,
          heightCm: currentHeightCm(),
          activityLevel: snapshot.activity,
          experienceLevel: snapshot.experience,
          // The first pick mirrors into the legacy single-goal column so
          // every older reader keeps working.
          primaryGoal: snapshot.goals[0] ?? null,
          primaryGoals: snapshot.goals,
          trainingDaysPerWeek: snapshot.trainingDays,
          // The schema turns an empty string into null, so clearing the box
          // deletes the note.
          primaryGoalDetail: snapshot.goalDetail,
          trainingDescription: snapshot.trainingDescription,
        });
        setBaseline(snapshot);
        setSaveState("saved");
        try {
          localStorage.removeItem(draftKey);
        } catch {
          // Ignore storage failures; the save itself succeeded.
        }
      } catch {
        setSaveState("error");
      }
    });
  }

  return (
    // One column at every width, capped to the readable form band and
    // left-anchored (comp-canon 05 #55, 03 #38).
    <div className="flex max-w-xl flex-col gap-14">
      <section>
        <GroupHeader>About you</GroupHeader>
        <div className="mt-3 flex flex-col gap-5">

        <div className="flex flex-col gap-2">
          <Label>Sex</Label>
          <LabeledSegmented
            onChange={(sex) => patch({ sex })}
            options={SEX_OPTIONS}
            value={form.sex}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-age">Age</Label>
          {/* Known-length answer, content-sized box (comp-canon 03 #10). */}
          <Input
            className="w-24"
            id="profile-age"
            inputMode="numeric"
            onChange={(e) =>
              patch({ age: e.target.value.replace(/[^0-9]/g, "") })
            }
            placeholder="e.g. 30"
            value={form.age}
          />
        </div>

        {/* Height: one mental quantity split across boxes: a labeled group
            with VISIBLE per-part labels, content-sized boxes that never
            restack (comp-canon 03 #16-18, #23-24; GOV.UK date geometry).
            Placeholders show format examples, never labels (03 #4). */}
        <fieldset className="flex flex-col gap-2">
          <Label asChild>
            <legend>Height</legend>
          </Label>
          {system === "imperial" ? (
            <div className="flex gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Feet</span>
                <Input
                  aria-label="Height (feet)"
                  className="w-24"
                  inputMode="numeric"
                  onChange={(e) =>
                    patch({ heightFt: e.target.value.replace(/[^0-9]/g, "") })
                  }
                  value={form.heightFt}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-muted-foreground text-xs">Inches</span>
                <Input
                  aria-label="Height (inches)"
                  className="w-24"
                  inputMode="numeric"
                  onChange={(e) =>
                    patch({ heightIn: e.target.value.replace(/[^0-9]/g, "") })
                  }
                  value={form.heightIn}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">
                Centimeters
              </span>
              <Input
                aria-label="Height (centimeters)"
                className="w-28"
                inputMode="numeric"
                onChange={(e) =>
                  patch({ heightCm: e.target.value.replace(/[^0-9]/g, "") })
                }
                value={form.heightCm}
              />
            </div>
          )}
        </fieldset>
        </div>
      </section>

      <section>
        <GroupHeader>Your training</GroupHeader>
        <div className="mt-3 flex flex-col gap-5">

        <div className="@container flex flex-col gap-2">
          <Label>Training experience</Label>
          <LabeledSegmented
            columns="grid-cols-1 @[19rem]:grid-cols-3"
            onChange={(experience) => patch({ experience })}
            options={EXPERIENCE_OPTIONS}
            value={form.experience}
          />
        </div>

        {/* Everyday activity (calories-burned Phase 2, D6): each option
            carries a description. Feeds the recommended calorie target in
            the target editor. */}
        <ActivityLevelField
          clearable
          onChange={(activity) => patch({ activity })}
          value={form.activity}
        />

        <div className="flex flex-col gap-2">
          <Label>Training days per week</Label>
          <LabeledSegmented
            columns="grid-cols-7"
            onChange={(trainingDays) => patch({ trainingDays })}
            options={DAY_OPTIONS}
            value={form.trainingDays}
          />
        </div>
        </div>
      </section>

      <section>
        <GroupHeader>Your goals</GroupHeader>
        <div className="mt-3 flex flex-col gap-5">

        <div className="flex flex-col gap-2">
          <Label>Training goals</Label>
          <p className="text-muted-foreground text-xs">
            Pick everything you&apos;re training for. Most people want more
            than one. The Goals on Home are the measurable targets that serve
            them.
          </p>
          <LabeledMultiSegmented
            columns="grid-cols-2 sm:grid-cols-4"
            onChange={(goals) => patch({ goals })}
            options={GOAL_OPTIONS}
            values={form.goals}
          />
        </div>

        {/* ONB-3: the member's own words about their goals. Chad reads every
            word of this, verbatim. */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="profile-goal-detail">
            Other goals{" "}
            <span className="font-normal text-muted-foreground">
              (optional)
            </span>
          </Label>
          <p className="text-muted-foreground text-xs">
            Anything the buttons above don&apos;t cover. Chad reads every
            word.
          </p>
          <Textarea
            id="profile-goal-detail"
            maxLength={PROFILE_TEXT_MAX}
            onChange={(e) => patch({ goalDetail: e.target.value })}
            value={form.goalDetail}
          />
        </div>

        {/* ONB-4: how they train, in their own words, so Chad plans around
            what they actually do. */}
        <div className="flex flex-col gap-2">
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
            onChange={(e) => patch({ trainingDescription: e.target.value })}
            placeholder="e.g. Push/pull/legs at home, plus basketball on Saturdays."
            value={form.trainingDescription}
          />
        </div>
        </div>
      </section>

      {/* Save anchors to the form's LEFT content edge, in-flow after
          everything it commits (comp-canon 03 #40, 08 #8). Neutral when
          clean, primary when dirty (ux-canon 01 #82); the icon slot is
          reserved so the button never changes width mid-press (ux-canon 03
          #24). The status slot reserves its line so nothing jumps (owner
          ruling 2026-07-23). */}
      <div className="flex flex-col gap-2">
        <div>
          <Button
            className="w-full gap-2 sm:w-auto"
            disabled={isPending}
            onClick={handleSave}
            type="button"
            variant={dirty ? "default" : "secondary"}
          >
            <span aria-hidden className="flex size-4 items-center justify-center">
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {!isPending && saveState === "saved" && !dirty ? (
                <Check className="size-4" />
              ) : null}
            </span>
            {isPending ? "Saving..." : "Save stats"}
          </Button>
        </div>
        <p aria-live="polite" className="min-h-5 text-sm" role="status">
          {saveState === "error" ? (
            <span className="text-destructive">
              Your stats didn&apos;t save. Your entries are still here. Try
              again.
            </span>
          ) : dirty && !isPending ? (
            <span className="text-muted-foreground">Unsaved changes</span>
          ) : saveState === "saved" && !dirty ? (
            <span className="text-muted-foreground">Saved</span>
          ) : null}
        </p>
      </div>
    </div>
  );
}
