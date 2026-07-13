import "server-only";

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { hashPlanDays } from "@/lib/plans/materialize";
import {
  type PlanSchedule,
  type PlanScheduleView,
  scheduleFromPlanDays,
} from "@/lib/plans/schedule";
import { parsePlanDays } from "@/lib/validation/plan-days";
import { ChatbotError } from "../errors";
import {
  type GoalOutcome,
  goalOutcome,
  type Plan,
  type PlanSession,
  planSession,
  planSessionCompletion,
  planSessionExercise,
  planSessionSet,
} from "./schema";

/**
 * Plan-schedule and goal-outcome queries (FIX-28 / FIX-29, P34-D). A NEW
 * module by wave rule: lib/db/queries.ts is P34-C's territory this wave.
 * Same client + error idioms as queries.ts.
 */

const client = postgres(process.env.POSTGRES_URL ?? "");
const db = drizzle(client);

/* ------------------------------------------------- structured plans (FIX-28) */

/**
 * THE plan-schedule accessor (DEC-06). Resolves a Plan row to its one typed
 * schedule view, lazily materializing the PlanSession/Exercise/Set tables
 * from the legacy `days` json when they are missing or stale (deterministic
 * expansion, no AI; the syncPlanDays idiom). Text-only and diet plans return
 * the document view: they render from raw `detail`, which this module NEVER
 * writes to (no plan is discarded or blocked).
 */
export async function resolvePlanScheduleView(
  planRow: Plan
): Promise<PlanScheduleView> {
  const days = planRow.kind === "training" ? parsePlanDays(planRow.days) : null;
  if (!days) {
    return { kind: "document" };
  }
  const hash = hashPlanDays(days);

  try {
    const existing = await loadSchedule(planRow.id, planRow.userId);
    if (
      existing &&
      existing.schedule.sessions.length > 0 &&
      existing.sourceHashes.every((h) => h === hash)
    ) {
      return { kind: "structured", schedule: existing.schedule };
    }

    const materialized = await materializeSchedule({
      planRow,
      target: scheduleFromPlanDays(planRow.id, days),
      hash,
    });
    return { kind: "structured", schedule: materialized };
  } catch (_error) {
    // The member's plan must never be blocked by schedule storage trouble:
    // fall back to the same typed schedule computed from the json directly.
    return {
      kind: "legacy-days",
      schedule: scheduleFromPlanDays(planRow.id, days),
    };
  }
}

/** Load the materialized schedule (active sessions + prescriptions). */
async function loadSchedule(
  planId: string,
  userId: string
): Promise<{ schedule: PlanSchedule; sourceHashes: string[] } | null> {
  const sessions = await db
    .select()
    .from(planSession)
    .where(
      and(
        eq(planSession.planId, planId),
        eq(planSession.userId, userId),
        eq(planSession.active, true)
      )
    )
    .orderBy(asc(planSession.position));
  if (sessions.length === 0) {
    return null;
  }

  const sessionIds = sessions.map((s) => s.id);
  const exercises = await db
    .select()
    .from(planSessionExercise)
    .where(inArray(planSessionExercise.planSessionId, sessionIds))
    .orderBy(asc(planSessionExercise.position));
  const exerciseIds = exercises.map((e) => e.id);
  const sets =
    exerciseIds.length > 0
      ? await db
          .select()
          .from(planSessionSet)
          .where(inArray(planSessionSet.planSessionExerciseId, exerciseIds))
          .orderBy(asc(planSessionSet.position))
      : [];

  return {
    sourceHashes: sessions.map((s) => s.sourceHash),
    schedule: {
      planId,
      sessions: sessions.map((s) => ({
        id: s.id,
        position: s.position,
        name: s.name,
        weekday: s.weekday,
        exercises: exercises
          .filter((e) => e.planSessionId === s.id)
          .map((e) => ({
            name: e.exerciseName,
            sets: e.sets,
            reps: e.reps,
            weight: e.weight,
            unit: e.unit,
            note: e.note,
            restSeconds: e.restSeconds,
            supersetGroup: e.supersetGroup,
            setPrescriptions: sets
              .filter((x) => x.planSessionExerciseId === e.id)
              .map((x) => ({
                position: x.position,
                type: x.type,
                reps: x.reps,
                repRangeStart: x.repRangeStart,
                repRangeEnd: x.repRangeEnd,
                weight: x.weight,
                durationSeconds: x.durationSeconds,
                rpe: x.rpe,
              })),
          })),
      })),
    },
  };
}

/**
 * Write the schedule tables from the target schedule. Sessions are UPSERTED
 * by (planId, position) so their ids stay stable across plan edits (the
 * completion history keeps pointing at the right rotation slot); sessions
 * beyond the new rotation length flip inactive, never deleted. Exercise and
 * set rows carry no inbound FKs (P34-E joins on exerciseName) and are
 * replaced wholesale.
 */
