"use client";

// The workout builder/editor. A workout (template) is a PLAN, building one
// never touches history. Full page with a sticky save bar in the thumb zone.
// Adding exercises navigates to the dedicated full-page picker; the draft
// lives in the store (localStorage) so the round trip can never lose work.

import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  Minus,
  Plus,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { saveTemplate } from "@/app/workouts/actions";
import type { TemplateExercise } from "@/lib/validation/workout-templates";
import { equipmentLabel, muscleLabel } from "./catalog";
import { ConfirmDialog } from "./confirm";
import { useWorkouts } from "./store";
import type { BuilderDraft, DraftExercise } from "./types";
import { REST_OPTIONS } from "./types";
import { Eyebrow, WButton, WCard } from "./ui";

function draftBaseline(name: string, exercises: DraftExercise[]): string {
  return JSON.stringify({ name, exercises });
}

/** Build the store draft for a fresh or existing template. */
export function makeDraft(
  templateId: string | null,
  name: string,
  exercises: DraftExercise[]
): BuilderDraft {
  return {
    templateId,
    name,
    exercises,
    baseline: draftBaseline(name, exercises),
  };
}

function toTemplateExercise(d: DraftExercise): TemplateExercise {
  return {
    name: d.name,
    muscleGroup: d.muscleGroup,
    kind: d.kind,
    equipment: d.equipment,
    targetSets: d.targetSets,
    repRangeMin: d.repRangeMin,
    repRangeMax: d.repRangeMax,
    restSeconds: d.restSeconds,
    note: d.note,
  };
}

function RepRangeInput({
  rex,
  onChange,
}: {
  rex: DraftExercise;
  onChange: (patch: Partial<DraftExercise>) => void;
}) {
  const inputClass =
    "h-[48px] w-[64px] rounded-xl border border-input bg-background text-center font-mono text-[17px] font-semibold tabular-nums text-foreground focus:border-blood/60 focus:outline-none";
  const timed = rex.kind === "timed";
  return (
    <div>
      <div className="mb-1.5 font-semibold text-[12px] text-muted-foreground uppercase tracking-wide">
        {timed ? "Seconds target per set" : "Rep target per set"}
      </div>
      <div className="flex items-center gap-2">
        <input
          aria-label={timed ? "Lowest seconds to aim for" : "Lowest reps to aim for"}
          className={inputClass}
          inputMode="numeric"
          max={99}
          min={1}
          onBlur={() => {
            const min = Math.max(1, Math.min(rex.repRangeMin || 1, 99));
            const max = Math.max(min, Math.min(rex.repRangeMax || min, 99));
            onChange({ repRangeMin: min, repRangeMax: max });
          }}
          onChange={(e) => onChange({ repRangeMin: Number(e.target.value) || 0 })}
          type="number"
          value={rex.repRangeMin || ""}
        />
        <span className="text-[14px] text-muted-foreground">to</span>
        <input
          aria-label={timed ? "Highest seconds to aim for" : "Highest reps to aim for"}
          className={inputClass}
          inputMode="numeric"
          max={99}
          min={1}
          onBlur={() => {
            const max = Math.max(1, Math.min(rex.repRangeMax || 1, 99));
            const min = Math.min(rex.repRangeMin || 1, max);
            onChange({ repRangeMin: Math.max(min, 1), repRangeMax: max });
          }}
          onChange={(e) => onChange({ repRangeMax: Number(e.target.value) || 0 })}
          type="number"
          value={rex.repRangeMax || ""}
        />
        <span className="text-[14px] text-muted-foreground">
          {timed ? "seconds" : "reps"}
        </span>
      </div>
    </div>
  );
}

