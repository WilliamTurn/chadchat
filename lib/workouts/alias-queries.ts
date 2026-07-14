import "server-only";

import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db/queries";
import { type ExerciseAlias, exerciseAlias } from "@/lib/db/schema";

/**
 * FIX-34 exercise-alias queries. A NEW module (rule 2: queries.ts is P34-C's)
 * for the ExerciseAlias table. Only "approved" rows ever participate in
 * resolution; proposing and deciding are separate steps so nothing merges a
 * member's records without an explicit approval on file.
 *
 * Uses the shared db handle (FIX-33 consolidation; this module used to open
 * its own pg pool, the P34-E/P34-Z auditor note).
 */

/**
 * The approved alias map a member's stats resolution consumes: global rows
 * (userId null) overlaid by the member's own rows (member wins on a key
 * collision). Keys are already normalized (normalizeExerciseKey) at write time.
 */
export async function getApprovedExerciseAliases(
  userId: string
): Promise<Map<string, string>> {
  const rows = await db
    .select()
    .from(exerciseAlias)
    .where(
      and(
        eq(exerciseAlias.status, "approved"),
        or(isNull(exerciseAlias.userId), eq(exerciseAlias.userId, userId))
      )
    );
  const map = new Map<string, string>();
  for (const row of rows.filter((r) => r.userId === null)) {
    map.set(row.alias, row.canonicalName);
  }
  for (const row of rows.filter((r) => r.userId !== null)) {
    map.set(row.alias, row.canonicalName);
  }
  return map;
}

/** Propose a member-scoped alias (status "proposed"; resolution ignores it). */
export async function proposeExerciseAlias(input: {
  userId: string | null;
  alias: string;
  canonicalName: string;
  source: "curated" | "member";
  confidence?: "high" | "medium";
}): Promise<ExerciseAlias> {
  const [row] = await db
    .insert(exerciseAlias)
    .values({ ...input, status: "proposed" })
    .returning();
  return row;
}

/** Decide a proposed alias. Approval is what lets it participate in resolution. */
export async function decideExerciseAlias(
  id: string,
  status: "approved" | "rejected"
): Promise<void> {
  await db
    .update(exerciseAlias)
    .set({ status, decidedAt: new Date() })
    .where(eq(exerciseAlias.id, id));
}
