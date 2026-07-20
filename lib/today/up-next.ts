import type { UpNextVerdict } from "@/lib/plans/up-next";

/**
 * THE /home "Up next" decision (FIX-23, P6). Pure and deterministic: the
 * verdict derives entirely from the snapshot passed in, so it is inspectable,
 * unit-testable, and two renders of the same day can never disagree.
 *
 * PRIORITY ORDER (fixed; the member-facing "?" explainer states it in the
 * same words):
 *   1. Your next training session: training is the day's highest-value
 *      action. Skipped once a session is completed today (the day's training
 *      is done; Up next never nags for a second workout).
 *   2. Log last night's sleep: the most time-sensitive repair: memory of a
 *      night fades fastest. Only when last night is actually unlogged.
 *   3. Your meal plan: when a plan exists and nothing is logged yet today,
 *      the next concrete action is eating (and logging) from it.
 *   4. Review your progress: the calm default when the day is handled.
 *
 * SAFE WHEN DATA IS MISSING (the FIX-23 acceptance line): no plan, no
 * schedule, no completions, no sleep entries, nothing logged: every branch
 * degrades to the next priority; the selector always returns a verdict.
 *
 * Consumes P34-D's `selectUpNextSession` verdict (lib/plans/up-next.ts) for
 * priority 1: THIS module never re-decides which session is next; it only
 * decides whether the training slot outranks the other candidates today.
 */

export type UpNextToday = {
  kind: "training" | "sleep" | "meal-plan" | "review";
  /** The one next action, as a verb phrase ("Start Day 2: Lower"). */
  title: string;
  /** Member-facing, factual WHY this is next (the inspectability law). */
  reason: string;
  cta: { label: string; href: string };
  secondary?: { label: string; href: string };
  /** Rotation context for the training visual (position/total/name). */
  training?: {
    planId: string;
    planTitle: string;
    sessionName: string;
    /** 0-based position of the picked session in the rotation. */
    position: number;
    /** All rotation session names in order, for the rotation strip. */
    rotation: { name: string; completedThisWeek: boolean }[];
    exercises: string[];
  };
};

export type UpNextSnapshot = {
  /** The active training plan's resolved schedule verdict, if any. */
  training: {
    planId: string;
    planTitle: string;
    verdict: UpNextVerdict | null;
    /** A completion event exists for the member-local today. */
    trainedToday: boolean;
    /** Session names in rotation order + whether each completed this week. */
    rotation: { name: string; completedThisWeek: boolean }[];
  } | null;
  /** Last night's sleep is logged (an entry for today or yesterday). */
  lastNightLogged: boolean;
  /** An active meal plan exists. */
  hasMealPlan: boolean;
  /** Meals logged today (truthful zero; nutrition.meals.today). */
  mealsLoggedToday: number;
  /** Below-Pro members can't log sleep/meals; their day is chat + goals. */
  isPro: boolean;
};

export function selectUpNextToday(snap: UpNextSnapshot): UpNextToday {
  // 1. Training: the resolved rotation's next session, unless today's
  //    session is already done.
  const t = snap.training;
  if (t?.verdict && !t.trainedToday) {
    const session = t.verdict.session;
    return {
      kind: "training",
      title: `Start ${session.name}`,
      reason: t.verdict.reason,
      cta: { label: `Start ${session.name}`, href: "/workouts" },
      secondary: { label: "Training plan", href: `/plans/${t.planId}` },
      training: {
        planId: t.planId,
        planTitle: t.planTitle,
        sessionName: session.name,
        position: session.position,
        rotation: t.rotation,
        exercises: session.exercises.map((e) => e.name),
      },
    };
  }

  // 2. Sleep repair (Pro): last night is a gap until it's logged.
  if (snap.isPro && !snap.lastNightLogged) {
    return {
      kind: "sleep",
      title: "Log last night's sleep",
      reason: t?.trainedToday
        ? "Today's workout is done. Last night's sleep isn't logged yet."
        : "Last night's sleep isn't logged yet.",
      cta: { label: "Log last night", href: "/sleep" },
      secondary: { label: "Sleep trends", href: "/sleep" },
    };
  }

  // 3. Meal plan (Pro): a plan exists and nothing is logged yet today.
  if (snap.isPro && snap.hasMealPlan && snap.mealsLoggedToday === 0) {
    return {
      kind: "meal-plan",
      title: "Log your first meal",
      reason: "Your meal plan has today's meals; nothing is logged yet.",
      cta: { label: "Log a meal", href: "/nutrition#log-meal" },
      secondary: { label: "Meal Plan", href: "/meal-plan" },
    };
  }

  // 4. The calm default: the day is handled; look at the results.
  return {
    kind: "review",
    title: "Review your progress",
    reason: t?.trainedToday
      ? "Today's workout is done and your logs are current."
      : "Nothing is overdue right now.",
    cta: { label: "Open Progress", href: "/progress" },
    secondary: { label: "Talk to Chad", href: "/" },
  };
}

/** The member-facing explainer for the "?" popover (inspectability law). */
export const UP_NEXT_PRIORITY_EXPLAINER =
  "Up next is picked by a fixed order: 1) your next workout (skipped once you've trained today), 2) logging last night's sleep if it's missing, 3) your meal plan when nothing is logged yet today, 4) reviewing your progress. Same data, same answer, every time.";
