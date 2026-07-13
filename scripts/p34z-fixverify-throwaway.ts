/**
 * Throwaway-account helper for P34-Z test 3. Scoped strictly to
 * p34z-throwaway@example.com.
 *   --check     print user id + row counts across the named tables
 *   --grant-pro flip this user to pro/active so Pro-gated writes run
 *   --seed      insert one row into each named new table (with valid FKs)
 *   --cleanup   delete this user's data + the user row (final teardown)
 */
import { config } from "dotenv";
import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  exerciseAlias,
  goal,
  goalOutcome,
  nutritionTargetVersion,
  plan,
  planSession,
  planSessionCompletion,
  planSessionExercise,
  planSessionSet,
  user,
  userTargetVersion,
  waterLog,
  workout,
} from "../lib/db/schema";

config({ path: ".env.local" });
const EMAIL = "p34z-throwaway@example.com";

async function main() {
  const client = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
  const db = drizzle(client);
  const [u] = await db.select().from(user).where(eq(user.email, EMAIL)).limit(1);
  if (!u) {
    console.log(JSON.stringify({ userExists: false }));
    await client.end();
    return;
  }
  const uid = u.id;

  if (process.argv.includes("--grant-pro")) {
    const end = new Date(Date.now() + 30 * 864e5);
    await db.update(user).set({ subscriptionTier: "pro", subscriptionStatus: "active", currentPeriodEnd: end }).where(eq(user.id, uid));
    console.log(JSON.stringify({ granted: true, uid }));
    await client.end();
    return;
  }

  if (process.argv.includes("--seed")) {
    const now = new Date();
    // NutritionTargetVersion + UserTargetVersion (member-scoped history rows).
    await db.insert(nutritionTargetVersion).values({ userId: uid, calories: 2200, protein: 180, carbs: 200, fat: 70, effectiveDay: now });
    await db.insert(userTargetVersion).values({ userId: uid, kind: "water", value: 3000, effectiveDay: now });
    // A plan + its materialized schedule + a completion (needs a workout).
    const [p] = await db.insert(plan).values({ userId: uid, title: "P34Z throwaway plan", detail: "Day 1", kind: "training", status: "active", source: "user" }).returning({ id: plan.id });
    const [ps] = await db.insert(planSession).values({ planId: p.id, userId: uid, position: 0, name: "Day 1", active: true, sourceHash: "seed" }).returning({ id: planSession.id });
    const [pse] = await db.insert(planSessionExercise).values({ planSessionId: ps.id, userId: uid, position: 0, exerciseName: "Bench Press", sets: 3, reps: "5" }).returning({ id: planSessionExercise.id });
    await db.insert(planSessionSet).values({ planSessionExerciseId: pse.id, userId: uid, position: 0, type: "normal", reps: 5 });
    const [w] = await db.insert(workout).values({ userId: uid, title: "seed workout", performedAt: now }).returning({ id: workout.id });
    await db.insert(planSessionCompletion).values({ userId: uid, planId: p.id, planSessionId: ps.id, workoutId: w.id, sessionName: "Day 1", completedDay: now });
    // Goal + outcome.
    const [g] = await db.insert(goal).values({ userId: uid, title: "Lose fat" }).returning({ id: goal.id });
    await db.insert(goalOutcome).values({ goalId: g.id, userId: uid, position: 0, label: "BF%", startValue: 20, targetValue: 12, currentValue: 18, metricId: null, metricRef: null, unit: "%" });
    // Water log + exercise alias (member-scoped).
    await db.insert(waterLog).values({ userId: uid, amountMl: 500, recordedAt: now });
    await db.insert(exerciseAlias).values({ userId: uid, alias: "benchpress-throwaway", canonicalName: "Bench Press" });
    console.log(JSON.stringify({ seeded: true, uid, planId: p.id }));
    await client.end();
    return;
  }

  // --check (default): count rows across named tables.
  const count = async (tbl: any, col: any) => (await db.select({ id: col }).from(tbl).where(eq(col, uid))).length;
  const sessions = await db.select({ id: planSession.id }).from(planSession).where(eq(planSession.userId, uid));
  const out = {
    userExists: true,
    uid,
    subscriptionTier: u.subscriptionTier,
    subscriptionStatus: u.subscriptionStatus,
    userTargetVersion: await count(userTargetVersion, userTargetVersion.userId),
    nutritionTargetVersion: await count(nutritionTargetVersion, nutritionTargetVersion.userId),
    waterLog: await count(waterLog, waterLog.userId),
    goal: await count(goal, goal.userId),
    goalOutcome: await count(goalOutcome, goalOutcome.userId),
    planSession: sessions.length,
    planSessionExercise: await count(planSessionExercise, planSessionExercise.userId),
    planSessionSet: await count(planSessionSet, planSessionSet.userId),
    planSessionCompletion: await count(planSessionCompletion, planSessionCompletion.userId),
    exerciseAlias: await count(exerciseAlias, exerciseAlias.userId),
    plan: await count(plan, plan.userId),
    workout: await count(workout, workout.userId),
  };
  console.log(JSON.stringify(out, null, 2));
  console.log("RESULT=" + JSON.stringify(out));

  if (process.argv.includes("--cleanup")) {
    // Delete the user row too (data wipe already run via UI). Children first
    // only if any survived; deleteAllUserData handles data, this drops the row.
    await db.delete(user).where(eq(user.id, uid));
    console.log("USER ROW DELETED");
  }
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
