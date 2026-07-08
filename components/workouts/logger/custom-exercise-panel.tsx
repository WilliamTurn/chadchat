"use client";

import { ArrowLeft, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addCustomExercise,
  editCustomExercise,
  removeCustomExercise,
} from "@/app/workouts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  EQUIPMENT,
  EQUIPMENT_LABELS,
  type Equipment,
  EXERCISE_KIND_HELP,
  EXERCISE_KIND_LABELS,
  EXERCISE_KINDS,
  type ExerciseKind,
  type MuscleGroup,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUPS,
} from "@/lib/workouts/exercise-library";
import type { CustomExerciseRow } from "./model";

/**
 * Create/edit a custom exercise as a PAGE VIEW inside the logger (MOB-18),
 * the same full pro-app form the old dialog carried (DSH-53), no longer
 * stacked as a popup-on-popup. A saved custom exercise behaves exactly like a
 * built-in: searchable, history groups by name, earns PR/est-1RM tracking.
 */
export function CustomExercisePanel({
  initial,
  defaultName,
  onBack,
  onSaved,
}: {
  /** Present = edit this exercise (with delete); absent = create. */
  initial: CustomExerciseRow | null;
  /** Create mode: pre-fill the name (e.g. from the picker's search text). */
  defaultName?: string;
  onBack: () => void;
  /** Called after a successful save so the caller can add it to the workout. */
  onSaved: (exercise: {
    name: string;
    muscleGroup: string;
    kind: ExerciseKind;
  }) => void;
}) {
  const router = useRouter();
  const isEdit = initial != null;
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [name, setName] = useState(initial?.name ?? defaultName ?? "");
  const [muscle, setMuscle] = useState<MuscleGroup>(
    (initial?.muscleGroup as MuscleGroup) ?? "other"
  );
  const [equipment, setEquipment] = useState<Equipment>(
    (initial?.equipment as Equipment) ?? "other"
  );
  const [kind, setKind] = useState<ExerciseKind>(
    (initial?.kind as ExerciseKind) ?? "weighted"
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name the exercise.");
      return;
    }
    const payload = {
      name: trimmed,
      muscleGroup: muscle,
      equipment,
      kind,
      notes: notes.trim() || null,
    };
    startTransition(async () => {
      const result = isEdit
        ? await editCustomExercise({ id: initial.id, ...payload })
        : await addCustomExercise(payload);
      if (result.ok) {
        toast.success(
          isEdit ? "Exercise updated." : "Exercise added to your library."
        );
        router.refresh();
        onSaved({ name: trimmed, muscleGroup: muscle, kind });
      } else {
        toast.error(result.error ?? "Couldn't save that exercise.");
      }
    });
  }

  function destroy() {
    if (!isEdit) {
      return;
    }
    startTransition(async () => {
      const result = await removeCustomExercise(initial.id);
      if (result.ok) {
        toast.success(
          "Exercise removed from your library. Workouts you already logged with it keep it."
        );
        router.refresh();
        onBack();
      } else {
        toast.error(result.error ?? "Couldn't remove that exercise.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <button
          className="mb-2 inline-flex min-h-9 items-center gap-1 text-muted-foreground text-xs underline-offset-4 transition-colors hover:text-foreground hover:underline"
          onClick={onBack}
          type="button"
        >
          <ArrowLeft className="size-3.5" />
          Back to the exercise list
        </button>
        <h1 className="font-semibold text-2xl tracking-tight">
          {isEdit ? "Edit custom exercise" : "Create a custom exercise"}
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          It joins your library like any built-in exercise: searchable, with
          its own history, PRs, and strength trend.
        </p>
      </div>

      <div className="flex max-w-xl flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cx-name">Name</Label>
          <Input
            className="h-11"
            id="cx-name"
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            placeholder="Safety Bar Squat"
            value={name}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cx-muscle">Muscle group</Label>
            <Select
              onValueChange={(v) => setMuscle(v as MuscleGroup)}
              value={muscle}
            >
              <SelectTrigger className="h-11 w-full" id="cx-muscle">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MUSCLE_GROUPS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {MUSCLE_GROUP_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cx-equip">Equipment</Label>
            <Select
              onValueChange={(v) => setEquipment(v as Equipment)}
              value={equipment}
            >
              <SelectTrigger className="h-11 w-full" id="cx-equip">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EQUIPMENT.map((eq) => (
                  <SelectItem key={eq} value={eq}>
                    {EQUIPMENT_LABELS[eq]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>How is it logged?</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {EXERCISE_KINDS.map((k) => (
              <button
                className={cn(
                  "flex min-h-11 flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  kind === k
                    ? "border-blood/40 bg-blood/10"
                    : "border-border hover:bg-accent"
                )}
                key={k}
                onClick={() => setKind(k)}
                type="button"
              >
                <span
                  className={cn(
                    "font-medium text-sm",
                    kind === k ? "text-blood" : "text-foreground"
                  )}
                >
                  {EXERCISE_KIND_LABELS[k]}
                </span>
                <span className="text-muted-foreground text-xs leading-snug">
                  {EXERCISE_KIND_HELP[k]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cx-notes">Notes (optional)</Label>
          <Textarea
            id="cx-notes"
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Setup cues, seat position, grip…"
            rows={2}
            value={notes}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-border border-t pt-4">
          <div>
            {isEdit &&
              (confirmingDelete ? (
                <div className="flex items-center gap-1">
                  <Button
                    disabled={pending}
                    onClick={destroy}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    {pending ? "Removing…" : "Really remove"}
                  </Button>
                  <Button
                    disabled={pending}
                    onClick={() => setConfirmingDelete(false)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    Keep it
                  </Button>
                </div>
              ) : (
                <Button
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => setConfirmingDelete(true)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-3.5" />
                  Remove from library
                </Button>
              ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              disabled={pending}
              onClick={onBack}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button disabled={pending} onClick={save} type="button">
              {pending
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Create exercise"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
