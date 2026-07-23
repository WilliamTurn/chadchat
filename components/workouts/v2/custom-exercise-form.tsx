"use client";

// Full-page form for creating or editing one of the member's own exercises.
// Every field explains itself; nothing is auto-focused.

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import {
  addCustomExercise,
  editCustomExercise,
  removeCustomExercise,
  type WorkoutActionState,
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
  // This form is server-rendered, so the portaled save bar mounts client-side.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
    // D3 (S0c): the REFUSAL path (the action returns {ok:false}) was handled;
    // the THROWN path was not. When the request itself fails - offline, a
    // dropped connection, a 500 - the rejection escaped, setSaving(false)
    // never ran, and the member was left with a Save button spinning forever
    // and no error at all. Canon 03 error anatomy / copy.ts errors-keep-data:
    // name what failed, say the typed values are kept, offer the retry. Every
    // field is still in state and still on screen, so nothing is lost.
    let result: WorkoutActionState;
    try {
      result = existing
        ? await editCustomExercise({ id: existing.id, ...payload })
        : await addCustomExercise(payload);
    } catch {
      setSaving(false);
      toast.error("Couldn't save your exercise.", {
        description: "Everything you entered is still here. Try again.",
      });
      return;
    }
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error ?? "Couldn't save that exercise.");
      return;
    }
    toast.success(existing ? "Exercise updated." : `"${name.trim()}" added to your exercises.`);
    // replace, not push: the form must not stay in the history between the
    // picker and the workout (flaws XPK-16/17 back-loop).
    router.replace(backHref);
    router.refresh();
  }

  async function handleDelete() {
    if (!existing || deleting) {
      return;
    }
    setDeleting(true);
    // Same class as handleSave above (D3): a thrown request left the confirm
    // dialog open with a permanently busy Delete button and no explanation.
    let result: WorkoutActionState;
    try {
      result = await removeCustomExercise(existing.id);
    } catch {
      setDeleting(false);
      toast.error("Couldn't delete your exercise.", {
        description: "It is still in your exercises. Try again.",
      });
      return;
    }
    setDeleting(false);
    setConfirmingDelete(false);
    if (!result.ok) {
      toast.error(result.error ?? "Couldn't delete that exercise.");
      return;
    }
    toast.success("Exercise deleted.");
    // replace, not push, for the same reason handleSave uses it: a push left
    // this edit page in history, one back-press from a screen that claims the
    // exercise "isn't one of your custom exercises" seconds after the member
    // deleted it. NOTE (S0c): this drops the edit entry only. If the member
    // arrived list -> detail -> edit, back still reaches the detail page,
    // which renders a bare "Exercise not found". Making those two states
    // honest about a just-deleted record is owed work, reported in the S0c
    // closing report.
    router.replace("/workouts/exercises");
    router.refresh();
  }

  return (
    // Full-width desktop layout (LAY-1): the basics sit beside the
    // logging-kind picker + notes at lg; phones keep the stacked order.
    // Explicit grid-cols-1 + min-w-0 columns (the implicit column would
    // size to max-content and clip phones under overflow-x: clip).
    <div className="grid grid-cols-1 items-start gap-6 pb-32 lg:grid-cols-2 lg:gap-8">
      <div className="flex min-w-0 flex-col gap-6">
        {/* Name */}
        <label className="block">
          <Eyebrow className="mb-1.5">Exercise name</Eyebrow>
          <input
            className="h-[56px] w-full rounded-xl border border-input bg-card px-4 font-semibold text-[17px] text-foreground placeholder:text-muted-foreground/60 focus:border-blood/60 focus:outline-none"
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter the name of your exercise"
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
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        {/* Logging kind */}
        <div>
          <Eyebrow className="mb-1.5">How you&apos;ll log it</Eyebrow>
          <div className="flex flex-col gap-2">
            {EXERCISE_KINDS.map((k) => (
              <button
                aria-pressed={kind === k}
                className={`flex min-h-[56px] w-full cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition ${
                  kind === k
                    ? "border-[var(--go)]/60 bg-[var(--go)]/12"
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
                    kind === k ? "border-[var(--go)] bg-[var(--go)]" : "border-input"
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
            placeholder="Machine settings, cues, anything to remember"
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
        </div>

      {/* Pinned save bar. Portaled to <body>: the shell's <main> carries a
          transform that would otherwise anchor this "fixed" bar to the
          document floor instead of the viewport. */}
      {mounted &&
        createPortal(
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
          </div>,
          document.body
        )}

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
