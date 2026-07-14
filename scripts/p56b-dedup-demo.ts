/**
 * FIX-33: demonstrate the WIRED alias dedup against the real prod
 * alias-preview cases, READ-ONLY (the P34-E preview identified the affected
 * members; this proves the consumer wiring reconciles their records exactly
 * as the owner-approved preview said it would). Only SELECTs; writes one
 * artifact file under evidence-p56b/.
 *
 * Run: pnpm tsx scripts/p56b-dedup-demo.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  customExercise,
  exerciseAlias,
  user,
  workout,
  workoutExercise,
  workoutSet,
} from "@/lib/db/schema";
import {
  canonicalizeWorkouts,
  type ResolveOptions,
} from "@/lib/workouts/exercise-identity";
import {
  computePersonalRecords,
  prEventsByWorkout,
  type WorkoutData,
} from "@/lib/workouts/stats";

const OUT = "evidence-p56b/dedup-demo-prod.md";

async function main() {
  const sql = postgres(process.env.POSTGRES_URL as string, { max: 1 });
  const db = drizzle(sql);
  try {
    const owners = await db.selectDistinct({ userId: workout.userId }).from(workout);
    const approvedAliases = await db
      .select()
      .from(exerciseAlias)
      .where(eq(exerciseAlias.status, "approved"));

    const lines: string[] = [
      "# FIX-33 dedup demonstration against real prod data (READ-ONLY)",
      "",
      `Generated ${new Date().toISOString()} by scripts/p56b-dedup-demo.ts. No writes; SELECTs only.`,
      "",
      `Approved ExerciseAlias rows in prod: ${approvedAliases.length} (resolution therefore runs on member customs + the curated set, exactly what the live pages consume).`,
      "",
    ];

    for (const { userId } of owners) {
      const [u] = await db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.id, userId));
      const masked = u
        ? `${u.email.slice(0, 2)}***@${u.email.split("@")[1] ?? "?"}`
        : "unknown";

      const workoutRows = await db
        .select()
        .from(workout)
        .where(eq(workout.userId, userId))
        .orderBy(asc(workout.performedAt));
      const customs = await db
        .select({ name: customExercise.name })
        .from(customExercise)
        .where(eq(customExercise.userId, userId));

      const data: WorkoutData[] = [];
      for (const w of workoutRows) {
        const exercises = await db
          .select()
          .from(workoutExercise)
          .where(eq(workoutExercise.workoutId, w.id))
          .orderBy(asc(workoutExercise.position));
        data.push({
          id: w.id,
          title: w.title,
          performedAt: w.performedAt.toISOString(),
          durationSeconds: w.durationSeconds,
          notes: w.notes,
          exercises: await Promise.all(
            exercises.map(async (ex) => ({
              name: ex.exerciseName,
              muscleGroup: ex.muscleGroup,
              kind: ex.kind,
              supersetGroup: ex.supersetGroup,
              notes: ex.notes,
              sets: (
                await db
                  .select()
                  .from(workoutSet)
                  .where(eq(workoutSet.workoutExerciseId, ex.id))
                  .orderBy(asc(workoutSet.position))
              ).map((s) => ({
                weight: s.weight,
                reps: s.reps,
                unit: s.unit,
                rpe: s.rpe,
                setType: s.setType,
                completed: s.completed,
              })),
            }))
          ),
        });
      }

      const opts: ResolveOptions = {
        memberCustomNames: customs.map((c) => c.name),
        memberAliases: new Map(
          approvedAliases
            .filter((a) => a.userId === null || a.userId === userId)
            .map((a) => [a.alias, a.canonicalName])
        ),
      };

      const before = computePersonalRecords(data);
      const after = computePersonalRecords(canonicalizeWorkouts(data, opts));
      const events = prEventsByWorkout(canonicalizeWorkouts(data, opts));

      lines.push(
        `## Member ${masked} (${data.length} workouts)`,
        "",
        `Records BEFORE wiring (raw names): ${before.length} rows -> ${before.map((r) => r.exerciseName).join(", ") || "none"}`,
        "",
        `Records AFTER wiring (canonical, what /workouts and /progress/training now render): ${after.length} rows -> ${after.map((r) => r.exerciseName).join(", ") || "none"}`,
        "",
        `Merged away: ${before.length - after.length} split rows. PR timeline events (source-linked): ${events.length}.`,
        ""
      );
      for (const r of after) {
        const merged = before.filter(
          (b) =>
            b.exerciseName !== r.exerciseName &&
            !after.some((a) => a.exerciseName === b.exerciseName) &&
            // A raw row merged INTO r if canonicalization maps its best into r's group.
            canonicalizeWorkouts(
              [
                {
                  id: "probe",
                  title: "probe",
                  performedAt: new Date(0).toISOString(),
                  durationSeconds: null,
                  notes: null,
                  exercises: [
                    {
                      name: b.exerciseName,
                      muscleGroup: null,
                      kind: null,
                      supersetGroup: null,
                      notes: null,
                      sets: [],
                    },
                  ],
                },
              ],
              opts
            )[0].exercises[0].name === r.exerciseName
        );
        if (merged.length > 0) {
          lines.push(
            `- **${r.exerciseName}**: absorbed ${merged.map((m) => `"${m.exerciseName}" (best ${m.bestWeight ?? "-"} ${m.bestWeightUnit})`).join(", ")}; reconciled best = ${r.bestWeight ?? "-"} ${r.bestWeightUnit}${r.bestEst1RM != null ? `, est. 1RM ${r.bestEst1RM} lb` : ""}, source workout ${r.bestWeightWorkoutId ?? "-"}`
          );
        }
      }
      lines.push("");
    }

    mkdirSync("evidence-p56b", { recursive: true });
    writeFileSync(OUT, lines.join("\n"));
    console.log(`wrote ${OUT}`);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
