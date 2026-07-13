import type { PlanSchedule, PlanScheduleSession } from "./schedule";

/**
 * The deterministic next-session selector (FIX-28; consumed by the P6 Up
 * next build, FIX-23). Pure: the verdict derives entirely from the passed
 * schedule and completion events, so it is inspectable and unit-testable,
 * and two surfaces given the same inputs can never disagree.
 *
 * Rule (rotation semantics, the Boostcamp positional model): the next
 * session is the ACTIVE session completed LEAST RECENTLY, with
 * never-completed sessions first; ties resolve by rotation position. Under
 * normal sequential training this is exactly "the next day in the rotation",
 * and it stays sensible through skipped days (a missed Tuesday costs
 * nothing), plan edits, and repeated sessions. Safe when data is missing:
 * no sessions -> null; no completions -> the first session of the rotation.
 */

export type CompletionEvent = {
  /** PlanSession.id the completion recorded against. */
  planSessionId: string;
  /** Member-local day anchor (epoch ms) the completion counts toward. */
  completedDayMs: number;
};

export type UpNextVerdict = {
  session: PlanScheduleSession;
  /** Member-facing, factual explanation of why this session is next. */
  reason: string;
};

export function selectUpNextSession(
  schedule: PlanSchedule,
  completions: CompletionEvent[]
): UpNextVerdict | null {
  const sessions = [...schedule.sessions].sort(
    (a, b) => a.position - b.position
  );
  if (sessions.length === 0) {
    return null;
  }

  const lastCompleted = new Map<string, number>();
  for (const c of completions) {
    const prev = lastCompleted.get(c.planSessionId);
    if (prev === undefined || c.completedDayMs > prev) {
      lastCompleted.set(c.planSessionId, c.completedDayMs);
    }
  }

  let pick = sessions[0];
  let pickLast = lastFor(pick, lastCompleted);
  for (const s of sessions.slice(1)) {
    const sLast = lastFor(s, lastCompleted);
    if (sLast < pickLast) {
      pick = s;
      pickLast = sLast;
    }
  }

  if (pickLast === Number.NEGATIVE_INFINITY) {
    const anyCompleted = sessions.some(
      (s) => lastFor(s, lastCompleted) !== Number.NEGATIVE_INFINITY
    );
    return {
      session: pick,
      reason: anyCompleted
        ? `You haven't done ${pick.name} yet.`
        : "The first session of your rotation.",
    };
  }
  return {
    session: pick,
    reason: `Your least recent session in the rotation.`,
  };
}

function lastFor(
  session: PlanScheduleSession,
  lastCompleted: Map<string, number>
): number {
  if (session.id === null) {
    // Legacy-days view: completions cannot reference an unmaterialized
    // session, so it reads as never completed.
    return Number.NEGATIVE_INFINITY;
  }
  return lastCompleted.get(session.id) ?? Number.NEGATIVE_INFINITY;
}
