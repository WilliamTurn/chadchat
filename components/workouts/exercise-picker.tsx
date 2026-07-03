"use client";

import { Pencil, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  BUILT_IN_EXERCISES,
  EQUIPMENT_LABELS,
  type Equipment,
  EXERCISE_KIND_LABELS,
  exerciseKind,
  type ExerciseKind,
  type MuscleGroup,
  MUSCLE_GROUP_LABELS,
} from "@/lib/workouts/exercise-library";
import { CustomExerciseDialog } from "./custom-exercise-dialog";

export type PickedExercise = {
  name: string;
  muscleGroup: string | null;
  kind: ExerciseKind | null;
};

type CustomExerciseRow = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  kind: string;
  notes: string | null;
};

export function ExercisePicker({
  open,
  onOpenChange,
  onPick,
  customExercises,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (exercise: PickedExercise) => void;
  customExercises: CustomExerciseRow[];
}) {
  const [query, setQuery] = useState("");
  // The create/edit dialog: "create" seeds the name from the search text;
  // a row object means edit that custom exercise.
  const [editorState, setEditorState] = useState<
    { mode: "create" } | { mode: "edit"; row: CustomExerciseRow } | null
  >(null);

  const all = useMemo(() => {
    const merged = [
      ...BUILT_IN_EXERCISES.map((e) => ({
        name: e.name,
        muscleGroup: e.muscleGroup as string,
        equipment: e.equipment as string,
        kind: exerciseKind(e),
        custom: null as CustomExerciseRow | null,
      })),
      ...customExercises.map((e) => ({
        name: e.name,
        muscleGroup: e.muscleGroup,
        equipment: e.equipment,
        kind: exerciseKind(e),
        custom: e,
      })),
    ];
    // De-dupe by name (a custom exercise that matches a built-in name).
    const seen = new Set<string>();
    return merged.filter((e) => {
      const key = e.name.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }, [customExercises]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? all.filter((e) => e.name.toLowerCase().includes(q))
    : all;

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof filtered>();
    for (const e of filtered) {
      const list = groups.get(e.muscleGroup) ?? [];
      list.push(e);
      groups.set(e.muscleGroup, list);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  function pick(exercise: PickedExercise) {
    onPick(exercise);
    setQuery("");
    onOpenChange(false);
  }

  return (
    <>
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="border-border border-b px-4 py-3">
            <DialogTitle>Add exercise</DialogTitle>
          </DialogHeader>

          <div className="border-border border-b px-4 py-3">
            <div className="relative">
              <Search className="-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-muted-foreground" />
              <Input
                autoFocus
                className="pl-8"
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search exercises…"
                value={query}
              />
            </div>
          </div>

          <div className="max-h-[45vh] overflow-y-auto px-2 py-2">
            {grouped.length === 0 ? (
              <p className="px-2 py-6 text-center text-muted-foreground text-sm">
                No matches in the library. Create it below.
              </p>
            ) : (
              grouped.map(([group, items]) => (
                <div className="mb-2" key={group}>
                  <div className="px-2 py-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                    {MUSCLE_GROUP_LABELS[group as MuscleGroup] ?? group}
                  </div>
                  {items.map((e) => (
                    <div
                      className="group flex w-full items-center gap-1 rounded-md transition-colors hover:bg-accent"
                      key={`${e.name}-${e.muscleGroup}`}
                    >
                      <button
                        className="flex min-w-0 flex-1 items-center justify-between gap-2 px-2 py-2 text-left text-sm"
                        onClick={() =>
                          pick({
                            name: e.name,
                            muscleGroup: e.muscleGroup,
                            kind: e.kind,
                          })
                        }
                        type="button"
                      >
                        <span className="truncate">{e.name}</span>
                        <span className="shrink-0 text-muted-foreground text-xs">
                          {EQUIPMENT_LABELS[e.equipment as Equipment] ??
                            e.equipment}
                          {e.kind !== "weighted"
                            ? ` · ${EXERCISE_KIND_LABELS[e.kind]}`
                            : ""}
                          {e.custom ? " · Custom" : ""}
                        </span>
                      </button>
                      {e.custom ? (
                        <Button
                          aria-label={`Edit ${e.name}`}
                          className="mr-1 size-7 shrink-0 text-muted-foreground"
                          onClick={() =>
                            setEditorState({ mode: "edit", row: e.custom! })
                          }
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>

          {/* Create-custom affordance — opens the full pro-app form (DSH-53). */}
          <div className="border-border border-t bg-muted/30 px-4 py-3">
            <Button
              className="w-full gap-1.5"
              onClick={() => setEditorState({ mode: "create" })}
              size="sm"
              type="button"
              variant="outline"
            >
              <Plus className="size-3.5" />
              {q
                ? `Create "${query.trim()}" as a custom exercise`
                : "Create a custom exercise"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CustomExerciseDialog
        defaultName={editorState?.mode === "create" ? query.trim() : undefined}
        initial={editorState?.mode === "edit" ? editorState.row : null}
        onOpenChange={(o) => {
          if (!o) {
            setEditorState(null);
          }
        }}
        onSaved={(saved) => {
          // Creating from the picker means "I want to log this now" — add it
          // to the workout immediately, like the old create-and-add flow.
          if (editorState?.mode === "create") {
            pick({
              name: saved.name,
              muscleGroup: saved.muscleGroup,
              kind: saved.kind,
            });
          }
        }}
        open={editorState != null}
      />
    </>
  );
}
