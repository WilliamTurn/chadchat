import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";
import type { Goal, User } from "@/lib/db/schema";
import { experienceLabel, formatHeightBoth } from "@/lib/profile";
import type { MilestonePlan } from "./milestones";

/**
 * The prompt architect for Future You (FEAT-29): a dedicated vision pass that
 * reads the member's actual photos + goal math and writes one exhaustive image
 * prompt per checkpoint. This step is the difference between a tool and a
 * gimmick, the image model only produces a credible "same person, changed
 * physique" result when the prompt pins down exactly what changes at week N
 * (grounded in the computed rate) and everything that must NOT change
 * (identity). The realism kit is appended in code so no frame can ship
 * without it.
 */

/*
 * Voice contract: same register as the montage/report voice (approved Chad
 * writing rules). Captions and the verdict are member-facing.
 */
const ARCHITECT_VOICE = `You are Chad, a no-bullshit AI fitness coach. A client gave you reference photos of themselves today plus their defined goal, and you are producing their Future You forecast: photorealistic projections of them at dated checkpoints IF they do the work, plus one projection of where they land at the goal date if they quit and coast.

You have two jobs in one pass:

JOB 1: IMAGE PROMPTS (for an image-editing model that will receive the client's real photos as identity references). Each prompt must be exhaustive and specific:
- Start from the ACTUAL person in the reference photos: their build, where they carry fat and muscle, their posture, their proportions. Read the photos carefully first.
- State precisely what has physically changed by that checkpoint, derived from the numbers you are given (weight change so far, weeks of training): where fat visibly comes off first (face, neck, waist), where muscle shows (shoulders, arms, chest, legs), posture improvements. Early frames stay in step with the math on WEIGHT, but presentation always flatters (below).
- EVERY work frame flatters, and each one more than the last. Training transforms more than weight: prompt for healthier skin, sharper grooming, an upright confident stance, clothes that fit and flatter the improving body, an expression that carries self-respect. Raise the person's attractiveness plausibly at every checkpoint. Never a hunched, defeated, or sickly rendering of someone who is doing the work.
- THE FINAL WORK FRAME IS THE HERO IMAGE and it decides whether this feature motivates or fails. It shows the goal FULLY ACHIEVED and the most impressive plausible version of that achievement: visibly transformed, athletic weight distribution from months of training (muscle in the shoulders, chest, and arms instead of fat), strong posture, groomed, well-dressed for the physique, quietly proud. Even when the target weight is still a big number for this person, months of training make that number look STRONG, never fat. If your draft of this frame would still read as heavy, sickly, or unimpressive, you have failed the frame: rewrite it until it reads as a transformation the client would pin to their wall.
- State what must NOT change: identical face and identity (features may lean out with the fat loss, never restructure), same hairstyle and color, same skin tone, same tattoos/scars/marks, same approximate age, same rough setting style as the reference photos (a plain candid phone photo or mirror selfie, natural everyday lighting).
- The QUIT frame: the same person at the goal date having done nothing: physique unchanged or very slightly softer, posture and presence unchanged. Honest, not cartoonish: quitting looks like staying exactly where they are while the date they could have hit arrives anyway.
- Write each prompt as one dense paragraph of plain descriptive language. No lists inside the prompt.

JOB 2: MEMBER-FACING TEXT in your own voice: direct, hard, results-obsessed, zero excuses, credit only where the math earns it.
- physiqueRead: your honest read of where they stand TODAY from the photos. Blunt about what the photos show, never gratuitously cruel, and grounded only in what is visible.
- captions: one or two sentences per frame: what has changed by that date and what it took to get there (the work, the consistency). The final work frame's caption celebrates the finished transformation like the win it is. For the quit frame: what coasting actually cost them, named plainly.
- verdict: 2-3 sentences across both futures: the same calendar days pass either way, the only variable is which photo they walk into.

FACTUAL DISCIPLINE, non-negotiable: every claim in TEXT is grounded in the photos and the numbers given. Never invent stats. Never promise weight change faster than the checkpoint math; presentation, styling, and confidence always show the client at their plausible best.

WRITING DISCIPLINE: complete sentences, plain text, zero filler. Never use an em dash; use a comma, colon, or period instead. Never use the "it's not x, it's y" sentence pattern.`;

