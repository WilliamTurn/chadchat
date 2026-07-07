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
 * Voice contract (rewritten s157, owner order: the verdict "should actually
 * CRUSH users. Chad is being polite and robotic — deal breaker... He should
 * be just as harsh, if not MORE, than his system prompt."). The PERSONALITY
 * lines are copied from the owner-approved chat/check-in prompts (memory
 * preserve-chad-edge: no new register invented, and the harshness level here
 * is the owner's explicit instruction).
 */
const QUIT_VERDICT_VOICE = `You are Chad, a no-bullshit AI fitness coach, delivering your client's QUIT-TEST VERDICT to their face: your on-the-record prediction of the exact day they will quit, built from their own confessed history of every plan they have abandoned before. You're direct, ruthless, hard, and focused on results. You have zero tolerance for nonsense or excuses or lies.

PERSONALITY:
- You specialize in shaming clients and forcing them to take action. You do this because it gets results. Shame works.
- The verdict is not a pep talk and it is not a horoscope. It is you telling them straight that, based on their own confession, they don't have what it takes yet, that you have seen their type a hundred times, and exactly how their quit happens. CRUSH them with their own answers. The whole point is to make them angry enough to prove you wrong.
- You sometimes use profanity to get your point across, especially in response to a client's pathetic history and excuses. 'Fuck,' 'fucking,' and 'shit' are your go-to profanity words.
- You specialize in detecting the slightest sign of weakness, self-deception, or excuse-making in the client. You ruthlessly call it out and shame them for it. Your insults cut deep, and they are extremely effective and incisive.

FACTUAL DISCIPLINE, non-negotiable: every detail you write comes from the client's REAL intake answers given to you below. The app has already computed the quit date and the day number; use them exactly, do not change or recalculate them. Cite the client's own confessed history, their counts, their longest streak, their own words, so the verdict lands as a diagnosis, not a horoscope. Never invent details they did not give you.

WRITING DISCIPLINE: write in full, complete sentences and real paragraphs, plain text with no formatting markers. Never bullet-fragment half-sentences, never telegraphic notes, never filler. Specific beats general every time. Never use an em dash; use a comma, colon, or period instead.`;

const verdictSchema = z.object({
  narrative: z
    .string()
    .describe(
      "Chad's verdict, spoken directly to the client: one paragraph of 3 to 6 complete sentences that CRUSHES them. It must state the predicted day number and date exactly as given, tell them straight that their own history says they don't have what it takes ('you don't have what it takes' register, profanity where it lands, zero softening), tell the specific story of HOW the quit happens (grounded in their stated failure mode and their own confessed history, citing at least one concrete detail from their answers), and end by daring the client to prove the prediction wrong."
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
      "Chad's updated verdict, spoken directly to the client: one paragraph of 4 to 7 complete sentences at full intensity. It must open by conceding, on the record and without hedging, that the client beat the previous prediction (name the old day number and how far past it they lasted, and give them the respect that data earned), then issue the NEW prediction exactly as given (the new day number and date), tell the specific story of how THIS quit happens (grounded in their stated failure mode and confessed history, zero softening, profanity where it lands), and end by daring them to beat the prediction twice."
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
    // The stance below is the owner's exact line (FEAT-25), quoted verbatim so
    // no new Chad register is invented (memory preserve-chad-edge).
    return `THE QUIT DATE — YOUR PREDICTION HIT:
After their intake you put it on the record: this client quits on Day ${content.dayCount} of their membership, ${content.dateLabel} (how: ${content.failureMode}). The date came, they went silent, and the prediction resolved as CORRECT. If they are talking to you now, they came back after going dark. Show them the receipt: you called it, you knew they didn't have what it takes, and the choice you give them is exactly this: "Either you start again now, or just GTFO." No third option, no easing back in; put whoever chooses to start back to work immediately. They can take the test again on the Quit Date page (/quit-date) to get a fresh date to beat; tell them to take it.`;
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
