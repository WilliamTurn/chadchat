/**
 * P34-Z DB check. Reports the structured-path state for the seeded plan
 * "Chad's Training Plan" (id 07cf1686-...): every PlanSessionCompletion row
 * plus the PlanSession row count. Read-only by default.
 *
 *   npx tsx scripts/p34z-db-check.ts             # print rows + counts
 *   npx tsx scripts/p34z-db-check.ts --replay     # idempotency probe: re-insert
 *       every existing completion (onConflictDoNothing target = workoutId) and
 *       re-print, proving a double-submit cannot create a second row.
 */

import { config } from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { planSession, planSessionCompletion } from "../lib/db/schema";

config({ path: ".env.local" });

const PLAN_ID = "07cf1686-d738-4336-b183-ad9b2a330200";

async function main() {
  const client = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
  const db = drizzle(client);

  const sessions = await db
    .select({ id: planSession.id, position: planSession.position, name: planSession.name })
    .from(planSession)
    .where(eq(planSession.planId, PLAN_ID));
  console.log(`PlanSession rows for plan ${PLAN_ID}: ${sessions.length}`);
  for (const s of sessions.sort((a, b) => a.position - b.position)) {
    console.log(`  [pos ${s.position}] ${s.name}  (id ${s.id})`);
  }

  const completions = await db
    .select()
    .from(planSessionCompletion)
    .where(eq(planSessionCompletion.planId, PLAN_ID));
  console.log(`\nPlanSessionCompletion rows for plan ${PLAN_ID}: ${completions.length}`);
  for (const c of completions) {
    console.log(
      `  id=${c.id} workoutId=${c.workoutId} planSessionId=${c.planSessionId} sessionName="${c.sessionName}" completedDay=${new Date(c.completedDay).toISOString()}`
    );
  }

  if (process.argv.includes("--replay")) {
    console.log(`\n--replay: re-inserting ${completions.length} completion(s) with onConflictDoNothing(workoutId)...`);
    for (const c of completions) {
      await db
        .insert(planSessionCompletion)
        .values({
          userId: c.userId,
          planId: c.planId,
          planSessionId: c.planSessionId,
          workoutId: c.workoutId,
          sessionName: c.sessionName,
          completedDay: c.completedDay,
        })
        .onConflictDoNothing({ target: planSessionCompletion.workoutId });
    }
    const after = await db
      .select({ id: planSessionCompletion.id, workoutId: planSessionCompletion.workoutId })
      .from(planSessionCompletion)
      .where(eq(planSessionCompletion.planId, PLAN_ID));
    console.log(`After replay, PlanSessionCompletion rows for plan: ${after.length}`);
    for (const c of after) {
      console.log(`  id=${c.id} workoutId=${c.workoutId}`);
    }
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
