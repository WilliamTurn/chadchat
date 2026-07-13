/**
 * P34-Z fix-verify DB inspector (read-only). Reports the full structured-plan
 * footprint for one plan so the browser tests can assert exact counts.
 *   npx tsx scripts/p34z-fixverify-dbcheck.ts --title "P34-D Verification Split (safe to delete)"
 *   npx tsx scripts/p34z-fixverify-dbcheck.ts --plan <planId>
 * Emits a single JSON blob on the last line (prefixed RESULT=) for easy parsing.
 */
import { config } from "dotenv";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  plan,
  planSession,
  planSessionCompletion,
  planSessionExercise,
  planSessionSet,
  user,
} from "../lib/db/schema";

config({ path: ".env.local" });

const TEST_EMAIL = "claude-testing@example.com";

async function main() {
  const client = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
  const db = drizzle(client);

  const titleIdx = process.argv.indexOf("--title");
  const planIdx = process.argv.indexOf("--plan");
  let planId: string | null = planIdx >= 0 ? process.argv[planIdx + 1] : null;

  if (!planId && titleIdx >= 0) {
    const title = process.argv[titleIdx + 1];
    const [tester] = await db.select({ id: user.id }).from(user).where(eq(user.email, TEST_EMAIL)).limit(1);
    const rows = await db
      .select({ id: plan.id })
      .from(plan)
      .where(and(eq(plan.userId, tester.id), eq(plan.title, title)));
    planId = rows[0]?.id ?? null;
  }

  const result: any = { planId };
  if (!planId) {
    console.log("RESULT=" + JSON.stringify({ planId: null, planExists: false }));
    await client.end();
    return;
  }

  const planRows = await db.select({ id: plan.id, status: plan.status }).from(plan).where(eq(plan.id, planId));
  result.planExists = planRows.length > 0;
  result.planStatus = planRows[0]?.status ?? null;

  const sessions = await db
    .select({ id: planSession.id, position: planSession.position, name: planSession.name, active: planSession.active })
    .from(planSession)
    .where(eq(planSession.planId, planId));
  result.sessionCount = sessions.length;

  const sessionIds = sessions.map((s) => s.id);
  const exercises = sessionIds.length
    ? await db
        .select({ id: planSessionExercise.id, planSessionId: planSessionExercise.planSessionId, name: planSessionExercise.exerciseName, position: planSessionExercise.position })
        .from(planSessionExercise)
        .where(inArray(planSessionExercise.planSessionId, sessionIds))
    : [];
  const exerciseIds = exercises.map((e) => e.id);
  const sets = exerciseIds.length
    ? await db
        .select({ id: planSessionSet.id, planSessionExerciseId: planSessionSet.planSessionExerciseId })
        .from(planSessionSet)
        .where(inArray(planSessionSet.planSessionExerciseId, exerciseIds))
    : [];
  result.totalExerciseRows = exercises.length;
  result.totalSetRows = sets.length;

  result.perSession = sessions
    .sort((a, b) => a.position - b.position)
    .map((s) => {
      const exs = exercises.filter((e) => e.planSessionId === s.id).sort((a, b) => a.position - b.position);
      const exIds = new Set(exs.map((e) => e.id));
      const setCount = sets.filter((x) => exIds.has(x.planSessionExerciseId)).length;
      const names = exs.map((e) => e.name);
      const dupNames = names.filter((n, i) => names.indexOf(n) !== i);
      return {
        position: s.position,
        name: s.name,
        active: s.active,
        exerciseRows: exs.length,
        setRows: setCount,
        duplicateExerciseNames: dupNames,
      };
    });

  const completions = await db
    .select({ id: planSessionCompletion.id, workoutId: planSessionCompletion.workoutId, sessionName: planSessionCompletion.sessionName })
    .from(planSessionCompletion)
    .where(eq(planSessionCompletion.planId, planId));
  result.completionCount = completions.length;
  result.completions = completions;

  console.log(JSON.stringify(result, null, 2));
  console.log("RESULT=" + JSON.stringify(result));
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
