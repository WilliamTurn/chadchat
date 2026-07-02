import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { canAccessProFeatures } from "@/lib/admin";
import { parseCalendarDay } from "@/lib/date";
import { createProgressEntry } from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";
import { progressEntrySchema } from "@/lib/validation/progress";

type LogWeighInProps = {
  session: Session;
  user: User;
};

/**
 * Lets Chad log a weigh-in the client reports in chat into their progress
 * tracker (FEAT-14). Runs the exact same validation the /progress form uses
 * (`progressEntrySchema`) and stores through the same query, so it feeds the
 * weight trend, goal progress and Chad's own snapshot. Pro-gated like the page.
 */
export const logWeighIn = ({ session, user }: LogWeighInProps) =>
  tool({
    description:
      "Log a weigh-in the client reports into their progress tracker so it feeds their weight trend and goal progress. Use when they tell you what they weigh and either ask you to log it or say yes when you offer. Pass the number exactly as they said it. Never log a weight they didn't report.",
    inputSchema: z.object({
      weight: z
        .number()
        .positive()
        .max(2000)
        .describe("The weight they reported."),
      unit: z
        .enum(["lb", "kg"])
        .default("lb")
        .describe("The unit the client used. US clients usually mean lb."),
      recordedAt: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
        .nullable()
        .optional()
        .describe("The day they weighed in (YYYY-MM-DD). Omit for today."),
      note: z
        .string()
        .max(500)
        .nullable()
        .optional()
        .describe("Optional context they gave, e.g. 'after vacation'."),
    }),
    execute: async ({ weight, unit, recordedAt, note }) => {
      if (!canAccessProFeatures(user)) {
        return {
          error:
            "This client's plan doesn't include the progress tracker; it's part of Chad Pro. Tell them to upgrade to have you track their weight.",
        };
      }

      const parsed = progressEntrySchema.safeParse({
        recordedAt: recordedAt ?? undefined,
        weight,
        unit,
        note: note ?? null,
      });
      if (!parsed.success) {
        return {
          error:
            parsed.error.errors[0]?.message ?? "Couldn't log that weigh-in.",
        };
      }

      const created = await createProgressEntry({
        userId: session.user.id,
        recordedAt: parseCalendarDay(parsed.data.recordedAt) ?? new Date(),
        weight: parsed.data.weight ?? null,
        unit: parsed.data.unit,
        photoUrl: null,
        note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
      });

      return {
        id: created.id,
        message: `Weigh-in of ${weight} ${unit} logged to the client's progress tracker${recordedAt ? ` for ${recordedAt}` : " for today"}.`,
      };
    },
  });
