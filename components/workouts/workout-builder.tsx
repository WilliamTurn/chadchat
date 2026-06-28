"use client";

import { Check, ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { editWorkout, saveWorkout } from "@/app/workouts/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
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
import { todayLocalISO } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { SetType, WorkoutData } from "@/lib/workouts/stats";
import { ExercisePicker, type PickedExercise } from "./exercise-picker";
import { PlateCalculator } from "./plate-calculator";
import { RestTimer } from "./rest-timer";

type CustomExerciseRow = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
};

type EditorSet = {
  uid: string;
  weight: string;
  reps: string;
  unit: "lb" | "kg";
  rpe: string;
  setType: SetType;
  completed: boolean;
};

type EditorExercise = {
  uid: string;
  name: string;
  muscleGroup: string | null;
  notes: string;
  sets: EditorSet[];
};

const SET_TYPE_ORDER: SetType[] = ["working", "warmup", "dropset", "failure"];
const SET_TYPE_LABEL: Record<SetType, string> = {
  working: "Working set",
  warmup: "Warm-up",
  dropset: "Drop set",
  failure: "To failure",
};

let _uid = 0;
function uid(): string {
  _uid += 1;
  return `w${_uid}`;
}

const todayISO = todayLocalISO;

function blankSet(prev?: EditorSet): EditorSet {
  return {
    uid: uid(),
    weight: prev?.weight ?? "",
    reps: prev?.reps ?? "",
    unit: prev?.unit ?? "lb",
    rpe: "",
    setType: "working",
    completed: true,
  };
}

function fromWorkout(w: WorkoutData): EditorExercise[] {
  return w.exercises.map((ex) => ({
    uid: uid(),
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    notes: ex.notes ?? "",
    sets:
      ex.sets.length > 0
        ? ex.sets.map((s) => ({
            uid: uid(),
            weight: s.weight == null ? "" : String(s.weight),
            reps: s.reps == null ? "" : String(s.reps),
            unit: s.unit,
            rpe: s.rpe == null ? "" : String(s.rpe),
            setType: s.setType,
            completed: s.completed,
          }))
        : [blankSet()],
  }));
}

