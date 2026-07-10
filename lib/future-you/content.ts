import { z } from "zod";

// The stored shape of a Future You forecast (FEAT-29), mirrored on
// lib/montage/content.ts: client-safe (no "server-only") because the
// /future-you page renders it directly.

export const futureYouFrameSchema = z.object({
  // "work" frames are the dated checkpoints on the way to the goal; the one
  // "quit" frame is where the member lands at the goal date if they coast.
  kind: z.enum(["work", "quit"]),
  // Weeks from the day the forecast was generated.
  weekOffset: z.number().int().positive(),
  // The real calendar date this checkpoint lands on ("Oct 7, 2026").
  dateLabel: z.string(),
  // The generated forecast photo (Vercel Blob URL). Framed to the member as
  // a calculated forecast (owner order s175: no timid AI-labeling); kept in
  // this table only, never mixed into the progress-photo history.
  imageUrl: z.string(),
  // "About 213 lb" when the goal math produces a number, otherwise null.
  expectedWeightLabel: z.string().nullable(),
  // Chad's read of this frame: what has changed by this date and what it took.
  caption: z.string(),
});

export type FutureYouFrame = z.infer<typeof futureYouFrameSchema>;

export const futureYouContentSchema = z.object({
  // The goal title the forecast was computed against, frozen at generation
  // time so an edited goal doesn't silently relabel an old forecast.
  goalTitle: z.string(),
  // Chad's honest read of the member's CURRENT physique from their photos:
  // the baseline that makes the projected deltas credible.
  physiqueRead: z.string(),
  // Work checkpoints in ascending week order, then the single quit frame.
  frames: z.array(futureYouFrameSchema).min(2).max(5),
  // Chad's closing verdict across both futures.
  verdict: z.string(),
});

export type FutureYouContent = z.infer<typeof futureYouContentSchema>;

/** Safe-parse a stored FutureYouForecast.content row; null when malformed. */
export function parseFutureYouContent(value: unknown): FutureYouContent | null {
  const parsed = futureYouContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** The work-path frames, ascending. */
export function workFrames(content: FutureYouContent): FutureYouFrame[] {
  return content.frames.filter((f) => f.kind === "work");
}

/** The single quit-path frame, if present. */
export function quitFrame(content: FutureYouContent): FutureYouFrame | null {
  return content.frames.find((f) => f.kind === "quit") ?? null;
}
