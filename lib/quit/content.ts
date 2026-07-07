import { z } from "zod";
import {
  APPS_TRIED_VALUES,
  KILLER_VALUES,
  LIFE_LOAD_VALUES,
  RESTART_VALUES,
  STREAK_VALUES,
} from "@/lib/quit/heuristics";

// The Quit Date (FEAT-21) shared shapes, mirrored on lib/montage/content.ts:
// client-safe (no "server-only") because the intake form and the /today card
// both render from these. The heuristics stay in lib/quit/heuristics.ts
// (pure, unit-tested); this module owns validation and display labels.

/** One optional per-question free-text note (s157, owner order: the buttons
 * never fit everyone, so every question takes the member's own words too). */
const noteField = z.string().trim().max(300).optional();

/**
 * The Quit Test intake: the member's own failure history, validated. Every
 * button answer is OPTIONAL (s157: no button may apply), "why did you stop"
 * is multi-select (`killers`), and each question carries an optional note.
 * `lastKiller` is the pre-s157 single-select shape — kept optional so every
 * stored prediction row still parses.
 */
export const autopsyAnswersSchema = z.object({
  appsTried: z.enum(APPS_TRIED_VALUES).nullable().optional(),
  restarts: z.enum(RESTART_VALUES).nullable().optional(),
  longestStreak: z.enum(STREAK_VALUES).nullable().optional(),
  lastKiller: z.enum(KILLER_VALUES).nullable().optional(),
  killers: z.array(z.enum(KILLER_VALUES)).max(6).optional(),
  lifeLoad: z.enum(LIFE_LOAD_VALUES).nullable().optional(),
  appsTriedNote: noteField,
  restartsNote: noteField,
  streakNote: noteField,
  killersNote: noteField,
  lifeLoadNote: noteField,
  confession: z
    .string()
    .trim()
    .min(4, "Answer it. What actually happened last time?")
    .max(1000),
});

export type AutopsyAnswersInput = z.infer<typeof autopsyAnswersSchema>;

/**
 * The outcome record stamped onto a RESOLVED row's content (FEAT-22). This is
 * the predicted-vs-actual ledger the spec calls half the acquisition value:
 * which danger-window interventions (check-ins Chad sent in the escalation
 * window) preceded each beaten/hit outcome, and how long the member lasted.
 */
export const quitOutcomeRecordSchema = z.object({
  status: z.enum(["beaten", "hit"]),
  resolvedAtISO: z.string(),
  // Day-of-membership of the member's last logged activity at resolution
  // (0 = they never logged anything).
  daysLasted: z.number().int().nonnegative(),
  dangerWindowCheckIns: z.array(
    z.object({
      sentAtISO: z.string(),
      slot: z.string(),
      subject: z.string(),
    })
  ),
});

export type QuitOutcomeRecord = z.infer<typeof quitOutcomeRecordSchema>;

/** The stored shape of a QuitPrediction.content row. */
export const quitPredictionContentSchema = z.object({
  answers: autopsyAnswersSchema,
  // Day-of-membership count the heuristics produced ("Day 23").
  dayCount: z.number().int().positive(),
  // The predicted quit day as a calendar-day ISO string (member's own day).
  quitDateISO: z.string(),
  // Pre-formatted display date ("March 14, 2026").
  dateLabel: z.string(),
  failureMode: z.string(),
  // Chad's verdict narrative (model-written under lib/ai/quit.ts).
  narrative: z.string(),
  // Which prediction this is (1 = the original autopsy verdict; each beaten
  // date reissues at round + 1). Absent on pre-FEAT-22 rows = round 1.
  round: z.number().int().positive().optional(),
  // Present only on resolved (beaten/hit) rows: the ledger record.
  outcome: quitOutcomeRecordSchema.optional(),
});

export type QuitPredictionContent = z.infer<
  typeof quitPredictionContentSchema
>;

