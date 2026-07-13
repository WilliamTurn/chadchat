/**
 * P34-Z GATE-03/04 DB check. READ-ONLY.
 * Reports:
 *   1. Whether the wave's additive tables exist in the shared Neon DB.
 *   2. Every UserTargetVersion row of kind 'water' for the Pro test account,
 *      newest first (proof of the FIX-07 append-only funnel after a UI goal change).
 *
 *   npx tsx scripts/p34z-gate03-db-check.ts
 */
import { config } from "dotenv";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { user, userTargetVersion } from "../lib/db/schema";

config({ path: ".env.local" });

const TEST_EMAIL = "claude-testing@example.com";

async function main() {
  const client = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
  const db = drizzle(client);

  const tables = await client`
    select table_name from information_schema.tables
    where table_name in ('UserTargetVersion','NutritionTargetVersion','PlanSession','PlanSessionCompletion','ExerciseAlias','GoalOutcome')
    order by table_name`;
  console.log("MIGRATION TABLES PRESENT:", tables.map((r: any) => r.table_name).join(", ") || "NONE");

  const [tester] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, TEST_EMAIL))
    .limit(1);
  if (!tester) {
    console.log(`User ${TEST_EMAIL} NOT FOUND`);
    await client.end();
    return;
  }
  console.log(`User ${TEST_EMAIL} id=${tester.id}`);

  const rows = await db
    .select()
    .from(userTargetVersion)
    .where(and(eq(userTargetVersion.userId, tester.id), eq(userTargetVersion.kind, "water")))
    .orderBy(desc(userTargetVersion.createdAt));
  console.log(`\nUserTargetVersion(kind=water) rows: ${rows.length}`);
  for (const r of rows) {
    console.log(
      `  id=${r.id} value=${r.value} effectiveDay=${new Date(r.effectiveDay).toISOString()} createdAt=${new Date(r.createdAt).toISOString()}`
    );
  }
  await client.end();
}

main().catch((err) => {
  console.error("FATAL", err);
  process.exit(1);
});
