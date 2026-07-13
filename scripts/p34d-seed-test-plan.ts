/**
 * P34-D live-verification helper. Seeds ONE training plan (with legacy days
 * json, the pre-FIX-28 shape) onto the Pro test account so the browser
 * verification can drive /workouts and /plans/[id] through the adapter, then
 * removes it with --cleanup. Only touches claude-testing@example.com and
 * only rows this script created (title-scoped); refuses to run otherwise.
 *
 *   npx tsx scripts/p34d-seed-test-plan.ts            # seed, prints plan id
 *   npx tsx scripts/p34d-seed-test-plan.ts --cleanup  # delete the seeded plan + its schedule rows
 */

import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
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
const SEED_TITLE = "P34-D Verification Split (safe to delete)";

const DAYS = [
  {
    name: "Day 1: Upper",
    exercises: [
      { name: "Barbell Bench Press", sets: 4, reps: "4-6", weight: 185, unit: "lb", note: "RPE 8" },
      { name: "Barbell Row", sets: 4, reps: "8-12", weight: null, unit: "lb", note: null },
      { name: "Overhead Press", sets: 3, reps: "8-10", weight: 95, unit: "lb", note: null },
    ],
  },
  {
    name: "Day 2: Lower",
    exercises: [
      { name: "Back Squat", sets: 5, reps: "5", weight: 225, unit: "lb", note: "3 min rest" },
      { name: "Romanian Deadlift", sets: 3, reps: "8-12", weight: 155, unit: "lb", note: null },
      { name: "Plank", sets: 3, reps: "45s", weight: null, unit: "lb", note: null },
    ],
  },
  {
    name: "Day 3: Full Body",
    exercises: [
      { name: "Deadlift", sets: 3, reps: "5", weight: 275, unit: "lb", note: null },
      { name: "Dumbbell Curl", sets: 3, reps: "10 per side", weight: 30, unit: "lb", note: null },
    ],
  },
];

async function main() {
  const client = postgres(process.env.POSTGRES_URL ?? "", { max: 1 });
  const db = drizzle(client);

  const [tester] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, TEST_EMAIL))
    .limit(1);
  if (!tester) {
    throw new Error(`${TEST_EMAIL} not found`);
  }

  if (process.argv.includes("--cleanup")) {
    const rows = await db
      .select({ id: plan.id })
      .from(plan)
      .where(and(eq(plan.userId, tester.id), eq(plan.title, SEED_TITLE)));
    for (const row of rows) {
      // Child rows first (FKs); all scoped to the seeded plan only. The
      // schedule tables may not exist pre-migration; ignore missing-relation
      // errors so cleanup works in both states.
      try {
        const sessions = await db
          .select({ id: planSession.id })
          .from(planSession)
          .where(eq(planSession.planId, row.id));
        for (const s of sessions) {
          const exercises = await db
            .select({ id: planSessionExercise.id })
            .from(planSessionExercise)
            .where(eq(planSessionExercise.planSessionId, s.id));
          for (const ex of exercises) {
            await db
              .delete(planSessionSet)
              .where(eq(planSessionSet.planSessionExerciseId, ex.id));
          }
          await db
            .delete(planSessionExercise)
            .where(eq(planSessionExercise.planSessionId, s.id));
        }
        await db
          .delete(planSessionCompletion)
          .where(eq(planSessionCompletion.planId, row.id));
        await db.delete(planSession).where(eq(planSession.planId, row.id));
      } catch {
        console.log("(schedule tables absent; plan row cleanup only)");
      }
      await db.delete(plan).where(eq(plan.id, row.id));
      console.log(`Deleted seeded plan ${row.id}`);
    }
    if (rows.length === 0) {
      console.log("Nothing to clean up.");
    }
    await client.end();
    return;
  }

  // Seed WITHOUT archiving any existing active plan (deliberately NOT using
  // createPlan's LC-15 behavior): status "active" only if the account has no
  // active training plan, else "archived" so we never displace real state.
  const existing = await db
    .select({ id: plan.id })
    .from(plan)
    .where(
      and(
        eq(plan.userId, tester.id),
        eq(plan.kind, "training"),
        eq(plan.status, "active")
      )
    );
  const status = existing.length === 0 ? "active" : "archived";
  const detail = DAYS.map(
    (d) =>
      `## ${d.name}\n${d.exercises
        .map((e) => `- ${e.name}: ${e.sets} x ${e.reps}${e.weight ? ` @ ${e.weight} lb` : ""}${e.note ? ` (${e.note})` : ""}`)
        .join("\n")}`
  ).join("\n\n");

  const [created] = await db
    .insert(plan)
    .values({
      userId: tester.id,
      title: SEED_TITLE,
      detail,
      kind: "training",
      status,
      source: "user",
      sourceChatId: null,
      days: DAYS,
    })
    .returning({ id: plan.id, status: plan.status });
  console.log(`Seeded plan ${created.id} (status: ${created.status})`);
  console.log(`Existing active training plans untouched: ${existing.length}`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
