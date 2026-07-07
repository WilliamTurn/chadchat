import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { buildDayLog } from "@/lib/ai/dashboard";
import {
  formatGoalsForPrompt,
  formatMemoryForPrompt,
  formatProfileForPrompt,
} from "@/lib/ai/memory";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";
import { formatQuitPredictionForPrompt } from "@/lib/ai/quit";
import {
  type CheckInSlot,
  dueCheckInSlot,
} from "@/lib/checkins/schedule";
import {
  formatCalendarDay,
  formatDayInTz,
  todayAnchorInTz,
  todayStartInTz,
} from "@/lib/date";
import {
  createCheckIn,
  getActiveGoalsByUserId,
  getActivePlansByUserId,
  getActiveQuitPrediction,
  getBodyMeasurementsByUserId,
  getCheckInEligibleUsers,
  getCheckInsSince,
  getKitchenAnalysesBetween,
  getMealsBetween,
  getNutritionTarget,
  getProgressEntriesByUserId,
  getUserMemory,
  getWaterMlBetween,
  getWorkoutsBetween,
} from "@/lib/db/queries";
import type { CheckIn, QuitPrediction, User } from "@/lib/db/schema";
import { isInDangerWindow } from "@/lib/quit/lifecycle";
import { sendEmail } from "@/lib/email/client";
import { checkInEmailTemplate } from "@/lib/email/templates";
import { getAppUrl } from "@/lib/stripe";
import { hasActiveAccess } from "@/lib/subscription";

export type { CheckInSlot } from "@/lib/checkins/schedule";

const DAY_MS = 24 * 60 * 60 * 1000;

// How many calendar days of logs the decision pass sees (today inclusive).
// A week is enough to spot "gone quiet" patterns without bloating the prompt.
const CONTEXT_DAYS = 7;

// Rolling-7-day send caps per frequency choice: a backstop behind the real
// limiter, the member's chosen checkInDays (FEAT-15). "daily" is uncapped
// weekly (the per-slot dedup already bounds it to at most 2/day: brief +
// callout); the others allow up to brief + callout on each chosen day.
const WEEKLY_CAPS: Record<User["checkInFrequency"], number> = {
  daily: Number.POSITIVE_INFINITY,
  three_per_week: 6,
  weekly: 2,
};

// Chat Chad's personality, geared to the email channel (rewritten s143 with
// owner-approved wording): same shame-works persona and profanity contract as
// the chat prompt, orders only when the data earns one, and grounded in ALL of
// what he's given (logs, stats, the client's own written notes, his file).
const CHECK_IN_VOICE = `You are Chad, a no-bullshit AI fitness coach, emailing one of your clients between sessions. You reach out first: you've just gone through their data, and this email is you checking in on them. You're direct, ruthless, hard, and focused on results. You have zero tolerance for nonsense or excuses or lies. You demand results. If something in their data is wrong, you tell them straight up and explain why.

PERSONALITY:
- You specialize in shaming clients and forcing them to take action. You do this because it gets results. Shame works.
- When a client messes up, you shame. But when they put in the work and do the right thing, you praise them. Praise from you means something because it has to be earned.
- Your harshness, profanity, and shaming are RESPONSES to weakness, excuses, laziness, or lies showing in their data. They are not how you open on a client whose data shows they did the work.
- You sometimes use profanity to get your point across, especially in response to a client's pathetic behaviors and excuses. 'Fuck,' 'fucking,' and 'shit' are your go-to profanity words.
- You specialize in detecting the slightest sign of weakness, self-deception, or excuse-making in the client. You ruthlessly call it out and shame them for it.
- You issue orders. When their data shows something that needs doing, tell them exactly what to do and tell them to report back in the app. If nothing genuinely needs an order, don't manufacture one; a command tacked onto every email becomes noise the client tunes out.

WHAT YOU KNOW:
- Everything you know about this client is given to you below: their logged data, their confirmed stats, their own written notes and comments, their goals and plans, and your coach's file on them. Read all of it and use it, especially anything they wrote in their own words.
- You only ever reference what's actually there. Never invent workouts, weights, meals, or numbers that are not in the data.
- You also get the full text of every email you sent this client in the past week. You REMEMBER sending them. You are a coach mid-conversation, not a bot starting fresh: read what you already said against what the data shows they did about it, and let that decide your register. An order they followed gets acknowledged. An order they ignored means you go harder than last time, and you SAY that you already told them.

FORMATTING (these render in the email exactly like they do in the app):
- Emphasis is one of your weapons: USE it. Make key words **bold** liberally so your hard truths and orders land, and drop into **ALL-CAPS BOLD** when you're driving a point home or barking an order. Reserve red for your rare, crucial, non-negotiable moments: wrap those key words in double brackets [[like this]] (red renders bold automatically). Use red sparingly; if everything is red, nothing is. For your single most important point you can stack ALL-CAPS + red together, but only when it's truly warranted.
- Plain paragraphs separated by blank lines. No emojis, no markdown headers, no links.`;

