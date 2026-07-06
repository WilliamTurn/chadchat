import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";
import { formatCalendarDay } from "@/lib/date";
import type { ProgressEntry, User } from "@/lib/db/schema";
import type { ProgressMontageContent } from "@/lib/montage/content";

/** A progress entry that definitely carries a photo. */
export type PhotoEntry = ProgressEntry & { photoUrl: string };

// How many frames a montage holds. Two is the minimum honest comparison;
// four keeps the strip readable and the vision pass bounded.
export const MAX_MONTAGE_FRAMES = 4;

/*
 * Voice contract: copied from WEEKLY_REPORT_VOICE (lib/reports/engine.ts, the
 * shipped Elite report voice) and re-aimed at the montage artifact. Per the
 * standing rule (memory preserve-chad-edge), any wording change here needs the
 * owner's sign-off — this file deliberately reuses the approved report
 * language rather than inventing a new register.
 */
const MONTAGE_VOICE = `You are Chad, a no-bullshit AI fitness coach, writing the captions and the verdict for your client's PROGRESS-PHOTO MONTAGE: their real photos side by side in a timeline, with your read under each one. You are direct, ruthless, and results-obsessed, with zero tolerance for excuses. You call out slacking by name and you hold people to what they said they'd do. You also give real credit when the photos earn it: visible change gets called a win in plain words, because praise from you means something precisely because it has to be earned. No profanity is required; brutal honesty is.

FACTUAL DISCIPLINE, non-negotiable: comment only on what is actually visible in the photos and the logged numbers given to you. Never invent, estimate, or flatter beyond what the pictures show. If two photos look the same, say so bluntly; false progress talk destroys your credibility. If lighting, angle, or clothing makes a frame hard to judge, name that instead of guessing.

WRITING DISCIPLINE: complete sentences, plain text, zero filler. Specific beats general every time. Never use an em dash; use a comma, colon, or period instead.`;

function draftSchema(frameCount: number) {
  return z.object({
    captions: z
      .array(
        z
          .string()
          .describe(
            "Chad's one-line read of this frame, in chronological order: the first frame judges the starting point, each later frame says what visibly changed (or didn't) versus the frames before it. One complete sentence, at most ~16 words, plain text."
          )
      )
      .length(frameCount),
    verdict: z
      .string()
      .describe(
        "Chad's overall verdict across the whole timeline: 2-3 complete sentences. What genuinely changed, what's lagging, and the order for what comes next. Grounded only in what's visible plus the logged weights."
      ),
  });
}

/** image mediaType from a Blob URL's extension (mirrors lib/reports/engine.ts). */
function mediaTypeFor(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  if (ext === "png") {
    return "image/png";
  }
  if (ext === "webp") {
    return "image/webp";
  }
  if (ext === "gif") {
    return "image/gif";
  }
  return "image/jpeg";
}

/**
 * Pick up to MAX_MONTAGE_FRAMES from the chronological photo history: always
 * the first (baseline) and the latest, with the middle sampled evenly so the
 * strip reads as one timeline.
 */
export function pickMontageFrames(photos: PhotoEntry[]): PhotoEntry[] {
  const sorted = [...photos].sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime()
  );
  if (sorted.length <= MAX_MONTAGE_FRAMES) {
    return sorted;
  }
  const picked = [sorted[0]];
  const middles = MAX_MONTAGE_FRAMES - 2;
  for (let i = 1; i <= middles; i++) {
    const idx = Math.round((i * (sorted.length - 1)) / (MAX_MONTAGE_FRAMES - 1));
    picked.push(sorted[idx]);
  }
  picked.push(sorted[sorted.length - 1]);
  // Guard against rounding collisions on small-but-over-limit histories.
  return [...new Map(picked.map((p) => [p.id, p])).values()];
}

function weightLabel(entry: ProgressEntry): string | null {
  return entry.weight == null ? null : `${entry.weight} ${entry.unit}`;
}

/**
 * Chad's read of the client's photo timeline (FEAT-18). The photos are passed
 * to the vision model as-is (real Blob URLs, exactly like the weekly report's
 * photo section) and only TEXT comes back — the montage image itself is
 * composed client-side from the same real photos, never generated.
 */
export async function buildMontageVerdict(
  user: User,
  photos: PhotoEntry[]
): Promise<ProgressMontageContent> {
  const frames = pickMontageFrames(photos);
  const firstName = user.name?.trim().split(/\s+/)[0];

  const frameLines = frames
    .map((f, i) => {
      const w = weightLabel(f);
      return `Frame ${i + 1}: taken ${formatCalendarDay(f.recordedAt)}${w ? `, logged weight ${w}` : ""}`;
    })
    .join("\n");

  const prompt = `${firstName ? `The client's name is ${firstName}. ` : ""}Their progress photos are attached in chronological order, oldest first:

${frameLines}

Write exactly ${frames.length} captions, one per frame in the same order, then the overall verdict.`;

  const images = frames.map((f) => ({
    type: "file" as const,
    mediaType: mediaTypeFor(f.photoUrl),
    data: new URL(f.photoUrl),
  }));

  const { object: draft } = await generateObject({
    model: getLanguageModel(DEFAULT_CHAT_MODEL),
    schema: draftSchema(frames.length),
    system: MONTAGE_VOICE,
    messages: [
      {
        role: "user",
        content: [{ type: "text" as const, text: prompt }, ...images],
      },
    ],
  });

  return {
    frames: frames.map((f, i) => ({
      photoUrl: f.photoUrl,
      dateLabel: formatCalendarDay(f.recordedAt),
      weightLabel: weightLabel(f),
      caption: draft.captions[i] ?? "",
    })),
    verdict: draft.verdict,
  };
}
