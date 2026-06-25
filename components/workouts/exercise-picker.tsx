"use client";

import { Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { addCustomExercise } from "@/app/workouts/actions";
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
  BUILT_IN_EXERCISES,
  EQUIPMENT,
  EQUIPMENT_LABELS,
  type Equipment,
  type MuscleGroup,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUPS,
} from "@/lib/workouts/exercise-library";

export type PickedExercise = { name: string; muscleGroup: string | null };

type CustomExerciseRow = {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
};

const selectClass =
  "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [newMuscle, setNewMuscle] = useState<MuscleGroup>("other");
  const [newEquipment, setNewEquipment] = useState<Equipment>("other");
  const [pending, startTransition] = useTransition();

  const all = useMemo(() => {
    const merged = [
      ...BUILT_IN_EXERCISES.map((e) => ({
        name: e.name,
        muscleGroup: e.muscleGroup as string,
        custom: false,
      })),
      ...customExercises.map((e) => ({
        name: e.name,
        muscleGroup: e.muscleGroup,
        custom: true,
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

  const exactMatch = all.some((e) => e.name.toLowerCase() === q);

  function pick(exercise: PickedExercise) {
    onPick(exercise);
    setQuery("");
    onOpenChange(false);
  }

  function createAndPick() {
    const name = query.trim();
    if (!name) {
      toast.error("Type a name first.");
      return;
    }
    startTransition(async () => {
      const result = await addCustomExercise({
        name,
        muscleGroup: newMuscle,
        equipment: newEquipment,
      });
      if (result.ok) {
        toast.success("Exercise added to your library.");
        router.refresh();
        pick({ name, muscleGroup: newMuscle });
        setCreating(false);
      } else {
        toast.error(result.error ?? "Couldn't add that exercise.");
      }
    });
  }

  return (
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
                  <button
                    className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent"
                    key={`${e.name}-${e.muscleGroup}`}
                    onClick={() => pick({ name: e.name, muscleGroup: e.muscleGroup })}
                    type="button"
                  >
                    <span>{e.name}</span>
                    {e.custom ? (
                      <span className="text-muted-foreground text-xs">Custom</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Create-custom affordance */}
        <div className="border-border border-t bg-muted/30 px-4 py-3">
          {creating || (q && !exactMatch) ? (
            <div className="flex flex-col gap-3">
              <p className="text-muted-foreground text-xs">
                Create{" "}
                <span className="font-medium text-foreground">
                  {query.trim() || "a new exercise"}
                </span>{" "}
                and add it to your library.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs" htmlFor="new-ex-muscle">
                    Muscle
                  </Label>
                  <select
                    className={selectClass}
                    id="new-ex-muscle"
                    onChange={(e) => setNewMuscle(e.target.value as MuscleGroup)}
                    value={newMuscle}
                  >
                    {MUSCLE_GROUPS.map((m) => (
                      <option key={m} value={m}>
                        {MUSCLE_GROUP_LABELS[m]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs" htmlFor="new-ex-equip">
                    Equipment
                  </Label>
                  <select
                    className={selectClass}
                    id="new-ex-equip"
                    onChange={(e) => setNewEquipment(e.target.value as Equipment)}
                    value={newEquipment}
                  >
                    {EQUIPMENT.map((eq) => (
                      <option key={eq} value={eq}>
                        {EQUIPMENT_LABELS[eq]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                className="gap-1.5"
                disabled={pending || !query.trim()}
                onClick={createAndPick}
                size="sm"
                type="button"
              >
                <Plus className="size-3.5" />
                {pending ? "Adding…" : "Create & add"}
              </Button>
            </div>
          ) : (
            <Button
              className="w-full gap-1.5"
              onClick={() => setCreating(true)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Plus className="size-3.5" />
              Create a custom exercise
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
