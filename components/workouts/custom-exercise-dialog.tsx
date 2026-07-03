"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addCustomExercise,
  editCustomExercise,
  removeCustomExercise,
} from "@/app/workouts/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type CustomExerciseRow = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  kind: string;
  notes: string | null;
};

/**
 * Create or edit a custom exercise, the full pro-app form (DSH-53): name,
 * muscle group, equipment, how it's logged (weighted / bodyweight / timed),
 * and optional setup notes. A saved custom exercise behaves exactly like a
 * built-in: it appears in the picker's search, its logged history groups by
 * name, and it earns PR / est-1RM tracking.
 */
export function CustomExerciseDialog({
  open,
  onOpenChange,
  initial,
  defaultName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit this exercise (with delete); absent = create. */
  initial?: CustomExerciseRow | null;
  /** Create mode: pre-fill the name (e.g. from the picker's search text). */
  defaultName?: string;
  /** Called after a successful save so the caller can e.g. add it to the workout. */
  onSaved?: (exercise: {
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

  // Re-seed the form whenever the dialog opens for a (different) target.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on open only
  useEffect(() => {
    if (open) {
      setName(initial?.name ?? defaultName ?? "");
      setMuscle((initial?.muscleGroup as MuscleGroup) ?? "other");
      setEquipment((initial?.equipment as Equipment) ?? "other");
      setKind((initial?.kind as ExerciseKind) ?? "weighted");
      setNotes(initial?.notes ?? "");
      setConfirmingDelete(false);
    }
  }, [open]);

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
        onSaved?.({ name: trimmed, muscleGroup: muscle, kind });
        onOpenChange(false);
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
        onOpenChange(false);
      } else {
        toast.error(result.error ?? "Couldn't remove that exercise.");
      }
    });
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-border border-b px-4 py-3">
          <DialogTitle>
            {isEdit ? "Edit custom exercise" : "Create a custom exercise"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto px-4 py-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cx-name">Name</Label>
            <Input
              autoFocus={!isEdit}
              id="cx-name"
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
              placeholder="Safety Bar Squat"
              value={name}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cx-muscle">Muscle group</Label>
              <Select
                onValueChange={(v) => setMuscle(v as MuscleGroup)}
                value={muscle}
              >
                <SelectTrigger className="w-full" id="cx-muscle">
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
                <SelectTrigger className="w-full" id="cx-equip">
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
            <div className="grid grid-cols-3 gap-2">
              {EXERCISE_KINDS.map((k) => (
                <button
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
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
                      "font-medium text-xs",
                      kind === k ? "text-blood" : "text-foreground"
                    )}
                  >
                    {EXERCISE_KIND_LABELS[k]}
                  </span>
                  <span className="text-[11px] text-muted-foreground leading-snug">
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
        </div>

        <div className="flex items-center justify-between gap-2 border-border border-t px-4 py-3">
          <div>
            {isEdit &&
              (confirmingDelete ? (
                <div className="flex items-center gap-1">
                  <Button
                    className="h-8 px-2 text-xs"
                    disabled={pending}
                    onClick={destroy}
                    size="sm"
                    type="button"
                    variant="destructive"
                  >
                    {pending ? "Removing…" : "Really remove"}
                  </Button>
                  <Button
                    className="h-8 px-2 text-xs"
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
                  Remove
                </Button>
              ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              disabled={pending}
              onClick={() => onOpenChange(false)}
              size="sm"
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button disabled={pending} onClick={save} size="sm" type="button">
              {pending
                ? "Saving…"
                : isEdit
                  ? "Save changes"
                  : "Create exercise"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
