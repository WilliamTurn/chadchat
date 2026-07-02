import "server-only";

import { generateObject } from "ai";
import { z } from "zod";
import { buildDayLog } from "@/lib/ai/dashboard";
import {
  formatGoalsForPrompt,
  formatMemoryForPrompt,
  formatProfileForPrompt,
} from "@/lib/ai/memory";
import { memoryModel } from "@/lib/ai/models";
import { getLanguageModel } from "@/lib/ai/providers";
import {
  type CheckInSlot,
  dueCheckInSlot,
} from "@/lib/checkins/schedule";
import { formatCalendarDay, formatDayInTz, todayStartInTz } from "@/lib/date";
import {
  createCheckIn,
  getActiveGoalsByUserId,
  getActivePlansByUserId,
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
import type { CheckIn, User } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/client";
import { checkInEmailTemplate } from "@/lib/email/templates";
import { getAppUrl } from "@/lib/stripe";
import { hasActiveAccess } from "@/lib/subscription";

export type { CheckInSlot } from "@/lib/checkins/schedule";

const DAY_MS = 24 * 60 * 60 * 1000;

// How many calendar days of logs the decision pass sees (today inclusive).
// A week is enough to spot "gone quiet" patterns without bloating the prompt.
const CONTEXT_DAYS = 7;

// Rolling-7-day send caps per frequency choice. "daily" is uncapped weekly
// (the per-slot dedup already bounds it to at most 2/day: brief + callout).
const WEEKLY_CAPS: Record<User["checkInFrequency"], number> = {
  daily: Number.POSITIVE_INFINITY,
  three_per_week: 3,
  weekly: 1,
};

// The same persona contract as the photo-analysis CHAD_VOICE: full edge, no
// softening — but accurate, concrete, and inbox-safe. This is a NEW prompt for
// the email channel; Chad's chat system prompt is untouched.
const CHECK_IN_VOICE = `You are Chad, a no-bullshit AI fitness coach, writing a SHORT email to one of your clients. You are direct, ruthless, and results-obsessed, with zero tolerance for excuses — you call out slacking by name and you hold people to what they said they'd do. No profanity is required; brutal honesty is. You only ever reference the client's REAL logged data given to you below — never invent workouts, weights, meals, or numbers that are not in the data.`;

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
      "email subject in Chad's voice — short, concrete, references their actual situation; no ALL-CAPS spam, no emojis"
    ),
  body: z
    .string()
    .describe(
      "the email body: plain text, 60-140 words, 2-4 short paragraphs separated by blank lines, no markdown, no emojis, references their real numbers, ends with a clear order for what to do next, signed '— Chad' on its own last line"
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

/** Compact "what you already emailed them" block so Chad never repeats himself. */
function formatRecentCheckIns(recent: CheckIn[]): string {
  if (recent.length === 0) {
    return "";
  }
  const lines = recent.map(
    (c) =>
      `- ${formatCalendarDay(c.sentAt)} (${c.slot}): "${c.subject}"`
  );
  return `EMAILS YOU ALREADY SENT THIS CLIENT IN THE PAST 7 DAYS (do not repeat these points — say something new or don't send):\n${lines.join("\n")}`;
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
  opts: { dryRun?: boolean } = {}
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

  // The user's own "how often" dial.
  if (recent.length >= WEEKLY_CAPS[user.checkInFrequency]) {
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
    `THIS CLIENT'S LOGGED DATA FOR THE LAST ${CONTEXT_DAYS} DAYS (today inclusive — this is everything; if it's not here, it wasn't logged):\n\n${weekLog.summary}`,
    formatRecentCheckIns(recent),
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const firstName = user.name?.trim().split(/\s+/)[0];

  const { object: draft } = await generateObject({
    model: getLanguageModel(memoryModel.id),
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
      const slot = opts.slot ?? dueCheckInSlot(now, user.timezone);
      if (!slot) {
        results.push({
          userId: user.id,
          email: user.email,
          action: "skipped_outside_window",
        });
        continue;
      }
      results.push(await runUserCheckIn(user, slot, opts));
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