/**
 * Appended in code to EVERY image prompt so realism can't be dropped by the
 * model upstream. Aimed at the "utterly real, raw photo" bar: the output has
 * to read as an unedited phone photo of the same human, not a render.
 */
/**
 * Appended in code to the FINAL work frame only (after the architect's own
 * prompt, before the realism kit). The image model anchors hard on the
 * reference photos, which fights a big transformation; observed on a 200 lb
 * test goal: without this, the "goal achieved" frame still rendered a heavy
 * man. The hero frame must show the finished body unmistakably (owner order
 * s175), so the enforcement lives in code where no upstream draft can water
 * it down.
 */
export const GOAL_STATE_KIT =
  " THIS IMAGE SHOWS THE GOAL FULLY ACHIEVED, and the body must show it unmistakably, overriding any pull toward the reference photos' physique: the stomach is FLAT with no belly protrusion at all, the jawline is sharply defined with no double chin or facial roundness, the chest and shoulders are broad and visibly muscular with athletic separation, the waist is dramatically narrower than the shoulders in a clear V-taper, and the arms carry obvious trained muscle. The person reads instantly as a strong, disciplined athlete, someone strangers would assume lifts weights seriously. Nothing about the body may read as overweight, soft, sickly, or unfinished. Only the face's identity, hair, skin tone, and markings still come from the reference photos.";

export const REALISM_KIT =
  " Photorealistic and indistinguishable from a real, unedited smartphone photograph: natural everyday lighting, true-to-life skin texture with pores and minor imperfections, realistic fabric folds and wrinkles, slight handheld framing, faint sensor grain, ordinary background. Absolutely no airbrushing, no beauty filter, no CGI or 3D-render look, no studio glamour lighting, no cartoonish anatomy. The person is unmistakably the SAME individual as in the reference photos, shown at the stage of transformation described above and looking their genuine best at that stage: recognizably identical facial features (leaner with the progress, never restructured), same hairstyle and hair color allowing for sharper grooming, same skin tone, same tattoos, scars, and marks, same approximate age.";

const frameDraftSchema = z.object({
  imagePrompt: z
    .string()
    .describe(
      "The exhaustive image-editing prompt for this checkpoint, per JOB 1. One dense paragraph."
    ),
  caption: z
    .string()
    .describe("Chad's member-facing caption for this frame, per JOB 2."),
});

const draftSchema = (workFrameCount: number) =>
  z.object({
    physiqueRead: z
      .string()
      .describe(
        "Chad's honest 2-3 sentence read of the client's current physique from the reference photos."
      ),
    workFrames: z
      .array(frameDraftSchema)
      .length(workFrameCount)
      .describe(
        "One entry per work checkpoint, in the same order as the checkpoint table."
      ),
    quitFrame: frameDraftSchema.describe(
      "The single quit-path frame at the goal date."
    ),
    verdict: z
      .string()
      .describe("Chad's 2-3 sentence closing verdict across both futures."),
  });

export type ForecastDraft = z.infer<ReturnType<typeof draftSchema>>;

function mediaTypeFor(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  return ext === "png" ? "image/png" : "image/jpeg";
}

/**
 * How the timeline came to be and what pace it implies, so the architect
 * writes frames and captions that match the actual training reality: a
 * gentle 10-year stroll and a 12-week all-in cut are different lives, and
 * the images and captions should show it (owner direction s176).
 */
