import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { createGoal } from "@/lib/db/queries";
import { GOAL_METRICS } from "@/lib/validation/goals";

type SaveGoalProps = {
  session: Session;
  chatId: string;
};

/**
 * Lets Chad persist a goal he sets with the client into their dashboard, so the
 * full thing is saved (not just the one-line memory summary) and shows its
 * origin chat. Mirrors the create-document factory: takes { session, chatId }.
 */
export const saveGoal = ({ session, chatId }: SaveGoalProps) =>
  tool({
    description:
      "Save a fitness goal to the client's dashboard so it's tracked and visible to them. Use this when you and the client agree on a concrete goal. Put the full goal — what they're chasing, why, and how you'll measure it — in `detail`. If it's a measurable bodyweight goal, set metric:'weight' with startValue/targetValue/unit so the dashboard shows live progress.",
    inputSchema: z.object({
      title: z
        .string()
        .max(120)
        .describe("Short label, e.g. 'Lose 15 lb by summer'"),
      detail: z
        .string()
        .max(8000)
        .describe("The full goal: specifics, the why, how it's measured."),
      targetDate: z
        .string()
        .max(60)
        .nullable()
        .optional()
        .describe("Free-text target, e.g. 'Aug 2026' or '12 weeks'."),
      metric: z
        .enum(GOAL_METRICS)
        .nullable()
        .optional()
        .describe("Set 'weight' for a bodyweight goal to show live progress."),
      startValue: z.number().nullable().optional(),
      targetValue: z.number().nullable().optional(),
      unit: z
        .string()
        .max(20)
        .nullable()
        .optional()
        .describe("Unit for the measurable target, e.g. 'lb' or 'kg'."),
    }),
    execute: async ({
      title,
      detail,
      targetDate,
      metric,
      startValue,
      targetValue,
      unit,
    }) => {
      const created = await createGoal({
        userId: session.user.id,
        title,
        detail,
        targetDate: targetDate ?? null,
        status: "active",
        source: "chad",
        sourceChatId: chatId,
        metric: metric ?? null,
        startValue: startValue ?? null,
        targetValue: targetValue ?? null,
        unit: unit ?? null,
      });
      return {
        id: created.id,
        title: created.title,
        message: `Goal "${created.title}" saved to the client's dashboard.`,
      };
    },
  });