/** Safe-parse a stored QuitPrediction.content row; null when malformed. */
export function parseQuitPredictionContent(
  value: unknown
): QuitPredictionContent | null {
  const parsed = quitPredictionContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// Display labels for the intake options: the form buttons show these, and the
// verdict generator hands them to the model so the narrative can quote the
// member's answers back at them.

export const APPS_TRIED_OPTIONS = [
  { value: "none", label: "This is my first" },
  { value: "1-2", label: "1 or 2" },
  { value: "3-5", label: "3 to 5" },
  { value: "6+", label: "6 or more" },
] as const satisfies readonly {
  value: (typeof APPS_TRIED_VALUES)[number];
  label: string;
}[];

export const RESTART_OPTIONS = [
  { value: "first-time", label: "Never, this is my first attempt" },
  { value: "2-3", label: "2 or 3 times" },
  { value: "4-6", label: "4 to 6 times" },
  { value: "lost-count", label: "I've lost count" },
] as const satisfies readonly {
  value: (typeof RESTART_VALUES)[number];
  label: string;
}[];

export const STREAK_OPTIONS = [
  { value: "under-1w", label: "Under a week" },
  { value: "1-2w", label: "1 to 2 weeks" },
  { value: "3-4w", label: "3 to 4 weeks" },
  { value: "1-3m", label: "1 to 3 months" },
  { value: "3m-plus", label: "Over 3 months" },
] as const satisfies readonly {
  value: (typeof STREAK_VALUES)[number];
  label: string;
}[];

export const KILLER_OPTIONS = [
  { value: "work", label: "Work got busy" },
  { value: "injury", label: "An injury or a tweak" },
  { value: "slow-results", label: "Results came too slow" },
  { value: "boredom", label: "I got bored of it" },
  { value: "life-event", label: "A life event derailed me" },
  { value: "no-reason", label: "No reason. I just stopped" },
] as const satisfies readonly {
  value: (typeof KILLER_VALUES)[number];
  label: string;
}[];

export const LIFE_LOAD_OPTIONS = [
  { value: "calm", label: "Calm" },
  { value: "normal", label: "Normal" },
  { value: "heavy", label: "Heavy" },
  { value: "chaos", label: "Total chaos" },
] as const satisfies readonly {
  value: (typeof LIFE_LOAD_VALUES)[number];
  label: string;
}[];

function labelFor<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T
): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

/**
 * The member's answers as human-readable lines (for the verdict prompt).
 * Handles both the pre-s157 shape (all buttons required, single lastKiller)
 * and the current one (optional buttons, multi-select killers, per-question
 * notes). Skipped questions are simply omitted.
 */
export function describeAnswers(answers: AutopsyAnswersInput): string {
  const lines: string[] = [];
  const add = (
    prefix: string,
    label: string | null | undefined,
    note: string | null | undefined
  ) => {
    const parts: string[] = [];
    if (label) {
      parts.push(label);
    }
    if (note?.trim()) {
      parts.push(`in their own words: "${note.trim()}"`);
    }
    if (parts.length > 0) {
      lines.push(`- ${prefix}: ${parts.join("; ")}`);
    }
  };

  add(
    "Fitness apps or programs tried before this one",
    answers.appsTried ? labelFor(APPS_TRIED_OPTIONS, answers.appsTried) : null,
    answers.appsTriedNote
  );
  add(
    "Times they have quit and started over in the past",
    answers.restarts ? labelFor(RESTART_OPTIONS, answers.restarts) : null,
    answers.restartsNote
  );
  add(
    "Longest they have ever stuck with a training program",
    answers.longestStreak
      ? labelFor(STREAK_OPTIONS, answers.longestStreak)
      : null,
    answers.streakNote
  );
  const killerPicks =
    answers.killers && answers.killers.length > 0
      ? answers.killers
      : answers.lastKiller
        ? [answers.lastKiller]
        : [];
  add(
    "Why their previous attempts ended",
    killerPicks.length > 0
      ? killerPicks.map((k) => labelFor(KILLER_OPTIONS, k)).join(", ")
      : null,
    answers.killersNote
  );
  add(
    "Their day-to-day life right now",
    answers.lifeLoad ? labelFor(LIFE_LOAD_OPTIONS, answers.lifeLoad) : null,
    answers.lifeLoadNote
  );
  lines.push(
    `- Their own words on how the last attempt ended: "${answers.confession}"`
  );
  return lines.join("\n");
}
