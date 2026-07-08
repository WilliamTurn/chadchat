"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  Link2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type ReactNode, useState, useTransition } from "react";
import { toast } from "sonner";
import { useReward } from "@/components/dashboard/reward";
import { editWorkout, saveWorkout } from "@/app/workouts/actions";
import { KpiHelp } from "@/components/dashboard/kpi";
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
import { formatCalendarDay, todayLocalISO } from "@/lib/date";
import { cn } from "@/lib/utils";
import type {
  ExerciseKindData,
  GhostSet,
  LastExerciseLog,
  SetType,
  WorkoutData,
} from "@/lib/workouts/stats";
import { ExercisePicker, type PickedExercise } from "./exercise-picker";
import { PlateCalculator } from "./plate-calculator";
import { RestTimer } from "./rest-timer";

type CustomExerciseRow = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  kind: string;
  notes: string | null;
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

// A prior/prescribed value shown as a placeholder in an empty set input (the
// Hevy "previous" column). Strings, because a plan target can be a range
// ("4-6") that can't be adopted as a number; only numeric ghosts auto-fill
// when the set is checked off.
type GhostValue = { weight: string; reps: string };

type EditorExercise = {
  uid: string;
  name: string;
  muscleGroup: string | null;
  kind: ExerciseKindData | null;
  // One-line plan prescription ("4 x 4-6 @ 185 lb · RPE 8"), plan mode only.
  target?: string | null;
  // Per-set-index placeholder values; the last one repeats for extra sets.
  ghosts?: GhostValue[];
  // Supersets (FEAT-10) are edited as a link to the exercise above; group
  // numbers are derived from the resulting chains on render and save.
  linkedWithPrev: boolean;
  notes: string;
  sets: EditorSet[];
};

/** One plan-day exercise, pre-resolved by the caller (PlanRunner). */
export type PlanPrefillExercise = {
  name: string;
  muscleGroup: string | null;
  kind: ExerciseKindData | null;
  target: string;
  sets: number;
  unit: "lb" | "kg";
  ghosts: GhostValue[];
};

export type PlanPrefill = {
  title: string;
  exercises: PlanPrefillExercise[];
};

/** Ghost placeholders from a last-session lookup entry. */
export function ghostsFromHistory(sets: GhostSet[]): GhostValue[] {
  return sets.map((s) => ({
    weight: s.weight == null ? "" : String(s.weight),
    reps: s.reps == null ? "" : String(s.reps),
  }));
}

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