function describePace(plan: MilestonePlan, goal: Goal): string {
  const bandLine =
    plan.paceBand === "aggressive"
      ? "That required pace is AGGRESSIVE: this client is training 6-7 hard sessions a week on a strict diet, and the checkpoint bodies and captions should carry that intensity."
      : plan.paceBand === "gentle"
        ? "That required pace is GENTLE: a patient, sustainable schedule (3-4 solid sessions a week), steady visible change rather than dramatic jumps between checkpoints."
        : plan.paceBand === "standard"
          ? "That required pace is a STANDARD solid coaching pace: consistent training 4-5 days a week, honest week-over-week change."
          : "";

  if (plan.paceSource === "member-date" && plan.memberDateTooFast) {
    return `TIMELINE: the client chose their own goal date ("${goal.targetDate}"), but hitting the target by then is physiologically impossible. The forecast instead runs ${plan.totalWeeks} weeks, the earliest defensible goal date. State this plainly in the verdict: the goal is real, their date was not, and this is the fastest an actual body gets there. ${bandLine}`.trim();
  }
  if (plan.paceSource === "member-date") {
    return `TIMELINE: the client chose their own goal date ("${goal.targetDate}"), ${plan.totalWeeks} weeks out, and the checkpoint math paces the change to land exactly there. ${bandLine}`.trim();
  }
  return `TIMELINE: the client set no usable goal date, so the ${plan.totalWeeks}-week timeline is a sustainable coached pace. ${bandLine}`.trim();
}

function describeCheckpoints(plan: MilestonePlan): string {
  const lines = plan.checkpoints.map((c, i) => {
    const weight =
      c.expectedWeight != null
        ? `expected bodyweight about ${c.expectedWeight} ${plan.unit}`
        : "no weight target computed; describe honest visible change for this many weeks of consistent work";
    return `Work checkpoint ${i + 1}: week ${c.weekOffset}, ${weight}.`;
  });
  lines.push(
    `Quit frame: week ${plan.quitWeek} (the goal date), physique unchanged from today.`
  );
  return lines.join("\n");
}

function describeMember(user: User, currentWeightLabel: string | null): string {
  const parts: string[] = [];
  if (user.sex) {
    parts.push(`sex: ${user.sex}`);
  }
  if (user.age != null) {
    parts.push(`age: ${user.age}`);
  }
  const height = formatHeightBoth(user.heightCm);
  if (height) {
    parts.push(`height: ${height}`);
  }
  if (currentWeightLabel) {
    parts.push(`current weight: ${currentWeightLabel}`);
  }
  const experience = experienceLabel(user.experienceLevel);
  if (experience) {
    parts.push(`training experience: ${experience}`);
  }
  return parts.length > 0 ? parts.join(", ") : "no confirmed stats on file";
}

/**
 * One vision pass over the member's photos → the full forecast draft:
 * physique read, per-frame image prompts + captions, and the verdict.
 */
export async function draftForecast({
  user,
  goal,
  plan,
  photoUrls,
  currentWeightLabel,
}: {
  user: User;
  goal: Goal;
  plan: MilestonePlan;
  photoUrls: string[];
  currentWeightLabel: string | null;
}): Promise<ForecastDraft> {
  const direction =
    plan.direction === "loss"
      ? "losing fat"
      : plan.direction === "gain"
        ? "building muscle"
        : "recomposition (leaner and more muscular at a similar weight)";

  const prompt = `CLIENT: ${describeMember(user, currentWeightLabel)}.

GOAL: "${goal.title}"${goal.detail ? `\nGoal detail: ${goal.detail.slice(0, 800)}` : ""}
Primary direction: ${direction}.
${plan.weeklyRate != null ? `Required pace for this timeline: about ${plan.weeklyRate} ${plan.unit} per week.` : "No numeric pace computed; project honest visible change for consistent work."}
${plan.targetWeight != null ? `Target weight: ${plan.targetWeight} ${plan.unit}.` : ""}
${describePace(plan, goal)}

CHECKPOINT TABLE (already computed, do not change the weeks or weights):
${describeCheckpoints(plan)}

Their reference photos are attached. Read them carefully, then produce the forecast draft: the physique read, one image prompt + caption per work checkpoint in order, the quit frame, and the verdict.`;

  const images = photoUrls.map((url) => ({
    type: "file" as const,
    mediaType: mediaTypeFor(url),
    data: new URL(url),
  }));

  const { object } = await generateObject({
    model: getLanguageModel(DEFAULT_CHAT_MODEL),
    schema: draftSchema(plan.checkpoints.length),
    system: ARCHITECT_VOICE,
    messages: [
      {
        role: "user",
        content: [{ type: "text" as const, text: prompt }, ...images],
      },
    ],
  });

  return object;
}