export function WorkoutBuilder({
  mode,
  initial,
  customExercises,
  trigger,
}: {
  // "repeat" prefills exercises/sets from `initial` but saves a NEW workout
  // dated today — the "repeat last workout" flow.
  mode: "create" | "edit" | "repeat";
  initial?: WorkoutData;
  customExercises: CustomExerciseRow[];
  trigger: ReactNode;
}) {
  const router = useRouter();
  const isRepeat = mode === "repeat";
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [date, setDate] = useState(
    initial && !isRepeat ? initial.performedAt.slice(0, 10) : todayISO()
  );
  const [durationMin, setDurationMin] = useState(
    initial?.durationSeconds && !isRepeat
      ? String(Math.round(initial.durationSeconds / 60))
      : ""
  );
  const [notes, setNotes] = useState(isRepeat ? "" : (initial?.notes ?? ""));
  const [exercises, setExercises] = useState<EditorExercise[]>(
    initial ? fromWorkout(initial) : []
  );

  function reset() {
    setTitle(initial?.title ?? "");
    setDate(
      initial && !isRepeat ? initial.performedAt.slice(0, 10) : todayISO()
    );
    setDurationMin(
      initial?.durationSeconds && !isRepeat
        ? String(Math.round(initial.durationSeconds / 60))
        : ""
    );
    setNotes(isRepeat ? "" : (initial?.notes ?? ""));
    setExercises(initial ? fromWorkout(initial) : []);
  }

  function addExercise(picked: PickedExercise) {
    setExercises((prev) => [
      ...prev,
      {
        uid: uid(),
        name: picked.name,
        muscleGroup: picked.muscleGroup,
        notes: "",
        sets: [blankSet()],
      },
    ]);
  }

  function updateExercise(exUid: string, patch: Partial<EditorExercise>) {
    setExercises((prev) =>
      prev.map((ex) => (ex.uid === exUid ? { ...ex, ...patch } : ex))
    );
  }

  function removeExercise(exUid: string) {
    setExercises((prev) => prev.filter((ex) => ex.uid !== exUid));
  }

  // Reorder an exercise up (-1) or down (+1). Order is meaningful — it's the
  // sequence the lifts were performed in — so this lets you fix a mis-add.
  function moveExercise(exUid: string, dir: -1 | 1) {
    setExercises((prev) => {
      const i = prev.findIndex((ex) => ex.uid === exUid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) {
        return prev;
      }
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function addSet(exUid: string) {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.uid === exUid
          ? { ...ex, sets: [...ex.sets, blankSet(ex.sets.at(-1))] }
          : ex
      )
    );
  }

  function updateSet(exUid: string, setUid: string, patch: Partial<EditorSet>) {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.uid === exUid
          ? {
              ...ex,
              sets: ex.sets.map((s) =>
                s.uid === setUid ? { ...s, ...patch } : s
              ),
            }
          : ex
      )
    );
  }

  function removeSet(exUid: string, setUid: string) {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.uid === exUid
          ? { ...ex, sets: ex.sets.filter((s) => s.uid !== setUid) }
          : ex
      )
    );
  }

  function submit() {
    if (!title.trim()) {
      toast.error("Name this workout.");
      return;
    }
    if (exercises.length === 0) {
      toast.error("Add at least one exercise.");
      return;
    }
    for (const ex of exercises) {
      if (ex.sets.length === 0) {
        toast.error(`Add a set to ${ex.name}.`);
        return;
      }
    }

    const durationSeconds = durationMin.trim()
      ? Math.round(Number(durationMin) * 60)
      : null;
    if (durationSeconds != null && Number.isNaN(durationSeconds)) {
      toast.error("Duration must be a number of minutes.");
      return;
    }

    const payload = {
      title: title.trim(),
      performedAt: date,
      durationSeconds,
      notes: notes.trim() || null,
      exercises: exercises.map((ex) => ({
        name: ex.name.trim(),
        muscleGroup: ex.muscleGroup,
        notes: ex.notes.trim() || null,
        sets: ex.sets.map((s) => ({
          weight: s.weight.trim() ? Number(s.weight) : null,
          reps: s.reps.trim() ? Number(s.reps) : null,
          unit: s.unit,
          rpe: s.rpe.trim() ? Number(s.rpe) : null,
          setType: s.setType,
          completed: s.completed,
        })),
      })),
    };

    // Guard against NaN sneaking through from bad numeric input.
    for (const ex of payload.exercises) {
      for (const s of ex.sets) {
        if (
          (s.weight != null && Number.isNaN(s.weight)) ||
          (s.reps != null && Number.isNaN(s.reps)) ||
          (s.rpe != null && Number.isNaN(s.rpe))
        ) {
          toast.error("Check the numbers — something isn't a valid value.");
          return;
        }
      }
    }

    startTransition(async () => {
      const result =
        mode === "edit" && initial
          ? await editWorkout({ id: initial.id, ...payload })
          : await saveWorkout(payload);
      if (result.ok) {
        toast.success(mode === "edit" ? "Workout updated." : "Workout logged.");
        setOpen(false);
        if (mode !== "edit") {
          reset();
        }
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't save that workout.");
      }
    });
  }

  return (
    <>
      <Dialog
        onOpenChange={(o) => {
          setOpen(o);
          if (o && mode !== "edit") {
            reset();
          }
        }}
        open={open}
      >
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-border border-b px-5 py-4">
            <DialogTitle>
              {mode === "edit"
                ? "Edit workout"
                : mode === "repeat"
                  ? "Repeat workout"
                  : "Log a workout"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-5 py-4">
            {/* Session meta */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5 sm:col-span-1">
                <Label htmlFor="wk-title">Workout</Label>
                <Input
                  id="wk-title"
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Push Day"
                  value={title}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wk-date">Date</Label>
                <DatePicker
                  id="wk-date"
                  max={todayISO()}
                  onChange={setDate}
                  value={date}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="wk-duration">Duration (min)</Label>
                <Input
                  id="wk-duration"
                  inputMode="numeric"
                  onChange={(e) => setDurationMin(e.target.value)}
                  placeholder="optional"
                  value={durationMin}
                />
              </div>
            </div>

            <RestTimer />
            <PlateCalculator />

            {/* Exercises */}
            {exercises.length === 0 ? (
              <div className="rounded-xl border border-border border-dashed px-4 py-8 text-center">
                <p className="text-muted-foreground text-sm">
                  No exercises yet. Add your first one.
                </p>
              </div>
            ) : (
              exercises.map((ex, i) => (
                <ExerciseBlock
                  canMoveDown={i < exercises.length - 1}
                  canMoveUp={i > 0}
                  exercise={ex}
                  key={ex.uid}
                  onAddSet={() => addSet(ex.uid)}
                  onMoveDown={() => moveExercise(ex.uid, 1)}
                  onMoveUp={() => moveExercise(ex.uid, -1)}
                  onRemove={() => removeExercise(ex.uid)}
                  onRemoveSet={(setUid) => removeSet(ex.uid, setUid)}
                  onUpdate={(patch) => updateExercise(ex.uid, patch)}
                  onUpdateSet={(setUid, patch) => updateSet(ex.uid, setUid, patch)}
                />
              ))
            )}

            <Button
              className="gap-1.5"
              onClick={() => setPickerOpen(true)}
              type="button"
              variant="outline"
            >
              <Plus className="size-4" />
              Add exercise
            </Button>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wk-notes">Session notes (optional)</Label>
              <Textarea
                id="wk-notes"
                maxLength={2000}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="How it felt, what to change next time…"
                rows={2}
                value={notes}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-border border-t px-5 py-4">
            <Button
              disabled={pending}
              onClick={() => setOpen(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
            <Button disabled={pending} onClick={submit} type="button">
              {pending
                ? "Saving…"
                : mode === "edit"
                  ? "Save changes"
                  : "Save workout"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ExercisePicker
        customExercises={customExercises}
        onOpenChange={setPickerOpen}
        onPick={addExercise}
        open={pickerOpen}
      />
    </>
  );
}

function ExerciseBlock({
  exercise,
  canMoveUp,
  canMoveDown,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onRemove,
  onAddSet,
  onUpdateSet,
  onRemoveSet,
}: {
  exercise: EditorExercise;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUpdate: (patch: Partial<EditorExercise>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onAddSet: () => void;
  onUpdateSet: (setUid: string, patch: Partial<EditorSet>) => void;
  onRemoveSet: (setUid: string) => void;
}) {
  // Running index of working sets, for the set-number badge.
  let workingCount = 0;

  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium text-sm">{exercise.name}</span>
        <div className="flex items-center gap-0.5">
          <Button
            aria-label="Move exercise up"
            className="size-7 text-muted-foreground"
            disabled={!canMoveUp}
            onClick={onMoveUp}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            aria-label="Move exercise down"
            className="size-7 text-muted-foreground"
            disabled={!canMoveDown}
            onClick={onMoveDown}
            size="icon"
            type="button"
            variant="ghost"
          >
            <ChevronDown className="size-4" />
          </Button>
          <Button
            aria-label="Remove exercise"
            className="size-7 text-muted-foreground"
            onClick={onRemove}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Column headers */}
      <div className="mb-1 flex items-center gap-2 px-1 text-[11px] text-muted-foreground uppercase tracking-wide">
        <span className="w-8 text-center">Set</span>
        <span className="flex-1">Weight</span>
        <span className="flex-1">Reps</span>
        <span className="w-12 text-center">RPE</span>
        <span className="w-8 text-center">Done</span>
        <span className="w-7" />
      </div>

      <div className="flex flex-col gap-1.5">
        {exercise.sets.map((s) => {
          if (s.setType === "working") {
            workingCount += 1;
          }
          const badge =
            s.setType === "working"
              ? String(workingCount)
              : s.setType === "warmup"
                ? "W"
                : s.setType === "dropset"
                  ? "D"
                  : "F";
          return (
            <div className="flex items-center gap-2" key={s.uid}>
              <button
                aria-label={`Set type: ${SET_TYPE_LABEL[s.setType]} (tap to change)`}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-md border font-medium text-xs transition-colors",
                  s.setType === "working"
                    ? "border-border bg-card"
                    : s.setType === "warmup"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                      : "border-blood/40 bg-blood/10 text-blood"
                )}
                onClick={() => {
                  const next =
                    SET_TYPE_ORDER[
                      (SET_TYPE_ORDER.indexOf(s.setType) + 1) %
                        SET_TYPE_ORDER.length
                    ];
                  onUpdateSet(s.uid, { setType: next });
                }}
                title={SET_TYPE_LABEL[s.setType]}
                type="button"
              >
                {badge}
              </button>

              <div className="flex flex-1 items-center gap-1">
                <Input
                  aria-label="Weight"
                  className="h-9"
                  inputMode="decimal"
                  onChange={(e) =>
                    onUpdateSet(s.uid, { weight: e.target.value })
                  }
                  placeholder="–"
                  value={s.weight}
                />
                <Select
                  onValueChange={(v) =>
                    onUpdateSet(s.uid, { unit: v as "lb" | "kg" })
                  }
                  value={s.unit}
                >
                  <SelectTrigger
                    aria-label="Unit"
                    className="h-9 shrink-0 gap-1 rounded-md px-2 text-muted-foreground text-xs"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lb">lb</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Input
                aria-label="Reps"
                className="h-9 flex-1"
                inputMode="numeric"
                onChange={(e) => onUpdateSet(s.uid, { reps: e.target.value })}
                placeholder="–"
                value={s.reps}
              />

              <Input
                aria-label="RPE"
                className="h-9 w-12 px-1 text-center"
                inputMode="decimal"
                onChange={(e) => onUpdateSet(s.uid, { rpe: e.target.value })}
                placeholder="–"
                value={s.rpe}
              />

              <button
                aria-label={s.completed ? "Mark not done" : "Mark done"}
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors",
                  s.completed
                    ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "border-border text-muted-foreground hover:bg-accent"
                )}
                onClick={() => onUpdateSet(s.uid, { completed: !s.completed })}
                type="button"
              >
                <Check className="size-4" />
              </button>

              <button
                aria-label="Remove set"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => onRemoveSet(s.uid)}
                type="button"
              >
                <X className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <button
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-border border-dashed py-1.5 text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-foreground"
        onClick={onAddSet}
        type="button"
      >
        <Plus className="size-3.5" />
        Add set
      </button>
    </div>
  );
}
