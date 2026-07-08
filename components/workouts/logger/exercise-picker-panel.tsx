"use client";

import { ArrowLeft, Check, History, Pencil, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BUILT_IN_EXERCISES,
  EQUIPMENT_LABELS,
  type Equipment,
  EXERCISE_KIND_LABELS,
  exerciseKind,
  type ExerciseKind,
  type MuscleGroup,
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUPS,
} from "@/lib/workouts/exercise-library";
import type { LastExerciseLog } from "@/lib/workouts/stats";
import { cn } from "@/lib/utils";
import type { CustomExerciseRow } from "./model";

export type PickedExercise = {
  name: string;
  muscleGroup: string | null;
  kind: ExerciseKind | null;
};

type LibraryRow = {
  name: string;
  muscleGroup: string;
  equipment: string;
  kind: ExerciseKind;
  custom: CustomExerciseRow | null;
};

/**
 * The full-page exercise picker (MOB-18): a section of the logger page, never
 * a dialog stacked on a dialog. Search + muscle-group and equipment filters +
 * a "Recently trained" shelf, and (the Hevy behavior) MULTI-select: tap
 * several exercises, add them all at once. Replace mode picks exactly one.
 */
export function ExercisePickerPanel({
  customExercises,
  lastSets,
  replaceTarget,
  onAdd,
  onBack,
  onCreateCustom,
  onEditCustom,
}: {
  customExercises: CustomExerciseRow[];
  lastSets: Record<string, LastExerciseLog>;
  /** Present = single-pick replace mode for this exercise name. */
  replaceTarget: string | null;
  onAdd: (picked: PickedExercise[]) => void;
  onBack: () => void;
  /** Open the create-custom form (also a page view), seeded from the search. */
  onCreateCustom: (seedName: string) => void;
  onEditCustom: (row: CustomExerciseRow) => void;
}) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [selected, setSelected] = useState<Map<string, PickedExercise>>(
    new Map()
  );
  const searchRef = useRef<HTMLInputElement>(null);
  const replacing = replaceTarget != null;

  // Desktop gets instant type-to-search; phones never get an uninvited
  // keyboard (the NUT-27b rule).
  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) {
      searchRef.current?.focus();
    }
  }, []);

  const all = useMemo<LibraryRow[]>(() => {
    const merged: LibraryRow[] = [
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
  const filtered = all.filter(
    (e) =>
      (!q || e.name.toLowerCase().includes(q)) &&
      (!muscle || e.muscleGroup === muscle) &&
      (!equipment || e.equipment === equipment)
  );

  // "Recently trained": the exercises with logged history, newest first,
  // what you actually do, one tap away. Hidden while searching/filtering.
  const recents = useMemo(() => {
    if (q || muscle || equipment) {
      return [];
    }
    const byKey = new Map(all.map((e) => [e.name.toLowerCase(), e]));
    return Object.entries(lastSets)
      .sort(
        (a, b) =>
          new Date(b[1].performedAt).getTime() -
          new Date(a[1].performedAt).getTime()
      )
      .map(([key]) => byKey.get(key))
      .filter((e): e is LibraryRow => e != null)
      .slice(0, 8);
  }, [all, lastSets, q, muscle, equipment]);

  const grouped = useMemo(() => {
    const groups = new Map<string, LibraryRow[]>();
    for (const e of filtered) {
      const list = groups.get(e.muscleGroup) ?? [];
      list.push(e);
      groups.set(e.muscleGroup, list);
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  function toggle(e: LibraryRow) {
    const picked: PickedExercise = {
      name: e.name,
      muscleGroup: e.muscleGroup,
      kind: e.kind,
    };
    if (replacing) {
      onAdd([picked]);
      return;
    }
    setSelected((prev) => {
      const next = new Map(prev);
      const key = e.name.toLowerCase();
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.set(key, picked);
      }
      return next;
    });
  }

  function Row({ e }: { e: LibraryRow }) {
    const isSelected = selected.has(e.name.toLowerCase());
    return (
      <div
        className={cn(
          "group flex w-full items-center gap-1 rounded-lg transition-colors",
          isSelected ? "bg-blood/10" : "hover:bg-accent"
        )}
      >
        <button
          className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 px-2.5 py-2 text-left text-sm"
          onClick={() => toggle(e)}
          type="button"
        >
          <span className="flex min-w-0 items-center gap-2">
            {!replacing && (
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                  isSelected
                    ? "border-blood bg-blood text-white"
                    : "border-border text-transparent"
                )}
              >
                <Check className="size-3.5" />
              </span>
            )}
            <span className="truncate">{e.name}</span>
          </span>
          <span className="shrink-0 text-muted-foreground text-xs">
            {EQUIPMENT_LABELS[e.equipment as Equipment] ?? e.equipment}
            {e.kind !== "weighted" ? ` · ${EXERCISE_KIND_LABELS[e.kind]}` : ""}
            {e.custom ? " · Custom" : ""}
          </span>
        </button>
        {e.custom ? (
          <Button
            aria-label={`Edit ${e.name}`}
            className="mr-1 size-9 shrink-0 text-muted-foreground"
            onClick={() => onEditCustom(e.custom as CustomExerciseRow)}
            size="icon"
            type="button"
            variant="ghost"
          >
            <Pencil className="size-3.5" />
          </Button>
        ) : null}
      </div>
    );
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
          Back to your workout
        </button>
        <h1 className="font-semibold text-2xl tracking-tight">
          {replacing ? `Replace ${replaceTarget}` : "Add exercises"}
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          {replacing
            ? "Pick the exercise to swap in. Your sets and typed numbers carry over."
            : "Tap every exercise you want, then add them all at once."}
        </p>
      </div>

      <div className="relative">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
        <Input
          className="h-11 pl-9"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises…"
          ref={searchRef}
          value={query}
        />
      </div>

      {/* Filters: two plain dropdowns, the standard pro-app pattern. */}
      <div className="grid grid-cols-2 gap-2">
        <Select
          onValueChange={(v) => setMuscle(v === "all" ? null : (v as MuscleGroup))}
          value={muscle ?? "all"}
        >
          <SelectTrigger
            aria-label="Filter by muscle group"
            className="h-11 w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All muscles</SelectItem>
            {MUSCLE_GROUPS.map((m) => (
              <SelectItem key={m} value={m}>
                {MUSCLE_GROUP_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          onValueChange={(v) =>
            setEquipment(v === "all" ? null : (v as Equipment))
          }
          value={equipment ?? "all"}
        >
          <SelectTrigger
            aria-label="Filter by equipment"
            className="h-11 w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All equipment</SelectItem>
            {(Object.keys(EQUIPMENT_LABELS) as Equipment[]).map((eq) => (
              <SelectItem key={eq} value={eq}>
                {EQUIPMENT_LABELS[eq]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {recents.length > 0 && (
        <div>
          <div className="mb-1 flex items-center gap-1.5 px-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
            <History className="size-3.5" />
            Recently trained
          </div>
          {recents.map((e) => (
            <Row e={e} key={`recent-${e.name}`} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {grouped.length === 0 ? (
          <p className="px-2 py-8 text-center text-muted-foreground text-sm">
            No matches in the library. Create it below and it's saved to your
            own exercise list.
          </p>
        ) : (
          grouped.map(([group, items]) => (
            <div key={group}>
              <div className="mb-1 px-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
                {MUSCLE_GROUP_LABELS[group as MuscleGroup] ?? group}
              </div>
              {items.map((e) => (
                <Row e={e} key={`${e.name}-${e.muscleGroup}`} />
              ))}
            </div>
          ))
        )}

        <Button
          className="w-full gap-1.5"
          onClick={() => onCreateCustom(query.trim())}
          type="button"
          variant="outline"
        >
          <Plus className="size-4" />
          {q
            ? `Create "${query.trim()}" as a custom exercise`
            : "Create a custom exercise"}
        </Button>
      </div>

      {/* Sticky add bar (multi-select mode): always reachable however deep
          the list scroll goes. */}
      {!replacing && (
        <div className="sticky bottom-0 z-30 -mx-4 border-border border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground text-sm">
              {selected.size === 0
                ? "Nothing selected yet"
                : `${selected.size} exercise${selected.size === 1 ? "" : "s"} selected`}
            </span>
            <Button
              className="gap-1.5"
              disabled={selected.size === 0}
              onClick={() => onAdd([...selected.values()])}
              type="button"
            >
              <Plus className="size-4" />
              Add to workout
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