const SLOT_INSTRUCTIONS: Record<CheckInSlot, string> = {
  morning: `This is the MORNING BRIEF. Set today's marching orders:
- If their saved plan or weekly schedule implies a session today, name it and tell them to report back after.
- Reference something concrete from their recent data (yesterday's workout, the weight trend, protein intake) so it's obviously about THEM.
- If weigh-ins or meal logging have gone quiet for several days, demand they log today.
Send it unless there is truly nothing useful to say (e.g. a brand-new account with no data at all — then don't).`,
  evening: `This is the EVENING CALLOUT. It's the end of the client's day:
- If today's data shows NOTHING logged (no workout, no meals) and their plan/schedule says they should have trained, call it out and tell them to fix it or own it.
- If they've gone multiple days without weigh-ins or meal logs, call that out.
- If they DID show up today (workout logged, meals logged), only send if there's something genuinely worth saying (a PR, a big miss on protein); otherwise DO NOT send — silence beats noise.
Default to NOT sending when today looks handled.`,
};

const checkInDraftSchema = z.object({
  shouldSend: z
    .boolean()
    .describe(
      "true only if there is something genuinely worth emailing this client right now"
    ),
  reason: z
    .string()
    .describe("one short sentence on why you are or aren't sending"),
  subject: z
    .string()
    .describe(
      "email subject in Chad's voice — short, concrete, references their actual situation; no ALL-CAPS spam, no emojis, no **bold**/[[red]] markers (subjects don't render them)"
    ),
  body: z
    .string()
    .describe(
      "the email body: paragraphs separated by blank lines, as long or as brief as the client's data warrants, references their real numbers, signed '— Chad' on its own last line. Emphasis renders: **bold**, **ALL-CAPS BOLD**, and [[red]] for rare non-negotiables. No emojis, no headers, no links."
    ),
});

export type CheckInResult = {
  userId: string;
  email: string;
  action:
    | "sent"
    | "dry_run"
    | "skipped_no_access"
    | "skipped_outside_window"
    | "skipped_cap"
    | "skipped_dedup"
    | "skipped_nothing_to_say"
    | "skipped_email_unconfigured"
    | "error";
  slot?: CheckInSlot;
  subject?: string;
  body?: string;
  detail?: string;
};

// How much of each past email body rides in the compose context. Enough to
// remember what was actually said (the orders, the tone), bounded so a week
// of long emails can't crowd out the client's data.
const RECENT_BODY_CHARS = 700;

/**
 * The full "what you already emailed them" record (s157, owner order): the
 * BODIES ride along, not just subjects, so Chad remembers what he actually
 * said and escalates on ignored orders instead of politely re-asking every
 * day like a bot with amnesia.
 */
function formatRecentCheckIns(recent: CheckIn[]): string {
  if (recent.length === 0) {
    return "";
  }
  const entries = recent.map((c) => {
    const body =
      c.body.length > RECENT_BODY_CHARS
        ? `${c.body.slice(0, RECENT_BODY_CHARS)}…`
        : c.body;
    return `--- ${formatCalendarDay(c.sentAt)} (${c.slot} email), subject "${c.subject}":\n${body}`;
  });
  return `EMAILS YOU ALREADY SENT THIS CLIENT IN THE PAST 7 DAYS (newest first; you remember every one of these):
${entries.join("\n\n")}

Read these against today's data before you write. If you gave an order and the data shows they did it, acknowledge it. If you gave an order and the data shows nothing happened, they ignored their coach: do NOT re-send the same ask in the same register. Say you already told them, name how many days of silence it has been, and escalate. Never repeat yesterday's points word for word and never write like this is your first contact.`;
}

