import { tool } from "ai";
import { revalidatePath } from "next/cache";
import type { Session } from "next-auth";
import { z } from "zod";
import { createPlan } from "@/lib/db/queries";
import { PLAN_KINDS } from "@/lib/validation/goals";
import { normalizePlanDays } from "@/lib/validation/plan-days";

type SavePlanProps = {
  session: Session;
  chatId: string;
};

/**
 * Lets Chad persist a training or diet plan he writes for the client into their
 * dashboard, so the FULL plan is saved (not just the one-line memory summary)
 * and can be viewed, edited, and exported. Mirrors the create-document factory.
 * Training plans also carry structured `days` so the plan is RUNNABLE on the
 * Workouts page ("Start Day 2" pre-fills the logger); FN-2.
 */
export const savePlan = ({ session, chatId }: SavePlanProps) =>
  tool({
    description:
      "Save a full training or diet plan to the client's dashboard. Use this right after you write them a real plan so they keep it (not just buried in chat). Put the COMPLETE plan in `detail`: the whole weekly structure, every day, exercises/sets/reps or meals/macros, exactly as you wrote it. Ground every prescribed weight in the client's logged lifts and PRs you can see; never prescribe starting weights far below or above their demonstrated strength without saying why in the plan. For a TRAINING plan, ALSO pass `days`: the same program as structured data (every training day with its exercises, sets, reps, and any prescribed loads); that is what lets the client tap 'Start Day 2' on their Workouts page and log the session with your plan pre-filled. Saving becomes their CURRENT plan: any other active plan of the same kind is archived automatically.",
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
      days: z
        .array(
          z.object({
            name: z
              .string()
              .max(80)
              .describe("The day label, e.g. 'Day 1: Upper'."),
            exercises: z
              .array(
                z.object({
                  name: z
                    .string()
                    .max(120)
                    .describe("Standard exercise name, e.g. 'Barbell Bench Press'."),
                  sets: z
                    .number()
                    .int()
                    .min(1)
                    .max(12)
                    .describe("Number of working sets."),
                  reps: z
                    .string()
                    .max(24)
                    .describe("Reps as prescribed: '4-6', '8-12', 'AMRAP', '45s'."),
                  weight: z
                    .number()
                    .nullable()
                    .describe(
                      "Prescribed load, only when the plan names one. Null otherwise."
                    ),
                  unit: z.enum(["lb", "kg"]).describe("Unit of the load."),
                  note: z
                    .string()
                    .max(200)
                    .nullable()
                    .describe("Short cue like 'RPE 8' or '3 min rest'. Null if none."),
                })
              )
              .min(1)
              .max(15),
          })
        )
        .min(1)
        .max(7)
        .nullable()
        .optional()
        .describe(
          "REQUIRED for training plans: the structured training days matching `detail`, so the plan is runnable in the workout logger. Omit (or null) for diet plans."
        ),
    }),
    execute: async ({ title, detail, kind, days }) => {
      // Normalize/validate the structured days in code (snaps names to the
      // exercise library's canonical casing); bad structure degrades to a
      // text-only plan rather than failing the save.
      const normalizedDays =
        kind === "training" && days ? normalizePlanDays(days) : null;

      const created = await createPlan({
        userId: session.user.id,
        title,
        detail,
        kind,
        status: "active",
        source: "chad",
        sourceChatId: chatId,
        days: normalizedDays,
      });
      // The Workouts page renders the runnable plan; refresh it (and /today,
      // which shows the plan card) so the new program appears immediately.
      revalidatePath("/workouts");
      revalidatePath("/today");
      return {
        id: created.id,
        title: created.title,
        message: `${kind === "diet" ? "Diet" : "Training"} plan "${created.title}" saved to the client's dashboard as their current ${kind} plan. Any previous active ${kind} plan was archived.${
          kind === "training"
            ? normalizedDays
              ? " The plan is runnable on their Workouts page; each day has a Start button that pre-fills the logger."
              : " Note: no structured days were attached, so the Workouts page will extract them from the plan text automatically."
            : ""
        }`,
      };
    },
  });
