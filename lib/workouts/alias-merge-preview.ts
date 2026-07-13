/**
 * FIX-34 alias merge PREVIEW. Pure computation of what the canonical-identity
 * resolution would change for one member: which logged names fold into which
 * canonical exercise, how many logged exercise rows are affected, and the
 * before/after personal-record reconciliation. Read-only by construction;
 * it never writes anywhere; the runner script feeds it real data and saves
 * the output as the owner-approval artifact.
 */

import {
  type AliasConfidence,
  canonicalizeWorkouts,
  canonicalSlug,
  normalizeExerciseKey,
  type ResolveOptions,
  resolveExerciseIdentity,
} from "./exercise-identity";
import {
  computePersonalRecords,
  type PersonalRecord,
  type WorkoutData,
} from "./stats";

export type AliasMergeMember = {
  /** The name as logged (first-seen casing). */
  rawName: string;
  matchedVia: "built-in" | "curated-alias" | "member-alias" | "unmatched";
  confidence?: AliasConfidence;
  /** How many logged WorkoutExercise rows carry this raw name. */
  exerciseRowCount: number;
};

export type AliasMergeGroup = {
  canonicalName: string;
  slug: string;
  members: AliasMergeMember[];
  /** Records as they stand today: one split row per raw name. */
  recordsBefore: PersonalRecord[];
  /** The single reconciled record after resolution. */
  recordAfter: PersonalRecord | null;
};

export type CustomShadow = {
  /** The member's own custom exercise name. */
  customName: string;
  /** Where the curated set would have folded it; informational only. */
  wouldHaveMergedInto: string;
};

export type AliasMergePreview = {
  /** Only canonical identities where resolution actually changes grouping. */
  groups: AliasMergeGroup[];
  /** Member customs shadowing a curated alias; NEVER merged, listed for review. */
  customShadows: CustomShadow[];
  totalDistinctNames: number;
  untouchedNameCount: number;
};

/**
 * Build the merge preview for one member's workout history. `opts` carries the
 * member's custom-exercise names (exclusion set) and any approved member
 * aliases, exactly as live resolution would receive them.
 */
export function buildAliasMergePreview(
  workouts: WorkoutData[],
  opts: ResolveOptions = {}
): AliasMergePreview {
  // Distinct raw names with logged-row counts, first-seen casing.
  const rawNames = new Map<string, { display: string; count: number }>();
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const key = normalizeExerciseKey(ex.name);
      if (!key) {
        continue;
      }
      const entry = rawNames.get(key) ?? { display: ex.name.trim(), count: 0 };
      entry.count++;
      rawNames.set(key, entry);
    }
  }

  // Group raw names by the canonical identity they resolve to.
  const byCanonical = new Map<
    string,
    { canonicalName: string; members: AliasMergeMember[] }
  >();
  for (const [key, entry] of rawNames) {
    const res = resolveExerciseIdentity(entry.display, opts);
    const group = byCanonical.get(res.canonicalKey) ?? {
      canonicalName: res.canonicalName,
      members: [],
    };
    group.members.push({
      rawName: entry.display,
      matchedVia: res.matchedVia === "member-custom" ? "unmatched" : res.matchedVia,
      confidence: res.confidence,
      exerciseRowCount: entry.count,
    });
    byCanonical.set(res.canonicalKey, group);
  }

  // A group is a MERGE when resolution changes anything: several raw names
  // now share one identity, or a single raw name maps onto a different
  // canonical name than it was logged under.
  const recordsBefore = computePersonalRecords(workouts);
  const recordsAfter = computePersonalRecords(canonicalizeWorkouts(workouts, opts));
  const beforeByKey = new Map(
    recordsBefore.map((r) => [normalizeExerciseKey(r.exerciseName), r])
  );
  const afterByKey = new Map(
    recordsAfter.map((r) => [normalizeExerciseKey(r.exerciseName), r])
  );

  const groups: AliasMergeGroup[] = [];
  let untouched = 0;
  for (const [canonicalKey, group] of byCanonical) {
    const isMerge =
      group.members.length > 1 ||
      group.members.some(
        (m) => normalizeExerciseKey(m.rawName) !== canonicalKey
      );
    if (!isMerge) {
      untouched++;
      continue;
    }
    groups.push({
      canonicalName: group.canonicalName,
      slug: canonicalSlug(group.canonicalName),
      members: group.members.sort((a, b) => b.exerciseRowCount - a.exerciseRowCount),
      recordsBefore: group.members
        .map((m) => beforeByKey.get(normalizeExerciseKey(m.rawName)))
        .filter((r): r is PersonalRecord => r != null),
      recordAfter: afterByKey.get(canonicalKey) ?? null,
    });
  }

  // Customs that the curated set WOULD have folded were they not protected.
  const customShadows: CustomShadow[] = [];
  for (const customName of opts.memberCustomNames ?? []) {
    const unprotected = resolveExerciseIdentity(customName, {});
    if (unprotected.canonicalKey !== normalizeExerciseKey(customName)) {
      customShadows.push({
        customName,
        wouldHaveMergedInto: unprotected.canonicalName,
      });
    }
  }

  return {
    groups: groups.sort((a, b) => a.canonicalName.localeCompare(b.canonicalName)),
    customShadows,
    totalDistinctNames: rawNames.size,
    untouchedNameCount: untouched,
  };
}
