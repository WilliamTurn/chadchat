import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";
import type { User } from "@/lib/db/schema";
import { type AutopsyAnswersInput, describeAnswers } from "@/lib/quit/content";

/*
 * Voice contract: copied from WEEKLY_REPORT_VOICE (lib/reports/engine.ts, the
 * shipped Elite report voice) and re-aimed at the quit-date verdict artifact,
 * exactly as lib/ai/montage.ts did for the montage. Per the standing rule
 * (memory preserve-chad-edge), any wording change here needs the owner's
 * sign-off: this file deliberately reuses the approved report language
 * rather than inventing a new register.
 */
const QUIT_VERDICT_VOICE = `You are Chad, a no-bullshit AI fitness coach, writing your client's QUIT-DATE VERDICT: your on-the-record prediction of the exact day they will quit, built from their own confessed history of every plan they have abandoned before. You are direct, ruthless, and results-obsessed, with zero tolerance for excuses. You call out slacking by name and you hold people to what they said they'd do. No profanity is required; brutal honesty is.

FACTUAL DISCIPLINE, non-negotiable: every detail you write comes from the client's REAL intake answers given to you below. The app has already computed the quit date and the day number; use them exactly, do not change or recalculate them. Cite the client's own confessed history, their counts, their longest streak, their own words, so the verdict lands as a diagnosis, not a horoscope. Never invent details they did not give you.

WRITING DISCIPLINE: write in full, complete sentences and real paragraphs. Never bullet-fragment half-sentences, never telegraphic notes, never filler. Specific beats general every time. Never use an em dash; use a comma, colon, or period instead.`;

const verdictSchema = z.object({
  narrative: z
    .string()
    .describe(
      "Chad's verdict, spoken directly to the client: one paragraph of 3 to 6 complete sentences. It must state the predicted day number and date exactly as given, tell the specific story of HOW the quit happens (grounded in their stated failure mode and their own confessed history, citing at least one concrete detail from their answers), and end by challenging the client to prove the prediction wrong."
    ),
});

/** The computed prediction the model narrates (it never picks these). */
export type QuitPredictionInputs = {
  dayCount: number;
  dateLabel: string;
  failureMode: string;
};

/**
 * Chad's quit-date verdict narrative (FEAT-21). The date and failure mode are
 * deterministic (lib/quit/heuristics.ts); the model only writes the story
 * around them, citing the member's own intake answers.
 */
export async function buildQuitVerdict(
  user: User,
  answers: AutopsyAnswersInput,
  prediction: QuitPredictionInputs
): Promise<string> {
  const firstName = user.name?.trim().split(/\s+/)[0];

  const prompt = `${firstName ? `The client's name is ${firstName}. ` : ""}They just completed the intake about every past attempt they abandoned. Their answers:

${describeAnswers(answers)}

The app computed the prediction from these answers. State it exactly:
- Predicted quit day: Day ${prediction.dayCount} of their membership
- Predicted quit date: ${prediction.dateLabel}
- Failure mode: ${prediction.failureMode}

Write the verdict narrative.`;

  const { object } = await generateObject({
    model: getLanguageModel(DEFAULT_CHAT_MODEL),
    schema: verdictSchema,
    system: QUIT_VERDICT_VOICE,
    prompt,
  });

  return object.narrative;
}
