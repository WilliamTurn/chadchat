import { z } from "zod";

/** Goal fields a user can set directly on the dashboard. These are written back
 * into Chad's memory profile so he sees them too. */
export const saveGoalSchema = z.object({
  goal: z.string().trim().min(1, "Tell Chad what you're chasing.").max(300),
  deadline: z.string().trim().max(120).nullable().optional(),
  phase: z.string().trim().max(120).nullable().optional(),
});

export type SaveGoalInput = z.infer<typeof saveGoalSchema>;
