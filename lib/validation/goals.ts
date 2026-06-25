import { z } from "zod";

// The measurable-target metrics a goal can be pinned to (optional). A `weight`
// goal renders live progress by reading the latest ProgressEntry.
export const GOAL_METRICS = [
  "weight",
  "bodyfat",
  "measurement",
  "custom",
] as const;

export const GOAL_STATUSES = ["active", "achieved", "archived"] as const;
export const PLAN_KINDS = ["training", "diet"] as const;

// A measurable target is all-or-nothing-ish: if you pick a metric, you should
// give a target value. Both target and start are optional otherwise.
const measurableTarget = {
  metric: z.enum(GOAL_METRICS).nullable().optional(),
  startValue: z.number().finite().nullable().optional(),
  targetValue: z.number().finite().nullable().optional(),
  unit: z.string().trim().max(20).nullable().optional(),
};

/** Create a goal (user-authored on the dashboard, or Chad via a tool). */
export const createGoalSchema = z.object({
  title: z.string().trim().min(1).max(120),
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