async function materializeSchedule(args: {
  planRow: Plan;
  target: PlanSchedule;
  hash: string;
}): Promise<PlanSchedule> {
  const { planRow, target, hash } = args;

  await db.transaction(async (tx) => {
    // Serialize materialization per plan. Under READ COMMITTED, two
    // concurrent first views would both read "no sessions", both skip the
    // prescription clear, and the second would double-insert every exercise
    // and set after the first commits (its session upsert only blocks on the
    // unique index, then proceeds).
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${planRow.id}, 0))`
    );

    const existing = await tx
      .select({
        id: planSession.id,
        position: planSession.position,
        active: planSession.active,
        sourceHash: planSession.sourceHash,
      })
      .from(planSession)
      .where(
        and(
          eq(planSession.planId, planRow.id),
          eq(planSession.userId, planRow.userId)
        )
      );

    // The race loser lands here after the winner committed: if the schedule
    // is already fresh, rebuilding it would churn rows for nothing.
    const activeExisting = existing.filter((s) => s.active);
    if (
      activeExisting.length === target.sessions.length &&
      activeExisting.every((s) => s.sourceHash === hash)
    ) {
      return;
    }

    // Clear old prescriptions for every session row of this plan.
    const allSessionIds = existing.map((s) => s.id);
    if (allSessionIds.length > 0) {
      const oldExercises = await tx
        .select({ id: planSessionExercise.id })
        .from(planSessionExercise)
        .where(inArray(planSessionExercise.planSessionId, allSessionIds));
      const oldExerciseIds = oldExercises.map((e) => e.id);
      if (oldExerciseIds.length > 0) {
        await tx
          .delete(planSessionSet)
          .where(inArray(planSessionSet.planSessionExerciseId, oldExerciseIds));
        await tx
          .delete(planSessionExercise)
          .where(inArray(planSessionExercise.id, oldExerciseIds));
      }
    }

    // Upsert one session row per rotation slot.
    for (const session of target.sessions) {
      await tx
        .insert(planSession)
        .values({
          planId: planRow.id,
          userId: planRow.userId,
          position: session.position,
          name: session.name,
          weekday: session.weekday,
          active: true,
          sourceHash: hash,
        })
        .onConflictDoUpdate({
          target: [planSession.planId, planSession.position],
          set: {
            name: session.name,
            weekday: session.weekday,
            active: true,
            sourceHash: hash,
            updatedAt: new Date(),
          },
        });
    }

    // Rotation shrank: slots past the new length go dormant.
    const stale = existing.filter(
      (s) => s.active && s.position >= target.sessions.length
    );
    if (stale.length > 0) {
      await tx
        .update(planSession)
        .set({ active: false, updatedAt: new Date() })
        .where(
          inArray(
            planSession.id,
            stale.map((s) => s.id)
          )
        );
    }

    // Fresh prescription rows.
    const rows = await tx
      .select({ id: planSession.id, position: planSession.position })
      .from(planSession)
      .where(
        and(
          eq(planSession.planId, planRow.id),
          eq(planSession.active, true)
        )
      );
    const idByPosition = new Map(rows.map((r) => [r.position, r.id]));
    for (const session of target.sessions) {
      const sessionId = idByPosition.get(session.position);
      if (!sessionId) {
        continue;
      }
      for (const [exPosition, ex] of session.exercises.entries()) {
        const [insertedExercise] = await tx
          .insert(planSessionExercise)
          .values({
            planSessionId: sessionId,
            userId: planRow.userId,
            position: exPosition,
            exerciseName: ex.name,
            sets: ex.sets,
            reps: ex.reps,
            weight: ex.weight,
            unit: ex.unit,
            note: ex.note,
            restSeconds: ex.restSeconds,
            supersetGroup: ex.supersetGroup,
          })
          .returning({ id: planSessionExercise.id });
        if (ex.setPrescriptions.length > 0) {
          await tx.insert(planSessionSet).values(
            ex.setPrescriptions.map((p) => ({
              planSessionExerciseId: insertedExercise.id,
              userId: planRow.userId,
              position: p.position,
              type: p.type,
              reps: p.reps,
              repRangeStart: p.repRangeStart,
              repRangeEnd: p.repRangeEnd,
              weight: p.weight,
              durationSeconds: p.durationSeconds,
              rpe: p.rpe,
            }))
          );
        }
      }
    }
  });

  const loaded = await loadSchedule(planRow.id, planRow.userId);
  if (!loaded) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to materialize plan schedule"
    );
  }
  return loaded.schedule;
}

/** All plan sessions (incl. inactive) for evidence/preview tooling. */
export async function getPlanSessions(entry: {
  planId: string;
  userId: string;
}): Promise<PlanSession[]> {
  try {
    return await db
      .select()
      .from(planSession)
      .where(
        and(
          eq(planSession.planId, entry.planId),
          eq(planSession.userId, entry.userId)
        )
      )
      .orderBy(asc(planSession.position));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get plan sessions");
  }
}

/* -------------------------------------------- completion events (adherence) */

/**
 * Record that a logged workout completed a prescribed session. Idempotent on
 * workoutId (a double-submitted save stays one event). Completions are
 * immutable history: nothing updates them; they are removed only when their
 * workout, plan, or member is deleted (the queries.ts delete funnels).
 */
export async function recordPlanSessionCompletion(entry: {
  userId: string;
  planId: string;
  planSessionId: string;
  workoutId: string;
  sessionName: string;
  completedDay: Date;
}): Promise<void> {
  try {
    // Ownership guard: the referenced session must be the member's own and
    // belong to the named plan; a forged ref records nothing.
    const [owned] = await db
      .select({ id: planSession.id })
      .from(planSession)
      .where(
        and(
          eq(planSession.id, entry.planSessionId),
          eq(planSession.userId, entry.userId),
          eq(planSession.planId, entry.planId)
        )
      )
      .limit(1);
    if (!owned) {
      return;
    }
    await db
      .insert(planSessionCompletion)
      .values(entry)
      .onConflictDoNothing({ target: planSessionCompletion.workoutId });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to record plan session completion"
    );
  }
}

/** A plan's completion events, newest first. */
export async function getPlanSessionCompletions(entry: {
  planId: string;
  userId: string;
}) {
  try {
    return await db
      .select()
      .from(planSessionCompletion)
      .where(
        and(
          eq(planSessionCompletion.planId, entry.planId),
          eq(planSessionCompletion.userId, entry.userId)
        )
      )
      .orderBy(desc(planSessionCompletion.completedDay));
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to get plan completions"
    );
  }
}

/* --------------------------------------------------- goal outcomes (FIX-29) */

/** A goal's linked outcomes, primary (position 0) first. */
export async function getGoalOutcomes(entry: {
  goalId: string;
  userId: string;
}): Promise<GoalOutcome[]> {
  try {
    return await db
      .select()
      .from(goalOutcome)
      .where(
        and(
          eq(goalOutcome.goalId, entry.goalId),
          eq(goalOutcome.userId, entry.userId)
        )
      )
      .orderBy(asc(goalOutcome.position));
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get goal outcomes");
  }
}

/** Outcomes for a set of goals at once (list surfaces), keyed by goalId. */
export async function getOutcomesForGoals(entry: {
  goalIds: string[];
  userId: string;
}): Promise<Map<string, GoalOutcome[]>> {
  if (entry.goalIds.length === 0) {
    return new Map();
  }
  try {
    const rows = await db
      .select()
      .from(goalOutcome)
      .where(
        and(
          inArray(goalOutcome.goalId, entry.goalIds),
          eq(goalOutcome.userId, entry.userId)
        )
      )
      .orderBy(asc(goalOutcome.position));
    const byGoal = new Map<string, GoalOutcome[]>();
    for (const row of rows) {
      const list = byGoal.get(row.goalId) ?? [];
      list.push(row);
      byGoal.set(row.goalId, list);
    }
    return byGoal;
  } catch (_error) {
    throw new ChatbotError("bad_request:database", "Failed to get goal outcomes");
  }
}

/**
 * Replace a goal's outcome set (validated upstream by
 * lib/validation/goals.ts goalOutcomeSchema). Positions are normalized to
 * the array order. The legacy Goal.metric columns are left untouched: rows
 * here take precedence at read time (lib/goals/outcomes.ts).
 */
export async function replaceGoalOutcomes(entry: {
  goalId: string;
  userId: string;
  outcomes: {
    metricId: string | null;
    metricRef: string | null;
    label: string | null;
    startValue: number | null;
    targetValue: number | null;
    currentValue: number | null;
    unit: string | null;
  }[];
}): Promise<void> {
  try {
    await db.transaction(async (tx) => {
      await tx
        .delete(goalOutcome)
        .where(
          and(
            eq(goalOutcome.goalId, entry.goalId),
            eq(goalOutcome.userId, entry.userId)
          )
        );
      if (entry.outcomes.length > 0) {
        await tx.insert(goalOutcome).values(
          entry.outcomes.map((o, position) => ({
            goalId: entry.goalId,
            userId: entry.userId,
            position,
            metricId: o.metricId,
            metricRef: o.metricRef,
            label: o.label,
            startValue: o.startValue,
            targetValue: o.targetValue,
            currentValue: o.currentValue,
            unit: o.unit,
          }))
        );
      }
    });
  } catch (_error) {
    throw new ChatbotError(
      "bad_request:database",
      "Failed to save goal outcomes"
    );
  }
}
