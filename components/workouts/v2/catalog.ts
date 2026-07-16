// Merge the built-in exercise library with the member's custom exercises into
// one pickable catalog. Identity everywhere is the exercise NAME
// (case-insensitive), the same convention the logged history uses.

import type { CustomExercise } from "@/lib/db/schema";
import {
  BUILT_IN_EXERCISES,
  EQUIPMENT_LABELS,
  exerciseKind,
  MUSCLE_GROUP_LABELS,
} from "@/lib/workouts/exercise-library";
import type { ExerciseRef } from "./types";

/** The serializable slice of a CustomExercise row pages pass to the client. */
export type CustomExerciseData = Pick<
  CustomExercise,
  "id" | "name" | "muscleGroup" | "equipment" | "kind" | "notes"
>;

export function toCustomExerciseData(row: CustomExercise): CustomExerciseData {
  return {
    id: row.id,
    name: row.name,
    muscleGroup: row.muscleGroup,
    equipment: row.equipment,
    kind: row.kind,
    notes: row.notes,
  };
}

/** Built-ins + the member's own exercises. Customs win on a name collision
 * and sort first (your gym's cable stack beats the generic entry). */
export function mergeCatalog(customs: CustomExerciseData[]): ExerciseRef[] {
  const taken = new Set(customs.map((c) => c.name.trim().toLowerCase()));
  // Identity = name, so identical-named customs (legacy rows created before
  // duplicate names were refused) collapse to ONE entry; rendering all three
  // made selecting one appear to select them all (flaws XPK-14).
  const seenCustom = new Set<string>();
  const customRefs: ExerciseRef[] = [];
  for (const c of customs) {
    const key = c.name.trim().toLowerCase();
    if (seenCustom.has(key)) {
      continue;
    }
    seenCustom.add(key);
    customRefs.push({
      name: c.name,
      muscleGroup: c.muscleGroup,
      equipment: c.equipment,
      kind: exerciseKind(c),
      custom: true,
    });
  }
  const builtInRefs: ExerciseRef[] = BUILT_IN_EXERCISES.filter(
    (e) => !taken.has(e.name.toLowerCase())
  ).map((e) => ({
    name: e.name,
    muscleGroup: e.muscleGroup,
    equipment: e.equipment,
    kind: exerciseKind(e),
  }));
  return [...customRefs, ...builtInRefs].sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

/** Find one catalog entry by name (case-insensitive). */
export function findInCatalog(
  catalog: ExerciseRef[],
  name: string
): ExerciseRef | undefined {
  const key = name.trim().toLowerCase();
  return catalog.find((e) => e.name.trim().toLowerCase() === key);
}

/** Human label for a muscle-group value, tolerating history's free text. */
export function muscleLabel(value: string | null): string {
  if (!value) {
    return "";
  }
  return (
    MUSCLE_GROUP_LABELS[value as keyof typeof MUSCLE_GROUP_LABELS] ??
    value.charAt(0).toUpperCase() + value.slice(1)
  );
}

/** Human label for an equipment value. */
export function equipmentLabel(value: string | null): string {
  if (!value) {
    return "";
  }
  return (
    EQUIPMENT_LABELS[value as keyof typeof EQUIPMENT_LABELS] ??
    value.charAt(0).toUpperCase() + value.slice(1)
  );
}

/** URL slug for an exercise detail page (identity = name). */
export function exerciseSlug(name: string): string {
  return encodeURIComponent(name);
}
