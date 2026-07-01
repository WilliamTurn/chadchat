import { z } from "zod";

// The structured body of a weekly report (FEAT-12, Elite). This is what the
// compose pass returns, what the WeeklyReport.content json column stores, and
// what the /reports page, the PDF, and the email all render — one shape, no
// drift. Kept in its own client-safe module (no "server-only") because the
// PDF download button imports the type in the browser.

export const weeklyReportContentSchema = z.object({
  headline: z
    .string()
    .describe(
      "a short, concrete title for the report in Chad's voice — references what actually happened this week (e.g. 'Four sessions, protein still short'); no emojis"
    ),
  intro: z
    .string()
    .describe(
      "Chad's opening read on the week: 2-4 sentences, plain text, grounded in the client's real numbers"
    ),
  sections: z
    .array(
      z.object({
        title: z
          .string()
          .describe(
            "section heading (e.g. 'Training', 'Nutrition', 'Bodyweight', 'Photos')"
          ),
        body: z
          .string()
          .describe(
            "2-6 sentences of plain text. Concrete numbers from the data only — never invented. Blank lines allowed between paragraphs."
          ),
      })
    )
    .min(1)
    .max(6)
    .describe(
      "the review itself, one section per area there is data for. Always include a Training section and a Nutrition section (even if the section says nothing was logged — say that bluntly)."
    ),
  adjustments: z
    .array(
      z.object({
        change: z
          .string()
          .describe(
            "one specific adjustment for next week (e.g. 'Add a third back-off set to squats')"
          ),
        reason: z
          .string()
          .describe(
            "why, tied to this week's data (e.g. 'your top single stalled at 275 two sessions in a row')"
          ),
      })
    )
    .min(1)
    .max(5)
    .describe(
      "next week's plan adjustments WITH reasons — the payoff of the report. If the data is thin, the adjustment is about logging/consistency itself."
    ),
  bottomLine: z
    .string()
    .describe(
      "1-2 closing sentences: the single most important order for next week, in Chad's voice"
    ),
});

export type WeeklyReportContent = z.infer<typeof weeklyReportContentSchema>;

/**
 * Parse a WeeklyReport.content json column back into the typed shape. Returns
 * null instead of throwing so one malformed legacy row can never take down the
 * whole /reports page.
 */
export function parseWeeklyReportContent(
  value: unknown
): WeeklyReportContent | null {
  const parsed = weeklyReportContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
