import { z } from "zod";

// The stored shape of a progress-photo montage (FEAT-18), mirrored on
// lib/reports/content.ts: client-safe (no "server-only") because the
// /progress card renders it and the canvas exporter draws from it.

export const progressMontageContentSchema = z.object({
  frames: z
    .array(
      z.object({
        // The member's real uploaded photo (Vercel Blob URL) — the montage is
        // assembled from these as-is, never redrawn.
        photoUrl: z.string(),
        dateLabel: z.string(),
        // "212.4 lb" when the entry carried a weigh-in, otherwise null.
        weightLabel: z.string().nullable(),
        // Chad's one-line read of this frame.
        caption: z.string(),
      })
    )
    .min(2)
    .max(4),
  // Chad's overall verdict across the whole timeline.
  verdict: z.string(),
});

export type ProgressMontageContent = z.infer<
  typeof progressMontageContentSchema
>;

/** Safe-parse a stored ProgressMontage.content row; null when malformed. */
export function parseProgressMontageContent(
  value: unknown
): ProgressMontageContent | null {
  const parsed = progressMontageContentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
