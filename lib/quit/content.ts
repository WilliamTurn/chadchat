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

/** The Autopsy intake: the member's own failure history, validated. */
export const autopsyAnswersSchema = z.object({
  appsTried: z.enum(APPS_TRIED_VALUES),
  restarts: z.enum(RESTART_VALUES),
  longestStreak: z.enum(STREAK_VALUES),
  lastKiller: z.enum(KILLER_VALUES),
  lifeLoad: z.enum(LIFE_LOAD_VALUES),
  confession: z
    .string()
    .trim()
    .min(4, "Answer it. What actually happened last time?")
    .max(1000),
});

export type AutopsyAnswersInput = z.infer<typeof autopsyAnswersSchema>;

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
  { value: "first-time", label: "This is my first real attempt" },
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

/** The member's answers as human-readable lines (for the verdict prompt). */
export function describeAnswers(answers: AutopsyAnswersInput): string {
  return [
    `- Fitness apps or programs tried before this one: ${labelFor(APPS_TRIED_OPTIONS, answers.appsTried)}`,
    `- Times started over from scratch: ${labelFor(RESTART_OPTIONS, answers.restarts)}`,
    `- Longest they have ever stuck with it: ${labelFor(STREAK_OPTIONS, answers.longestStreak)}`,
    `- What killed the last attempt: ${labelFor(KILLER_OPTIONS, answers.lastKiller)}`,
    `- Current life load: ${labelFor(LIFE_LOAD_OPTIONS, answers.lifeLoad)}`,
    `- Their own words on how the last attempt ended: "${answers.confession}"`,
  ].join("\n");
}
