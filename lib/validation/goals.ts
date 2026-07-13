import { z } from "zod";
import { METRICS } from "@/lib/contracts/metrics";

// The measurable-target metrics a goal can be pinned to (optional). A `weight`
// goal renders live progress by reading the latest ProgressEntry; a `lift` goal
// tracks the est. 1RM of the exercise named in `metricRef` against the target.
export const GOAL_METRICS = [
  "weight",
  "bodyfat",
  "measurement",
  "custom",
  "lift",
] as const;

export const GOAL_STATUSES = ["active", "achieved", "archived"] as const;
export const PLAN_KINDS = ["training", "diet"] as const;

// A measurable target is all-or-nothing-ish: if you pick a metric, you should
// give a target value. Both target and start are optional otherwise.
const measurableTarget = {
  metric: z.enum(GOAL_METRICS).nullable().optional(),
  // The exercise a "lift" goal tracks (its est. 1RM). Ignored for other metrics.
  metricRef: z.string().trim().max(80).nullable().optional(),
  startValue: z.number().finite().nullable().optional(),
  // Latest value for metrics with no automatic data source (bodyfat,
  // measurement, custom); the member updates it by hand. Weight and lift
  // goals ignore it.
  currentValue: z.number().finite().nullable().optional(),
  targetValue: z.number().finite().nullable().optional(),
  unit: z.string().trim().max(20).nullable().optional(),
};

/** Create a goal (user-authored on the dashboard, or Chad via a tool). */
export const createGoalSchema = z.object({
  // 200 is roomy for a one-line goal; the form shows a live counter near the
  // limit instead of silently swallowing keystrokes.
  title: z.string().trim().min(1).max(200),
  detail: z.string().trim().max(8000).default(""),
  targetDate: z.string().trim().max(60).nullable().optional(),
  status: z.enum(GOAL_STATUSES).default("active"),
  ...measurableTarget,
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;

/** Edit an existing goal. Same fields plus the row id. */
export const updateGoalSchema = createGoalSchema.extend({
  id: z.string().uuid(),
});

export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

/** Create a plan (training or diet). */
export const createPlanSchema = z.object({
  title: z.string().trim().min(1).max(120),
  detail: z.string().trim().max(8000).default(""),
  kind: z.enum(PLAN_KINDS).default("training"),
  status: z.enum(GOAL_STATUSES).default("active"),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;

export const updatePlanSchema = createPlanSchema.extend({
  id: z.string().uuid(),
});

export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;

/**
 * One goal outcome (FIX-29): either pinned to a REGISTERED metric id from
 * lib/contracts/metrics.ts (the outcome vocabulary; never a free string), or
 * explicitly unsupported (metricId null), in which case a member-facing
 * label is required so the goal states what it tracks by hand.
 */
export const goalOutcomeSchema = z
  .object({
    metricId: z.string().trim().max(80).nullable(),
    metricRef: z.string().trim().max(120).nullable().optional(),
    label: z.string().trim().max(120).nullable().optional(),
    startValue: z.number().finite().nullable().optional(),
    targetValue: z.number().finite().nullable().optional(),
    // Manual current value, unsupported outcomes only (supported ones read
    // their registered source module).
    currentValue: z.number().finite().nullable().optional(),
    unit: z.string().trim().max(20).nullable().optional(),
  })
  .superRefine((outcome, ctx) => {
    if (outcome.metricId !== null && !(outcome.metricId in METRICS)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["metricId"],
        message: "Unknown metric. Pick a registered metric or mark the outcome as tracked manually.",
      });
    }
    if (outcome.metricId === null && !outcome.label?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["label"],
        message: "Name this outcome so it's clear what you're tracking.",
      });
    }
  });

export type GoalOutcomeInput = z.infer<typeof goalOutcomeSchema>;

/** A goal's full outcome set (replace-style writes; order = display order). */
export const goalOutcomesSchema = z.array(goalOutcomeSchema).max(8);
