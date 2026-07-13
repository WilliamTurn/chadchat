/**
 * FIX-34: generate the alias-merge PREVIEW artifact for owner approval.
 * READ-ONLY by design: this script only SELECTs; it writes nothing to the
 * database, only two artifact files under evidence-p34e/. The merge itself is
 * resolution-at-read and is wired into consumers in P5; nothing here (or
 * anywhere this wave) rewrites a member's logged rows.
 *
 * Run: pnpm tsx scripts/fix34-alias-merge-preview.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { mkdirSync, writeFileSync } from "node:fs";
import { asc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  type AliasMergePreview,
  buildAliasMergePreview,
} from "@/lib/workouts/alias-merge-preview";
import {
  customExercise,
  user,
  workout,
  workoutExercise,
  workoutSet,
} from "@/lib/db/schema";
import type { WorkoutData } from "@/lib/workouts/stats";

const OUT_DIR = "evidence-p34e";
const STAMP = "2026-07-13";

async function main() {
  const sql = postgres(process.env.POSTGRES_URL as string, { max: 1 });
  const db = drizzle(sql);
  try {
    // Every member with at least one logged workout.
    const owners = await db
      .selectDistinct({ userId: workout.userId })
      .from(workout);

    const perMember: {
      userId: string;
      emailMasked: string;
      preview: AliasMergePreview;
    }[] = [];

    for (const { userId } of owners) {
      const [u] = await db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.id, userId));
      const workouts = await db
        .select()
        .from(workout)
        .where(eq(workout.userId, userId))
        .orderBy(asc(workout.performedAt));
      if (workouts.length === 0) {
        continue;
      }
      const exercises = await db
        .select()
        .from(workoutExercise)
        .where(
          inArray(
            workoutExercise.workoutId,
            workouts.map((w) => w.id)
          )
        )
        .orderBy(asc(workoutExercise.position));
      const sets = exercises.length
        ? await db
            .select()
            .from(workoutSet)
            .where(
              inArray(
                workoutSet.workoutExerciseId,
                exercises.map((e) => e.id)
              )
            )
            .orderBy(asc(workoutSet.position))
        : [];
      const customs = await db
        .select({ name: customExercise.name })
        .from(customExercise)
        .where(eq(customExercise.userId, userId));

      const setsByExercise = new Map<string, typeof sets>();
      for (const s of sets) {
        const list = setsByExercise.get(s.workoutExerciseId) ?? [];
        list.push(s);
        setsByExercise.set(s.workoutExerciseId, list);
      }
      const exByWorkout = new Map<string, typeof exercises>();
      for (const e of exercises) {
        const list = exByWorkout.get(e.workoutId) ?? [];
        list.push(e);
        exByWorkout.set(e.workoutId, list);
      }

      const data: WorkoutData[] = workouts.map((w) => ({
        id: w.id,
        title: w.title,
        performedAt: w.performedAt.toISOString(),
        durationSeconds: w.durationSeconds,
        notes: w.notes,
        exercises: (exByWorkout.get(w.id) ?? []).map((ex) => ({
          name: ex.exerciseName,
          muscleGroup: ex.muscleGroup,
          kind: ex.kind as WorkoutData["exercises"][number]["kind"],
          supersetGroup: ex.supersetGroup,
          notes: ex.notes,
          sets: (setsByExercise.get(ex.id) ?? []).map((s) => ({
            weight: s.weight,
            reps: s.reps,
            unit: s.unit as "lb" | "kg",
            rpe: s.rpe,
            setType: s.setType as
              | "warmup"
              | "working"
              | "dropset"
              | "failure",
            completed: s.completed,
          })),
        })),
      }));

      const preview = buildAliasMergePreview(data, {
        memberCustomNames: customs.map((c) => c.name),
      });
      if (preview.groups.length === 0 && preview.customShadows.length === 0) {
        continue;
      }
      const email = u?.email ?? "unknown";
      const at = email.indexOf("@");
      const emailMasked =
        at > 2 ? `${email.slice(0, 3)}***${email.slice(at)}` : `***${email.slice(at)}`;
      perMember.push({ userId, emailMasked, preview });
    }

    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(
      `${OUT_DIR}/alias-merge-preview-${STAMP}.json`,
      JSON.stringify({ generatedAt: STAMP, members: perMember }, null, 2)
    );

    const lines: string[] = [
      `# FIX-34 alias merge preview (${STAMP})`,
      "",
      "**Status: QUEUED FOR OWNER APPROVAL. Generated read-only; nothing has been applied.**",
      "Merging is resolution-at-read: approving it changes how records GROUP, it never rewrites a logged row, and removing an alias un-merges.",
      "",
      `Members scanned: ${owners.length}; members with merges or shadows: ${perMember.length}.`,
      "",
    ];
    for (const m of perMember) {
      lines.push(`## Member ${m.emailMasked} (${m.userId.slice(0, 8)})`);
      lines.push("");
      for (const g of m.preview.groups) {
        lines.push(`### Merge into: ${g.canonicalName}`);
        for (const mem of g.members) {
          lines.push(
            `- "${mem.rawName}" (${mem.exerciseRowCount} logged exercise rows, via ${mem.matchedVia}${mem.confidence ? `, ${mem.confidence} confidence` : ""})`
          );
        }
        const before = g.recordsBefore
          .map(
            (r) =>
              `${r.exerciseName}: best ${r.bestWeight ?? "-"} ${r.bestWeightUnit} x ${r.bestWeightReps ?? "-"}, e1RM ${r.bestEst1RM ?? "-"} lb`
          )
          .join(" | ");
        const after = g.recordAfter
          ? `best ${g.recordAfter.bestWeight ?? "-"} ${g.recordAfter.bestWeightUnit} x ${g.recordAfter.bestWeightReps ?? "-"}, e1RM ${g.recordAfter.bestEst1RM ?? "-"} lb`
          : "-";
        lines.push(`- Records BEFORE (split): ${before || "none"}`);
        lines.push(`- Record AFTER (reconciled): ${after}`);
        lines.push("");
      }
      if (m.preview.customShadows.length) {
        lines.push(
          "### Custom exercises shadowing curated aliases (INFORMATIONAL, never merged)"
        );
        for (const s of m.preview.customShadows) {
          lines.push(
            `- Member custom "${s.customName}" is protected; the curated set would otherwise map it to "${s.wouldHaveMergedInto}"`
          );
        }
        lines.push("");
      }
    }
    writeFileSync(`${OUT_DIR}/alias-merge-preview-${STAMP}.md`, lines.join("\n"));
    console.log(
      `Preview written: ${OUT_DIR}/alias-merge-preview-${STAMP}.md (+.json); ${perMember.length} member(s) affected.`
    );
  } finally {
    await sql.end();
  }
}

main();