function isNumeric(v: string): boolean {
  return v.trim() !== "" && !Number.isNaN(Number(v));
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
  return w.exercises.map((ex, i) => ({
    uid: uid(),
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    kind: ex.kind ?? null,
    linkedWithPrev:
      i > 0 &&
      ex.supersetGroup != null &&
      w.exercises[i - 1].supersetGroup === ex.supersetGroup,
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

/**
 * Build the editor state for a plan day: every prescribed exercise with its
 * set count laid out, values EMPTY, and last session's numbers (or the plan's
 * prescription) ghosted as placeholders. Sets start unchecked; the member
 * checks them off as they train, and checking an empty set adopts its ghost.
 */
function fromPlan(exercises: PlanPrefillExercise[]): EditorExercise[] {
  return exercises.map((ex) => ({
    uid: uid(),
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    kind: ex.kind,
    target: ex.target,
    ghosts: ex.ghosts,
    linkedWithPrev: false,
    notes: "",
    sets: Array.from({ length: ex.sets }, () => ({
      uid: uid(),
      weight: "",
      reps: "",
      unit: ex.unit,
      rpe: "",
      setType: "working" as const,
      completed: false,
    })),
  }));
}

/** The ghost for set index `i`; the last known ghost repeats for extra sets. */
function ghostAt(ex: EditorExercise, i: number): GhostValue | null {
  if (!ex.ghosts || ex.ghosts.length === 0) {
    return null;
  }
  return ex.ghosts[Math.min(i, ex.ghosts.length - 1)];
}

/**
 * Superset group number (1, 2, …) per exercise, derived from the linked-with-
 * above chains; null = standalone. Used for both the visual grouping and the
 * saved supersetGroup values.
 */
function deriveGroups(exercises: EditorExercise[]): (number | null)[] {
  const groups: (number | null)[] = exercises.map(() => null);
  let counter = 0;
  for (let i = 1; i < exercises.length; i++) {
    if (!exercises[i].linkedWithPrev) {
      continue;
    }
    if (groups[i - 1] == null) {
      counter += 1;
      groups[i - 1] = counter;
    }
    groups[i] = groups[i - 1];
  }
  return groups;
}

const GROUP_LETTERS = "ABCDEFGHIJ";

// Static class strings (one per chart token) so Tailwind keeps them.
const GROUP_RAILS = [
  "border-l-chart-1",
  "border-l-chart-2",
  "border-l-chart-3",
  "border-l-chart-4",
  "border-l-chart-5",
] as const;
export const GROUP_CHIPS = [
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/15 text-chart-2",
  "bg-chart-3/15 text-chart-3",
  "bg-chart-4/15 text-chart-4",
  "bg-chart-5/15 text-chart-5",
] as const;

export function supersetLabel(groupNo: number): string {
  return `Superset ${GROUP_LETTERS[(groupNo - 1) % GROUP_LETTERS.length]}`;
}

/** "Last time (Jun 28): 185 lb × 8, 185 lb × 8, 185 lb × 6" for the header. */
function formatLastLine(last: LastExerciseLog, kind: ExerciseKindData): string {
  const date = formatCalendarDay(new Date(last.performedAt), {
    month: "short",
    day: "numeric",
  });
  const shown = last.sets.slice(0, 5).map((s) => {
    if (kind === "timed") {
      return s.reps == null ? "?" : `${s.reps}s`;
    }
    const load = s.weight == null ? "BW" : `${s.weight} ${s.unit}`;
    return s.reps == null ? load : `${load} × ${s.reps}`;
  });
  const extra = last.sets.length - shown.length;
  return `Last time (${date}): ${shown.join(", ")}${extra > 0 ? ` +${extra}` : ""}`;
}

export function WorkoutBuilder({
  mode,
  initial,
  plan,
  lastSets,
  customExercises,
  trigger,
}: {
  // "repeat" prefills exercises/sets from `initial` but saves a NEW workout
  // dated today (the "repeat last workout" flow). "plan" prefills a training
  // plan's day from `plan` (FN-2: "Start Day 2" opens a ready-to-run logger).
  mode: "create" | "edit" | "repeat" | "plan";
  initial?: WorkoutData;
  plan?: PlanPrefill;
  // Last session per exercise (lowercased name): ghost placeholders + the
  // inline "Last time" reference line (FEAT-10).
  lastSets?: Record<string, LastExerciseLog>;
  customExercises: CustomExerciseRow[];
  trigger: ReactNode;
}) {
  const router = useRouter();
  const reward = useReward();
  const isRepeat = mode === "repeat";
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  function initialTitle(): string {
    return mode === "plan" ? (plan?.title ?? "") : (initial?.title ?? "");
  }
  function initialExercises(): EditorExercise[] {
    if (mode === "plan") {
      return plan ? fromPlan(plan.exercises) : [];
    }
    return initial ? fromWorkout(initial) : [];
  }

  const [title, setTitle] = useState(initialTitle());
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
    initialExercises()
  );

  function reset() {
    setTitle(initialTitle());
    setDate(
      initial && !isRepeat ? initial.performedAt.slice(0, 10) : todayISO()
    );
    setDurationMin(
      initial?.durationSeconds && !isRepeat
        ? String(Math.round(initial.durationSeconds / 60))
        : ""
    );
    setNotes(isRepeat ? "" : (initial?.notes ?? ""));
    setExercises(initialExercises());
  }

  function addExercise(picked: PickedExercise) {
    const history = lastSets?.[picked.name.trim().toLowerCase()];
    setExercises((prev) => [
      ...prev,
      {
        uid: uid(),
        name: picked.name,
        muscleGroup: picked.muscleGroup,
        kind: picked.kind ?? null,
        ghosts: history ? ghostsFromHistory(history.sets) : undefined,
        linkedWithPrev: false,
        notes: "",
        sets: [blankSet()],
      },
    ]);
  }

  // Link an exercise into a superset with the one above it (or unlink it).
  function toggleLink(exUid: string) {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.uid === exUid ? { ...ex, linkedWithPrev: !ex.linkedWithPrev } : ex
      )
    );
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

  // One lb/kg control per exercise (the pro-app pattern) instead of a select
  // squeezed into every set row; it applies to all of the exercise's sets.
  function setUnit(exUid: string, unit: "lb" | "kg") {
    setExercises((prev) =>
      prev.map((ex) =>
        ex.uid === exUid
          ? { ...ex, sets: ex.sets.map((s) => ({ ...s, unit })) }
          : ex
      )
    );
  }

  function submit() {
    if (!title.trim()) {
      toast.error("Name this workout.");
      return;
    }

    // Superset groups come from the linked-with-above chains, resolved BEFORE
    // plan mode drops untouched exercises so a group number survives even if
    // a middle exercise was skipped.
    const groupByUid = new Map<string, number | null>();
    deriveGroups(exercises).forEach((g, i) => {
      groupByUid.set(exercises[i].uid, g);
    });

    // Plan mode lays out the WHOLE day; whatever the member never touched
    // (unchecked sets with nothing typed) is dropped on save, Hevy's
    // "discard empty sets", so skipping an exercise doesn't log four
    // phantom empty sets into history.
    let toSave = exercises;
    if (mode === "plan") {
      toSave = exercises
        .map((ex) => ({
          ...ex,
          sets: ex.sets.filter(
            (s) =>
              s.completed || s.weight.trim() || s.reps.trim() || s.rpe.trim()
          ),
        }))
        .filter((ex) => ex.sets.length > 0);
      if (toSave.length === 0) {
        toast.error("Check off or fill in at least one set first.");
        return;
      }
    }

    if (toSave.length === 0) {
      toast.error("Add at least one exercise.");
      return;
    }
    for (const ex of toSave) {
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
      exercises: toSave.map((ex) => ({
        name: ex.name.trim(),
        muscleGroup: ex.muscleGroup,
        kind: ex.kind,
        supersetGroup: groupByUid.get(ex.uid) ?? null,
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
        reward.celebrate(
          mode === "edit" ? "Workout updated." : "Workout logged."
        );
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
        {/* Outside interactions never dismiss the logger: a stray tap must not
            throw away a half-entered session, and on touch devices a tap
            inside the stacked exercise-picker dialog registers as an outside
            press of THIS dialog and silently closed both (the s167 mobile
            dead-tap bug). Close = Cancel, the X, or Escape. */}
        <DialogContent
          className="max-h-[90vh] gap-0 overflow-hidden p-0 sm:max-w-2xl"
          onInteractOutside={(e) => e.preventDefault()}
          // No uninvited keyboard on phones (owner order s168 / NUT-27b rule):
          // Radix otherwise focuses the title input on open, which pops the
          // keyboard before the member is ready to type anything.
          onOpenAutoFocus={(e) => {
            if (window.matchMedia("(pointer: coarse)").matches) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader className="border-border border-b px-5 py-4">
            <DialogTitle>
              {mode === "edit"
                ? "Edit workout"
                : mode === "repeat"
                  ? "Repeat workout"
                  : mode === "plan"
                    ? "Run plan day"
                    : "Log a workout"}
            </DialogTitle>
            {mode === "plan" ? (
              <p className="text-muted-foreground text-xs">
                Your plan's exercises are loaded. Faded numbers are last
                session (or the plan's target). Check a set off to accept
                them, or type what you actually did.
              </p>
            ) : null}
          </DialogHeader>

          <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-3 py-4 sm:px-5">
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
              (() => {
                const groups = deriveGroups(exercises);
                return exercises.map((ex, i) => (
                  <ExerciseBlock
                    canLink={i > 0}
                    canMoveDown={i < exercises.length - 1}
                    canMoveUp={i > 0}
                    exercise={ex}
                    groupNo={groups[i]}
                    key={ex.uid}
                    last={
                      mode === "edit"
                        ? null
                        : (lastSets?.[ex.name.trim().toLowerCase()] ?? null)
                    }
                    onAddSet={() => addSet(ex.uid)}
                    onMoveDown={() => moveExercise(ex.uid, 1)}
                    onMoveUp={() => moveExercise(ex.uid, -1)}
                    onRemove={() => removeExercise(ex.uid)}
                    onRemoveSet={(setUid) => removeSet(ex.uid, setUid)}
                    onSetUnit={(unit) => setUnit(ex.uid, unit)}
                    onToggleLink={() => toggleLink(ex.uid)}
                    onUpdate={(patch) => updateExercise(ex.uid, patch)}
                    onUpdateSet={(setUid, patch) =>
                      updateSet(ex.uid, setUid, patch)
                    }
                  />
                ));
              })()
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
  canLink,
  canMoveUp,
  canMoveDown,
  groupNo,
  last,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onRemove,
  onAddSet,
  onSetUnit,
  onToggleLink,
  onUpdateSet,
  onRemoveSet,
}: {
  exercise: EditorExercise;
  canLink: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  // Derived superset group number (1, 2, …) or null for standalone.
  groupNo: number | null;
  // The most recent logged session of this exercise, for the "Last time" line.
  last: LastExerciseLog | null;
  onUpdate: (patch: Partial<EditorExercise>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onAddSet: () => void;
  onSetUnit: (unit: "lb" | "kg") => void;
  onToggleLink: () => void;
  onUpdateSet: (setUid: string, patch: Partial<EditorSet>) => void;
  onRemoveSet: (setUid: string) => void;
}) {
  // Running index of working sets, for the set-number badge.
  let workingCount = 0;
  const kind = exercise.kind ?? "weighted";
  const unit = exercise.sets[0]?.unit ?? "lb";

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background/40 p-2.5 sm:p-3",
        groupNo != null && "border-l-2",
        groupNo != null && GROUP_RAILS[(groupNo - 1) % GROUP_RAILS.length]
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-sm">{exercise.name}</span>
            {groupNo != null && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-medium text-[10px] uppercase tracking-wide",
                  GROUP_CHIPS[(groupNo - 1) % GROUP_CHIPS.length]
                )}
              >
                {supersetLabel(groupNo)}
              </span>
            )}
          </span>
          {exercise.target ? (
            <div className="text-muted-foreground text-xs">
              Plan: {exercise.target}
            </div>
          ) : null}
          {last ? (
            <div className="text-muted-foreground text-xs">
              {formatLastLine(last, kind)}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-0.5">
          {canLink && (
            <Button
              aria-label={
                exercise.linkedWithPrev
                  ? "Remove from superset"
                  : "Superset with the exercise above"
              }
              className={cn(
                "size-7",
                exercise.linkedWithPrev
                  ? "text-blood"
                  : "text-muted-foreground"
              )}
              onClick={onToggleLink}
              size="icon"
              title={
                exercise.linkedWithPrev
                  ? "Remove from superset"
                  : "Superset with the exercise above"
              }
              type="button"
              variant="ghost"
            >
              <Link2 className="size-4" />
            </Button>
          )}
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

      {/* Column headers. A timed exercise (plank, cardio) logs seconds, not
          load × reps; a bodyweight one logs reps with optional added load.
          The lb/kg unit lives HERE, once per exercise, not as a select inside
          every set row — per-row selects crushed the weight/reps inputs to
          unreadable slivers at phone widths (s167). */}
      <div className="mb-1 flex items-center gap-2 px-1 text-[11px] text-muted-foreground uppercase tracking-wide">
        <span className="w-11 text-center sm:w-8">Set</span>
        {kind !== "timed" && (
          <span className="flex flex-1 items-center gap-1">
            Weight
            <Select
              onValueChange={(v) => onSetUnit(v as "lb" | "kg")}
              value={unit}
            >
              <SelectTrigger
                aria-label="Weight unit for this exercise"
                className="h-6 gap-0.5 rounded-md px-1.5 text-[11px] text-muted-foreground"
                size="sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lb">lb</SelectItem>
                <SelectItem value="kg">kg</SelectItem>
              </SelectContent>
            </Select>
          </span>
        )}
        <span className="flex-1">{kind === "timed" ? "Seconds" : "Reps"}</span>
        {/* On phones RPE gets its own labeled line under each set (below), so
            the main row keeps only four big touch targets. */}
        <span className="hidden w-11 items-center justify-center gap-0.5 sm:flex">
          RPE
          <KpiHelp label="RPE">
            Rate of Perceived Exertion: how hard the set felt, 1 to 10. A 10
            means you had nothing left; an 8 means you could have done about
            two more reps. Optional: leave it blank if you don't track it.
          </KpiHelp>
        </span>
        <span className="w-11 text-center sm:w-8">Done</span>
        <span className="hidden w-7 sm:block" />
      </div>

      <div className="flex flex-col gap-3 sm:gap-1.5">
        {exercise.sets.map((s, setIndex) => {
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
          const ghost = ghostAt(exercise, setIndex);
          const weightGhost =
            ghost?.weight || (kind === "bodyweight" ? "BW" : "–");
          const repsGhost = ghost?.reps || "–";
          return (
            // MOBILE-FIRST set layout (owner order s168): on phones the main
            // row holds only FOUR big touch targets (set type, weight, reps,
            // done) so nothing is crammed or needs a precision tap; RPE and
            // Remove get their own labeled line underneath. sm+ keeps the
            // desktop single-row grid.
            <div className="flex flex-col gap-1.5 sm:gap-0" key={s.uid}>
              <div className="flex items-center gap-2">
                <button
                  aria-label={`Set type: ${SET_TYPE_LABEL[s.setType]} (tap to change)`}
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-md border font-medium text-sm transition-colors sm:size-8 sm:text-xs",
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

                {kind !== "timed" && (
                  <Input
                    aria-label={`Weight (${unit})`}
                    className="h-11 flex-1 px-2 text-center sm:h-9"
                    inputMode="decimal"
                    onChange={(e) =>
                      onUpdateSet(s.uid, { weight: e.target.value })
                    }
                    placeholder={weightGhost}
                    value={s.weight}
                  />
                )}

                <Input
                  aria-label={kind === "timed" ? "Seconds" : "Reps"}
                  className="h-11 flex-1 px-2 text-center sm:h-9"
                  inputMode="numeric"
                  onChange={(e) => onUpdateSet(s.uid, { reps: e.target.value })}
                  placeholder={repsGhost}
                  value={s.reps}
                />

                <Input
                  aria-label="RPE"
                  className="hidden h-9 w-11 px-1 text-center sm:block"
                  inputMode="decimal"
                  onChange={(e) => onUpdateSet(s.uid, { rpe: e.target.value })}
                  placeholder="–"
                  value={s.rpe}
                />

                <button
                  aria-label={s.completed ? "Mark not done" : "Mark done"}
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-md border transition-colors sm:size-8",
                    s.completed
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "border-border text-muted-foreground hover:bg-accent"
                  )}
                  onClick={() => {
                    // Checking off an empty set adopts its ghost numbers (the
                    // Hevy flow: did what was planned → one tap logs it). Only
                    // plain numbers adopt; a range target like "4-6" stays a
                    // placeholder for the member to type over.
                    const patch: Partial<EditorSet> = {
                      completed: !s.completed,
                    };
                    if (!s.completed && ghost) {
                      if (
                        kind !== "timed" &&
                        !s.weight.trim() &&
                        isNumeric(ghost.weight)
                      ) {
                        patch.weight = ghost.weight;
                      }
                      if (!s.reps.trim() && isNumeric(ghost.reps)) {
                        patch.reps = ghost.reps;
                      }
                    }
                    onUpdateSet(s.uid, patch);
                  }}
                  type="button"
                >
                  <Check className="size-5 sm:size-4" />
                </button>

                <button
                  aria-label="Remove set"
                  className="hidden size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:flex"
                  onClick={() => onRemoveSet(s.uid)}
                  type="button"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {/* Phone-only second line: the optional/rare controls, labeled
                  in plain words so nothing needs decoding or a precise tap. */}
              <div className="flex items-center justify-between pl-[52px] sm:hidden">
                <label className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  RPE (effort 1-10, optional)
                  <Input
                    aria-label="RPE"
                    className="h-9 w-12 px-1 text-center"
                    inputMode="decimal"
                    onChange={(e) =>
                      onUpdateSet(s.uid, { rpe: e.target.value })
                    }
                    placeholder="–"
                    value={s.rpe}
                  />
                </label>
                <button
                  className="flex h-9 items-center gap-1 rounded-md px-2 text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => onRemoveSet(s.uid)}
                  type="button"
                >
                  <X className="size-3.5" />
                  Remove set
                </button>
              </div>
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
