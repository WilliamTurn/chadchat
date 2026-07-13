import { createHash } from "node:crypto";
import type { PlanDay } from "@/lib/validation/plan-days";

/**
 * The staleness guard for materialized plan schedules (FIX-28 / DEC-06).
 * PlanSession rows store the hash of the `Plan.days` json they were
 * materialized from; when a plan edit changes the json, the stored hash no
 * longer matches and lib/db/plan-goal-queries.ts re-materializes. Server-only
 * (node:crypto); the pure schedule logic lives in lib/plans/schedule.ts.
 */
export function hashPlanDays(days: PlanDay[]): string {
  return createHash("sha256").update(JSON.stringify(days)).digest("hex");
}
