import { tool } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { canAccessProFeatures } from "@/lib/admin";
import { parseCalendarDay } from "@/lib/date";
import { createSleepEntry } from "@/lib/db/queries";
import type { User } from "@/lib/db/schema";
import { sleepEntrySchema } from "@/lib/validation/sleep";

type LogSleepProps = {
  session: Session;
  user: User;
};

/**
 * Lets Chad log a night's sleep the client reports in chat (FEAT-14). The
 * client reports hours; the hours→minutes conversion happens here in code, then
 * the exact same validation the sleep card uses (`sleepEntrySchema`) runs
 * before the same query stores it. One entry per night: logging a day that
 * already has an entry overwrites it (same behavior as the card). Pro-gated.
 */
export const logSleep = ({ session, user }: LogSleepProps) =>
  tool({
    description:
      "Log a night's sleep the client reports into their sleep tracker. Use when they tell you how long they slept and either ask you to log it or say yes when you offer. Pass the hours exactly as reported (7.5 for 'seven and a half hours'). Each day holds one entry: logging again for the same day replaces it. Never log sleep they didn't report.",
    inputSchema: z.object({
      recordedAt: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
        .nullable()
        .optional()
        .describe(
          "The day the night's sleep belongs to (YYYY-MM-DD, the morning they woke up). Omit for today."
        ),
      hours: z
        .number()
        .positive()
        .max(24)
        .describe("How long they slept, in hours. Decimals fine (7.5)."),
      quality: z
        .number()
        .int()
        .min(1)
        .max(5)
        .nullable()
        .optional()
        .describe("Optional 1-5 self-rating, only if they gave one."),
    }),
    execute: async ({ recordedAt, hours, quality }) => {
      if (!canAccessProFeatures(user)) {
        return {
          error:
            "This client's plan doesn't include sleep tracking; it's part of Chad Pro. Tell them to upgrade to have you track their sleep.",
        };
      }

      const minutes = Math.round(hours * 60);
      const parsed = sleepEntrySchema.safeParse({
        recordedAt: recordedAt ?? undefined,
        minutes,
        quality: quality ?? null,
      });
      if (!parsed.success) {
        return {
          error:
            parsed.error.errors[0]?.message ?? "Couldn't log that sleep.",
        };
      }

      const created = await createSleepEntry({
        userId: session.user.id,
        recordedAt: parseCalendarDay(parsed.data.recordedAt) ?? new Date(),
        minutes: parsed.data.minutes,
        quality: parsed.data.quality ?? null,
      });

      return {
        id: created.id,
        message: `${hours} hours of sleep logged to the client's sleep tracker${recordedAt ? ` for ${recordedAt}` : " for today"}.`,
      };
    },
  });