function ExerciseRow({
  rex,
  index,
  count,
  onChange,
  onRemove,
  onMove,
}: {
  rex: DraftExercise;
  index: number;
  count: number;
  onChange: (patch: Partial<DraftExercise>) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <WCard className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold font-mono text-[13px] text-muted-foreground/80">
              {index + 1}
            </span>
            <h3 className="truncate font-bold text-[16px] text-foreground">
              {rex.name}
            </h3>
          </div>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {[muscleLabel(rex.muscleGroup), equipmentLabel(rex.equipment)]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            aria-label={`Move ${rex.name} up`}
            className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/60 hover:text-foreground disabled:opacity-25"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            type="button"
          >
            <ArrowUp aria-hidden className="size-[18px]" />
          </button>
          <button
            aria-label={`Move ${rex.name} down`}
            className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/60 hover:text-foreground disabled:opacity-25"
            disabled={index === count - 1}
            onClick={() => onMove(1)}
            type="button"
          >
            <ArrowDown aria-hidden className="size-[18px]" />
          </button>
          <button
            aria-label={`Remove ${rex.name} from this workout`}
            className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition hover:bg-blood/10 hover:text-blood"
            onClick={onRemove}
            type="button"
          >
            <Trash2 aria-hidden className="size-[18px]" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-4">
        {/* Sets stepper */}
        <div>
          <div className="mb-1.5 font-semibold text-[12px] text-muted-foreground uppercase tracking-wide">
            Working sets
          </div>
          <div className="flex items-center gap-1">
            <button
              aria-label="One set fewer"
              className="flex size-[48px] cursor-pointer items-center justify-center rounded-xl border border-input bg-background text-foreground transition hover:bg-muted/60 disabled:opacity-25"
              disabled={rex.targetSets <= 1}
              onClick={() =>
                onChange({ targetSets: Math.max(1, rex.targetSets - 1) })
              }
              type="button"
            >
              <Minus aria-hidden className="size-4" />
            </button>
            <div className="w-[52px] text-center font-bold font-mono text-[20px] text-foreground tabular-nums">
              {rex.targetSets}
            </div>
            <button
              aria-label="One set more"
              className="flex size-[48px] cursor-pointer items-center justify-center rounded-xl border border-input bg-background text-foreground transition hover:bg-muted/60 disabled:opacity-25"
              disabled={rex.targetSets >= 10}
              onClick={() =>
                onChange({ targetSets: Math.min(10, rex.targetSets + 1) })
              }
              type="button"
            >
              <Plus aria-hidden className="size-4" />
            </button>
          </div>
        </div>

        <RepRangeInput onChange={onChange} rex={rex} />

        {/* Rest picker */}
        <div>
          <div className="mb-1.5 font-semibold text-[12px] text-muted-foreground uppercase tracking-wide">
            Rest between sets
          </div>
          <select
            aria-label={`Rest between sets of ${rex.name}`}
            className="h-[48px] cursor-pointer rounded-xl border border-input bg-background px-3 font-semibold text-[15px] text-foreground focus:border-blood/60 focus:outline-none"
            onChange={(e) => onChange({ restSeconds: Number(e.target.value) })}
            value={rex.restSeconds}
          >
            {REST_OPTIONS.map((o) => (
              <option key={o.seconds} value={o.seconds}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </WCard>
  );
}

export function WorkoutEditor({
  templateId,
  initialName,
  initialExercises,
}: {
  /** Null when creating a new workout; the template id when editing. */
  templateId: string | null;
  initialName: string;
  initialExercises: DraftExercise[];
}) {
  const router = useRouter();
  const {
    ready,
    draft,
    initDraft,
    setDraftName,
    patchDraftExercise,
    removeDraftExercise,
    moveDraftExercise,
    clearDraft,
  } = useWorkouts();
  const [confirmingLeave, setConfirmingLeave] = useState(false);
  const [saving, setSaving] = useState(false);

  // Adopt (or start) the draft for THIS template. A persisted draft for the
  // same template survives the picker round trip; a draft for a different
  // template is stale and gets replaced.
  useEffect(() => {
    if (!ready) {
      return;
    }
    if (!draft || draft.templateId !== templateId) {
      initDraft(makeDraft(templateId, initialName, initialExercises));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, templateId]);

  const name = draft?.name ?? initialName;
  const exercises = draft?.exercises ?? initialExercises;

  const dirty = useMemo(
    () => (draft ? draftBaseline(draft.name, draft.exercises) !== draft.baseline : false),
    [draft]
  );

  const canSave = name.trim().length > 0 && exercises.length > 0;
  const saveHint =
    name.trim().length === 0
      ? "Give your workout a name to save it"
      : exercises.length === 0
        ? "Add at least one exercise to save"
        : null;

  function handleBack() {
    if (dirty) {
      setConfirmingLeave(true);
    } else {
      clearDraft();
      router.push("/workouts");
    }
  }

  async function handleSave() {
    if (!canSave || saving) {
      return;
    }
    setSaving(true);
    const result = await saveTemplate({
      id: templateId ?? undefined,
      name: name.trim(),
      exercises: exercises.map(toTemplateExercise),
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error ?? "Couldn't save that workout.");
      return;
    }
    clearDraft();
    toast.success(templateId ? "Workout updated." : "Workout saved.");
    router.push("/workouts");
    router.refresh();
  }

  if (!ready || !draft) {
    return (
      <div className="py-24 text-center text-muted-foreground" role="status">
        Loading…
      </div>
    );
  }

  return (
    <div className="pb-40">
      {/* Header */}
      <header className="mb-5">
        <button
          className="-ml-1.5 mb-2 inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-lg px-1.5 font-semibold text-[14px] text-muted-foreground transition hover:text-foreground"
          onClick={handleBack}
          type="button"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Back to Workouts
        </button>
        <h1 className="font-black font-display text-[30px] text-foreground uppercase leading-none tracking-tight">
          {templateId ? "Edit Workout" : "New Workout"}
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] text-muted-foreground leading-relaxed">
          Add your new workouts here. Once you add a new workout, you can start
          performing it, and then you can log it where it says
          &ldquo;Exercises in the order you&apos;ll do them&rdquo;.
        </p>
      </header>

      {/* Name */}
      <label className="block">
        <Eyebrow className="mb-1.5">Workout name</Eyebrow>
        <input
          className="h-[56px] w-full rounded-xl border border-input bg-card px-4 font-semibold text-[17px] text-foreground placeholder:text-muted-foreground/60 focus:border-blood/60 focus:outline-none"
          maxLength={60}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder="e.g. Push Day"
          type="text"
          value={name}
        />
      </label>

      {/* Exercises */}
      <div className="mt-6">
        <Eyebrow className="mb-1.5">
          Exercises · in the order you&apos;ll do them
        </Eyebrow>
        <p className="mb-3 max-w-2xl text-[13.5px] text-muted-foreground leading-relaxed">
          Each workout is made up of one or more exercises. Add your exercises
          here in the order that you&apos;ll do them. (You can change the order
          or edit your exercises any time once you create them.)
        </p>
        {exercises.length === 0 ? (
          <WCard className="p-8 text-center">
            <p className="font-bold text-[15.5px] text-foreground">
              No exercises yet
            </p>
            <p className="mx-auto mt-1 max-w-[300px] text-[13.5px] text-muted-foreground">
              Add the exercises for this workout. You can reorder them any
              time.
            </p>
          </WCard>
        ) : (
          <div className="flex flex-col gap-3">
            {exercises.map((rex, i) => (
              <ExerciseRow
                count={exercises.length}
                index={i}
                key={rex.id}
                onChange={(patch) => patchDraftExercise(rex.id, patch)}
                onMove={(d) => moveDraftExercise(rex.id, d)}
                onRemove={() => removeDraftExercise(rex.id)}
                rex={rex}
              />
            ))}
          </div>
        )}

        <WButton
          className="mt-3 w-full"
          onClick={() => router.push("/workouts/exercises/pick?target=draft")}
          size="lg"
        >
          <Plus aria-hidden className="size-5" />
          Add exercises
        </WButton>
      </div>

      {/* Sticky save bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-border border-t bg-background/95 px-4 py-3 backdrop-blur-xl"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto w-full max-w-[560px]">
          {saveHint && (
            <p className="mb-2 text-center text-[12.5px] text-muted-foreground">
              {saveHint}
            </p>
          )}
          <WButton
            className="w-full"
            disabled={!canSave}
            loading={saving}
            onClick={handleSave}
            size="lg"
            variant="primary"
          >
            Save workout
          </WButton>
        </div>
      </div>

      <ConfirmDialog
        body={
          templateId
            ? "You have unsaved edits to this workout."
            : "This workout hasn't been saved yet."
        }
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        destructive
        onCancel={() => setConfirmingLeave(false)}
        onConfirm={() => {
          clearDraft();
          setConfirmingLeave(false);
          router.push("/workouts");
        }}
        open={confirmingLeave}
        title="Discard your changes?"
      />
    </div>
  );
}
