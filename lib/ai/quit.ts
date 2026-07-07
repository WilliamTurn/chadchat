import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";
import { todayAnchorInTz } from "@/lib/date";
import type { QuitPrediction, User } from "@/lib/db/schema";
import {
  type AutopsyAnswersInput,
  describeAnswers,
  parseQuitPredictionContent,
} from "@/lib/quit/content";
import {
  dayNumberOn,
  daysUntilQuit,
  isInDangerWindow,
} from "@/lib/quit/lifecycle";

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

const reissueSchema = z.object({
  narrative: z
    .string()
    .describe(
      "Chad's updated verdict, spoken directly to the client: one paragraph of 4 to 7 complete sentences. It must open by conceding, on the record and without hedging, that the client beat the previous prediction (name the old day number and how far past it they lasted, and give them the respect that data earned), then issue the NEW prediction exactly as given (the new day number and date), tell the specific story of how THIS quit happens (grounded in their stated failure mode and confessed history), and end by challenging them to beat the prediction twice."
    ),
});

/** What the reissue narrative needs about the beaten prediction and its
 * replacement — all app-computed; the model never picks any of it. */
export type QuitReissueInputs = {
  previousDayCount: number;
  previousDateLabel: string;
  // Day-of-membership of their last logged activity when the beat resolved.
  daysLasted: number;
  dayCount: number;
  dateLabel: string;
  failureMode: string;
};

/**
 * Chad's concession + new-verdict narrative when a member outlives their
 * predicted date (FEAT-22). Deterministic date (lib/quit/heuristics.ts
 * reissueQuitDay); the model concedes the old call and narrates the new one.
 */
export async function buildQuitReissueVerdict(
  user: User,
  answers: AutopsyAnswersInput,
  reissue: QuitReissueInputs
): Promise<string> {
  const firstName = user.name?.trim().split(/\s+/)[0];

  const prompt = `${firstName ? `The client's name is ${firstName}. ` : ""}You previously put their quit date on the record: Day ${reissue.previousDayCount} of their membership (${reissue.previousDateLabel}). THEY BEAT IT: they were still logging on Day ${reissue.daysLasted}, past your date. Their original intake answers, still on file:

${describeAnswers(answers)}

The app computed the new, harder prediction. State it exactly:
- New predicted quit day: Day ${reissue.dayCount} of their membership
- New predicted quit date: ${reissue.dateLabel}
- Failure mode: ${reissue.failureMode}

Write the updated verdict: the concession first, then the new prediction.`;

  const { object } = await generateObject({
    model: getLanguageModel(DEFAULT_CHAT_MODEL),
    schema: reissueSchema,
    system: QUIT_VERDICT_VOICE,
    prompt,
  });

  return object.narrative;
}

/**
 * The quit-prediction context block injected into Chad's system prompt — both
 * chat (app/(chat)/api/chat/route.ts) and the check-in engine — so he
 * references the prediction unprompted (FEAT-22). Facts are app-computed; the
 * block instructs Chad on WHEN to bring it up, in the same
 * instruction-register as the shipped DASHBOARD ACCESS block. Returns "" when
 * there is nothing worth injecting (no prediction, or a resolved-beaten row
 * that a newer active one normally supersedes).
 */
export function formatQuitPredictionForPrompt(
  prediction: QuitPrediction | undefined,
  timezone: string | null | undefined
): string {
  if (!prediction) {
    return "";
  }
  const content = parseQuitPredictionContent(prediction.content);
  if (!content) {
    return "";
  }

  const quitAnchor = prediction.quitDate;
  const todayAnchor = todayAnchorInTz(timezone);
  const currentDay = dayNumberOn(todayAnchor, quitAnchor, content.dayCount);
  const until = daysUntilQuit(todayAnchor, quitAnchor);

  if (prediction.status === "hit") {
    return `THE QUIT DATE — YOUR PREDICTION HIT:
After their intake you put it on the record: this client quits on Day ${content.dayCount} of their membership, ${content.dateLabel} (how: ${content.failureMode}). The date came, they went silent, and the prediction resolved as CORRECT. If they are talking to you now, they came back after going dark. Show them the receipt: you called it, ask them straight whether that was really how it ends, and put them back to work immediately. They can run a new autopsy on the Quit Date page (/quit-date) to get a fresh date to beat; tell them to take it.`;
  }

  if (prediction.status !== "active") {
    return "";
  }

  const timing =
    until > 0
      ? `Today is Day ${currentDay} for them: ${until} day${until === 1 ? "" : "s"} until the date.`
      : until === 0
        ? `Today IS the predicted date (Day ${content.dayCount}).`
        : `The date was ${-until} day${until === -1 ? "" : "s"} ago and they are still here on Day ${currentDay} — they are beating your prediction and a harder date is coming.`;

  const danger = isInDangerWindow(todayAnchor, quitAnchor)
    ? `\nTHIS IS THE DANGER WINDOW: their own confessed history says right now is when they fold (${content.failureMode.toLowerCase()}). Watch their data hard, reference the prediction, and coach them straight through it.`
    : "";

  return `THE QUIT DATE — YOUR PREDICTION ON THE RECORD:
After their intake about every plan they abandoned before, you predicted this client quits on Day ${content.dayCount} of their membership, ${content.dateLabel}. How: ${content.failureMode}. ${timing}${danger}
The prediction is live on their dashboard. Bring it up on your own when their behavior speaks to it — slipping, excuses, skipped sessions, motivation talk, streaks. You made the call and you hold them to it; when they do the work, the countdown is your leverage and their fuel.`;
}