/**
 * Compose (and, unless dryRun, deliver + record) one proactive check-in for one
 * user. All the anti-spam guards live here: live-access check, per-slot daily
 * dedup, and the user's chosen weekly frequency cap — all checked BEFORE the
 * model call so a capped user costs nothing.
 */
export async function runUserCheckIn(
  user: User,
  slot: CheckInSlot,
  opts: {
    dryRun?: boolean;
    // The member's active quit prediction (FEAT-22). undefined = look it up
    // here; null = the caller already knows there isn't one.
    prediction?: QuitPrediction | null;
  } = {}
): Promise<CheckInResult> {
  const base: Pick<CheckInResult, "userId" | "email" | "slot"> = {
    userId: user.id,
    email: user.email,
    slot,
  };

  // Defense in depth: the eligibility query filters status, this also honors
  // the period-end/dunning grace windows.
  if (!hasActiveAccess(user)) {
    return { ...base, action: "skipped_no_access" };
  }

  // The member's own local day (FEAT-8) — so "today" and the per-slot dedup
  // track their wall clock, not the UTC date.
  const startOfToday = todayStartInTz(user.timezone);
  const weekAgo = new Date(startOfToday.getTime() - 7 * DAY_MS);
  const recent = await getCheckInsSince(user.id, weekAgo);

  // Never send the same slot twice in one of the member's local days — the
  // hourly cron re-enters the slot window several times and stays safe.
  if (
    recent.some(
      (c) => c.slot === slot && c.sentAt.getTime() >= startOfToday.getTime()
    )
  ) {
    return { ...base, action: "skipped_dedup" };
  }

  // The quit-date danger window (FEAT-22, capped by FEAT-25): the prediction
  // says this is exactly when the member folds, so Chad's MORNING BRIEF shows
  // up every one of these days — the weekly frequency cap stands down for it
  // (the per-slot daily dedup above still bounds it to one a day). The evening
  // callout never escalates: it keeps the member's normal schedule and caps,
  // so the window adds at most one email a day. Respects the member's Quit
  // Date switch (quitDateEnabled, FEAT-25): off = no prediction, no window.
  const prediction =
    opts.prediction === undefined
      ? user.quitDateEnabled
        ? ((await getActiveQuitPrediction(user.id)) ?? null)
        : null
      : opts.prediction;
  const dangerWindow =
    prediction?.status === "active" &&
    isInDangerWindow(todayAnchorInTz(user.timezone), prediction.quitDate);

  // The user's own "how often" dial.
  if (
    !(dangerWindow && slot === "morning") &&
    recent.length >= WEEKLY_CAPS[user.checkInFrequency]
  ) {
    return { ...base, action: "skipped_cap" };
  }

  // --- Assemble everything Chad knows, from the same sources chat uses. ---
  const end = new Date(startOfToday.getTime() + DAY_MS);
  const start = new Date(end.getTime() - CONTEXT_DAYS * DAY_MS);

  const [
    meals,
    workouts,
    waterMl,
    allWeighIns,
    allMeasurements,
    kitchen,
    target,
    goals,
    plans,
    memory,
  ] = await Promise.all([
    getMealsBetween(user.id, start, end),
    getWorkoutsBetween(user.id, start, end),
    getWaterMlBetween(user.id, start, end),
    getProgressEntriesByUserId(user.id),
    getBodyMeasurementsByUserId(user.id),
    getKitchenAnalysesBetween(user.id, start, end),
    getNutritionTarget(user.id),
    getActiveGoalsByUserId(user.id),
    getActivePlansByUserId(user.id),
    user.memoryEnabled ? getUserMemory(user.id) : Promise.resolve(undefined),
  ]);

  const inWindow = (d: Date) =>
    d.getTime() >= start.getTime() && d.getTime() < end.getTime();
  const weekLog = buildDayLog({
    start,
    end,
    meals,
    workouts,
    weighIns: allWeighIns.filter((e) => inWindow(e.recordedAt)),
    waterMl,
    measurements: allMeasurements.filter((b) => inWindow(b.recordedAt)),
    kitchen,
    target,
    timezone: user.timezone,
  });

  const context = [
    formatProfileForPrompt(user),
    formatMemoryForPrompt(memory?.profile),
    formatGoalsForPrompt(goals, plans),
    // The quit-date prediction (FEAT-22): Chad references it unprompted, and
    // inside the danger window the block tells him this is the fold window.
    formatQuitPredictionForPrompt(prediction ?? undefined, user.timezone),
    `THIS CLIENT'S LOGGED DATA FOR THE LAST ${CONTEXT_DAYS} DAYS (today inclusive — this is everything; if it's not here, it wasn't logged):\n\n${weekLog.summary}`,
    formatRecentCheckIns(recent),
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const firstName = user.name?.trim().split(/\s+/)[0];

  const { object: draft } = await generateObject({
    // Chad's real brain (same model as chat and the weekly report), not the
    // background memory model: Flash wrote in a tamer voice and spelled numbers
    // out as words ("three hundred fifteen").
    model: getLanguageModel(DEFAULT_CHAT_MODEL),
    schema: checkInDraftSchema,
    system: CHECK_IN_VOICE,
    prompt: `Today is ${formatDayInTz(new Date(), user.timezone, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })}.${firstName ? ` The client's name is ${firstName}.` : ""}

${SLOT_INSTRUCTIONS[slot]}

Here is everything you know about this client:

${context}`,
  });

  if (!draft.shouldSend) {
    return {
      ...base,
      action: "skipped_nothing_to_say",
      detail: draft.reason,
    };
  }

  if (opts.dryRun) {
    return {
      ...base,
      action: "dry_run",
      subject: draft.subject,
      body: draft.body,
    };
  }

  const appUrl = getAppUrl();
  const chatUrl = `${appUrl}/?prompt=${encodeURIComponent(
    `You emailed me — "${draft.subject}". Here's my report: `
  )}`;

  const { skipped } = await sendEmail({
    to: user.email,
    subject: draft.subject,
    html: checkInEmailTemplate({
      body: draft.body,
      chatUrl,
      settingsUrl: `${appUrl}/account`,
      // Roast Share (FEAT-24): the composer pre-fills with the member's
      // latest check-in, which by the time they read the email is this one.
      roastUrl: `${appUrl}/roast?src=checkin`,
    }),
  });

  if (skipped) {
    // RESEND_API_KEY isn't configured: don't record it, so nothing is "spent"
    // from the user's frequency budget on an email that never went out.
    return { ...base, action: "skipped_email_unconfigured" };
  }

  await createCheckIn({
    userId: user.id,
    slot,
    subject: draft.subject,
    body: draft.body,
  });

  return { ...base, action: "sent", subject: draft.subject, body: draft.body };
}

/**
 * One scheduled pass over every check-in-eligible member (Elite, toggled on,
 * live access). Runs HOURLY (FEAT-8): each member's slot is derived from their
 * own local hour — morning brief in their ~7-10am window, evening callout in
 * their ~8-11pm window, nothing in between — so `slot` is only ever passed as
 * a manual override for testing. Users are processed sequentially — Elite
 * volume is small and this keeps the model/email pressure flat — and one
 * user's failure never blocks the rest.
 */
export async function runCheckInPass(
  opts: { slot?: CheckInSlot; dryRun?: boolean; onlyEmail?: string } = {}
): Promise<CheckInResult[]> {
  let users = await getCheckInEligibleUsers();
  if (opts.onlyEmail) {
    const only = opts.onlyEmail.trim().toLowerCase();
    users = users.filter((u) => u.email.toLowerCase() === only);
  }

  const now = new Date();
  const results: CheckInResult[] = [];
  for (const user of users) {
    try {
      // The active quit prediction feeds both the slot gate (danger-window
      // cadence escalation ignores the chosen-days filter for the morning
      // brief) and the compose context, so fetch it once per member here.
      // A member who switched the Quit Date off (FEAT-25) opted out of the
      // whole mechanic: no escalation, no prediction in the prompt.
      const prediction = user.quitDateEnabled
        ? ((await getActiveQuitPrediction(user.id)) ?? null)
        : null;
      const dangerWindow =
        prediction?.status === "active" &&
        isInDangerWindow(todayAnchorInTz(user.timezone), prediction.quitDate);
      const slot = opts.slot ?? dueCheckInSlot(now, user, { dangerWindow });
      if (!slot) {
        results.push({
          userId: user.id,
          email: user.email,
          action: "skipped_outside_window",
        });
        continue;
      }
      results.push(await runUserCheckIn(user, slot, { ...opts, prediction }));
    } catch (error) {
      results.push({
        userId: user.id,
        email: user.email,
        action: "error",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
