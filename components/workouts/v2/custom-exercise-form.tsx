"use client";

// Full-page form for creating or editing one of the member's own exercises.
// Every field explains itself; nothing is auto-focused.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  addCustomExercise,
  editCustomExercise,
  removeCustomExercise,
} from "@/app/workouts/actions";
import {
  EQUIPMENT,
  EQUIPMENT_LABELS,
  EXERCISE_KIND_HELP,
  EXERCISE_KIND_LABELS,
  EXERCISE_KINDS,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUPS,
  type Equipment,
  type ExerciseKind,
  type MuscleGroup,
} from "@/lib/workouts/exercise-library";
import type { CustomExerciseData } from "./catalog";
import { ConfirmDialog } from "./confirm";
import { Eyebrow, WButton, WCard } from "./ui";

const selectClass =
  "h-[52px] w-full cursor-pointer rounded-xl border border-input bg-card px-3.5 font-semibold text-[15px] text-foreground focus:border-blood/60 focus:outline-none";

export function CustomExerciseForm({
  existing,
  backHref,
}: {
  /** Present when editing; absent when creating. */
  existing?: CustomExerciseData;
  /** Where the labeled back action and post-save navigation go. */
  backHref: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(existing?.name ?? "");
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(
    (existing?.muscleGroup as MuscleGroup) ?? "other"
  );
  const [equipment, setEquipment] = useState<Equipment>(
    (existing?.equipment as Equipment) ?? "other"
  );
  const [kind, setKind] = useState<ExerciseKind>(
    (existing?.kind as ExerciseKind) ?? "weighted"
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canSave = name.trim().length > 0;

  async function handleSave() {
    if (!canSave || saving) {
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      muscleGroup,
      equipment,
      kind,
      notes: notes.trim() ? notes.trim() : null,
    };
    const result = existing
      ? await editCustomExercise({ id: existing.id, ...payload })
      : await addCustomExercise(payload);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error ?? "Couldn't save that exercise.");
      return;
    }
    toast.success(existing ? "Exercise updated." : `"${name.trim()}" added to your exercises.`);
    router.push(backHref);
    router.refresh();
  }

  async function handleDelete() {
    if (!existing || deleting) {
      return;
    }
    setDeleting(true);
    const result = await removeCustomExercise(existing.id);
    setDeleting(false);
    setConfirmingDelete(false);
    if (!result.ok) {
      toast.error(result.error ?? "Couldn't delete that exercise.");
      return;
    }
    toast.success("Exercise deleted.");
    router.push("/workouts/exercises");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6 pb-32">
      {/* Name */}
      <label className="block">
        <Eyebrow className="mb-1.5">Exercise name</Eyebrow>
        <input
          className="h-[56px] w-full rounded-xl border border-input bg-card px-4 font-semibold text-[17px] text-foreground placeholder:text-muted-foreground/60 focus:border-blood/60 focus:outline-none"
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Incline Hammer Press (Machine)"
          type="text"
          value={name}
        />
      </label>

      {/* Muscle group + equipment */}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <Eyebrow className="mb-1.5">Main muscle worked</Eyebrow>
          <select
            className={selectClass}
            onChange={(e) => setMuscleGroup(e.target.value as MuscleGroup)}
            value={muscleGroup}
          >
            {MUSCLE_GROUPS.map((m) => (
              <option key={m} value={m}>
                {MUSCLE_GROUP_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <Eyebrow className="mb-1.5">Equipment</Eyebrow>
          <select
            className={selectClass}
            onChange={(e) => setEquipment(e.target.value as Equipment)}
            value={equipment}
          >
            {EQUIPMENT.map((eq) => (
              <option key={eq} value={eq}>
                {EQUIPMENT_LABELS[eq]}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Logging kind */}
      <div>
        <Eyebrow className="mb-1.5">How you&apos;ll log it</Eyebrow>
        <div className="flex flex-col gap-2">
          {EXERCISE_KINDS.map((k) => (
            <button
              aria-pressed={kind === k}
              className={`flex min-h-[56px] w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                kind === k
                  ? "border-blood/60 bg-blood-dim"
                  : "border-input bg-card hover:bg-muted/50"
              }`}
              key={k}
              onClick={() => setKind(k)}
              type="button"
            >
              <span>
                <span className="block font-semibold text-[15px] text-foreground">
                  {EXERCISE_KIND_LABELS[k]}
                </span>
                <span className="block text-[13px] text-muted-foreground">
                  {EXERCISE_KIND_HELP[k]}
                </span>
              </span>
              <span
                aria-hidden
                className={`size-5 shrink-0 rounded-full border-2 ${
                  kind === k ? "border-blood bg-blood" : "border-input"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Notes */}
      <label className="block">
        <Eyebrow className="mb-1.5">Setup notes (optional)</Eyebrow>
        <textarea
          className="min-h-[88px] w-full rounded-xl border border-input bg-card px-4 py-3 text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:border-blood/60 focus:outline-none"
          maxLength={500}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Seat at 4, slow negative"
          value={notes}
        />
      </label>

      {existing && (
        <WCard className="p-4">
          <p className="text-[13px] text-muted-foreground leading-relaxed">
            Deleting this exercise removes it from your picker only. Workouts
            you already logged with it stay in your history.
          </p>
          <WButton
            className="mt-3"
            onClick={() => setConfirmingDelete(true)}
            variant="danger"
          >
            Delete this exercise
          </WButton>
        </WCard>
      )}

      {/* Sticky save bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-border border-t bg-background/95 px-4 py-3 backdrop-blur-xl"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto w-full max-w-[560px]">
          {!canSave && (
            <p className="mb-2 text-center text-[12.5px] text-muted-foreground">
              Name the exercise to save it
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
            {existing ? "Save changes" : "Save exercise"}
          </WButton>
        </div>
      </div>

      <ConfirmDialog
        body="It will no longer appear in your exercise picker. Workouts you already logged with it stay in your history."
        busy={deleting}
        confirmLabel="Delete exercise"
        destructive
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleDelete}
        open={confirmingDelete}
        title={`Delete "${existing?.name}"?`}
      />
    </div>
  );
}
