import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { createPlan } from "@/lib/db/queries";
import { PLAN_KINDS } from "@/lib/validation/goals";

type SavePlanProps = {
  session: Session;
  chatId: string;
};

/**
 * Lets Chad persist a training or diet plan he writes for the client into their
 * dashboard, so the FULL plan is saved (not just the one-line memory summary)
 * and can be viewed, edited, and exported. Mirrors the create-document factory.
 */
export const savePlan = ({ session, chatId }: SavePlanProps) =>
  tool({
    description:
      "Save a full training or diet plan to the client's dashboard. Use this right after you write them a real plan so they keep it (not just buried in chat). Put the COMPLETE plan in `detail` — the whole weekly structure, every day, exercises/sets/reps or meals/macros — exactly as you wrote it.",
    inputSchema: z.object({
      title: z
        .string()
        .max(120)
        .describe("Short label, e.g. '4-Day Upper/Lower Split'"),
      detail: z
        .string()
        .max(8000)
        .describe("The COMPLETE plan text, fully laid out."),
      kind: z
        .enum(PLAN_KINDS)
        .describe("'training' for a workout plan, 'diet' for a nutrition plan."),
    }),
    execute: async ({ title, detail, kind }) => {
      const created = await createPlan({
        userId: session.user.id,
        title,
        detail,
        kind,
        status: "active",
        source: "chad",
        sourceChatId: chatId,
      });
      return {
        id: created.id,
        title: created.title,
        message: `${kind === "diet" ? "Diet" : "Training"} plan "${created.title}" saved to the client's dashboard.`,
      };
    },
  });
