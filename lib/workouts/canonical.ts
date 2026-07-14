import "server-only";

import { getCustomExercisesByUserId } from "@/lib/db/queries";
import { getApprovedExerciseAliases } from "./alias-queries";
import type { ResolveOptions } from "./exercise-identity";

/**
 * THE server wiring point for exercise-identity resolution (FIX-33 consuming
 * FIX-34). One place fetches a member's ResolveOptions (their own custom
 * exercises, which are never folded, plus their approved alias rows), so
 * every analytics surface canonicalizes with identical inputs and two pages
 * can never disagree about what merged. Read-time only; nothing here writes.
 * Call sites that already hold the member's customs build the options inline
 * with `getApprovedExerciseAliases` instead of double-fetching through this.
 */
export async function getResolveOptions(userId: string): Promise<ResolveOptions> {
  const [customs, memberAliases] = await Promise.all([
    getCustomExercisesByUserId(userId),
    getApprovedExerciseAliases(userId),
  ]);
  return {
    memberCustomNames: customs.map((c) => c.name),
    memberAliases,
  };
}
