import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";

/**
 * The photo quality gate for Future You (FEAT-29), run BEFORE any image
 * dollars are spent. The vision model reports per-photo facts; the pass/fail
 * decision is computed in code from those facts (never trusted to the model's
 * own aggregate), so the rules are exact and testable:
 *
 *   - every submitted photo must show the member's face clearly (nothing
 *     covering it, no phone over the face, no sunglasses, no heavy shadow),
 *   - at least one photo must show the whole body head to feet,
 *   - every photo must be sharp enough to work from.
 *
 * Weak inputs are the number-one cause of a projection that doesn't look like
 * the member, which is the one failure this feature cannot afford.
 */

export const MIN_PHOTOS = 3;
export const MAX_PHOTOS = 6;

const QC_VOICE =
  "You are Chad, a no-bullshit AI fitness coach, inspecting the reference photos a client submitted for their Future You forecast (photorealistic projections of them at their goal). You judge ONLY what is actually visible. You are direct and blunt, never cruel about their body: this check is about PHOTO QUALITY, not their physique. Complete sentences, plain text. Never use an em dash; use a comma, colon, or period instead.";

const qcSchema = (photoCount: number) =>
  z.object({
    photos: z
      .array(
        z.object({
          faceClearlyVisible: z
            .boolean()
            .describe(
              "True when the person's face is unobstructed and readable, INCLUDING a clean side profile (a profile view is a valid angle and PASSES). False only when something actually covers or hides the face: a phone in front of it, sunglasses, a mask, hair over the features, deep shadow, cropped out of frame, or turned fully away from the camera."
            ),
          wholeBodyVisible: z
            .boolean()
            .describe(
              "True if the person's entire body is in frame, head to feet (feet touching the bottom edge still counts). Judge what is actually in the frame."
            ),
          sharpEnough: z
            .boolean()
            .describe(
              "True if the photo is in focus and well-lit enough to read the person's build and features. Blurry, very dark, or heavily filtered photos are false."
            ),
          issue: z
            .string()
            .nullable()
            .describe(
              "When any check above is false: one short plain sentence naming exactly what is wrong with THIS photo and how to reshoot it. Null when the photo passes."
            ),
        })
      )
      .length(photoCount),
    chadNote: z
      .string()
      .describe(
        "Chad's 1-3 sentence summary of the photo set: what passes, and exactly what to reshoot if anything fails. Photo quality only, never a judgment of their body."
      ),
  });

function mediaTypeFor(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  return ext === "png" ? "image/png" : "image/jpeg";
}

export type PhotoCheck = {
  faceClearlyVisible: boolean;
  wholeBodyVisible: boolean;
  sharpEnough: boolean;
  issue: string | null;
};

export type PhotoSetVerdict = {
  acceptable: boolean;
  photos: PhotoCheck[];
  /** Chad's note, shown to the member verbatim when the set is rejected. */
  chadNote: string;
};

export async function checkPhotoSet(
  photoUrls: string[]
): Promise<PhotoSetVerdict> {
  const images = photoUrls.map((url) => ({
    type: "file" as const,
    mediaType: mediaTypeFor(url),
    data: new URL(url),
  }));

  const { object } = await generateObject({
    model: getLanguageModel(DEFAULT_CHAT_MODEL),
    schema: qcSchema(photoUrls.length),
    system: QC_VOICE,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text" as const,
            text: `The client submitted ${photoUrls.length} reference photos, attached in order. A good set INTENTIONALLY mixes angles: front, side profile, three-quarter, close-up. Judge each photo for what it is (a side profile with a readable face passes the face check; a waist-up shot simply isn't a full-body shot, which is fine as long as one photo in the set is). Report only what you actually see in each frame; do not invent problems. Then give your summary note.`,
          },
          ...images,
        ],
      },
    ],
  });

  // The rules are enforced HERE, from the reported facts.
  const allFacesClear = object.photos.every((p) => p.faceClearlyVisible);
  const allSharp = object.photos.every((p) => p.sharpEnough);
  const hasFullBody = object.photos.some((p) => p.wholeBodyVisible);
  const acceptable = allFacesClear && allSharp && hasFullBody;

  return {
    acceptable,
    photos: object.photos,
    chadNote: object.chadNote,
  };
}
