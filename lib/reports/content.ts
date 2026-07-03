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
      "Chad's opening read on the week: one full paragraph (4-8 complete sentences), plain text, grounded in the client's real numbers. Sets the verdict for the week up front: what went right, what went wrong, in his voice."
    ),
  sections: z
    .array(
      z.object({
        title: z
          .string()
          .describe(
            "section heading (e.g. 'Training', 'Nutrition', 'Bodyweight', 'Sleep', 'Photos', 'Goal check')"
          ),
        body: z
          .string()
          .describe(
            "a substantial, fully-written review of this area: one to three real paragraphs (separate paragraphs with a blank line). Complete sentences only, never fragments or bullet-style half-lines. Every claim tied to a concrete number or entry from the data, never invented."
          ),
      })
    )
    .min(1)
    .max(8)
    .describe(
      "the review itself, one full section per area there is data for. Always include a Training section and a Nutrition section (even if the section says nothing was logged: say that bluntly). Add Bodyweight, Sleep, Water, Measurements, Photos, and a Goal check whenever the week's data gives them substance."
    ),
  adjustments: z
    .array(
      z.object({
        change: z
          .string()
          .describe(
            "one specific adjustment for next week, written as a complete instruction (e.g. 'Add a third back-off set to squats at 80% of your top set')"
          ),
        reason: z
          .string()
          .describe(
            "why, as a complete sentence tied to this week's data (e.g. 'Your top single stalled at 275 two sessions in a row, and more volume at a manageable weight is how it gets moving again.')"
          ),
      })
    )
    .min(1)
    .max(5)
    .describe(
      "next week's plan adjustments WITH reasons (the payoff of the report). Each one earned by a specific number from this week. If the data is thin, the adjustment is about logging/consistency itself."
    ),
  bottomLine: z
    .string()
    .describe(
      "2-4 closing sentences: the single most important order for next week, in Chad's voice, plus credit or a warning, whichever the week earned"
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
