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
import { ema, ratePerWeek, round1, withinDays } from "@/lib/chart/trend";
import { formatCalendarDay, todayStartInTz } from "@/lib/date";
import {
  createWeeklyReport,
  getActiveGoalsByUserId,
  getActivePlansByUserId,
  getBodyMeasurementsByUserId,
  getKitchenAnalysesBetween,
  getLatestWeeklyReport,
  getMealsBetween,
  getNutritionTarget,
  getProgressEntriesByUserId,
  getSleepDailyTotals,
  getUserMemory,
  getWaterMlBetween,
  getWeeklyReportEligibleUsers,
  getWorkoutsBetween,
} from "@/lib/db/queries";
import type { ProgressEntry, User } from "@/lib/db/schema";
import { sendEmail } from "@/lib/email/client";
import { weeklyReportEmailTemplate } from "@/lib/email/templates";
import {
  type WeeklyReportContent,
  weeklyReportContentSchema,
} from "@/lib/reports/content";
import { isReportDue } from "@/lib/reports/schedule";
import { getAppUrl } from "@/lib/stripe";
import { hasActiveAccess } from "@/lib/subscription";

const DAY_MS = 24 * 60 * 60 * 1000;

// The report reviews the last 7 calendar days (today inclusive) — "your week".
const REPORT_DAYS = 7;

// Never send two reports inside one week. 6 days (not 7) so a report can still
// go out at the user's chosen hour even if last week's was delivered a little
// late, and so hour-drift across DST changes can't skip a whole week.
const DEDUP_DAYS = 6;

// Same persona contract as CHECK_IN_VOICE (FEAT-11): full edge, no softening —
// but strictly grounded in the data. This is a NEW prompt for the weekly-report
// channel; Chad's chat system prompt is untouched. Rewritten s130 (LC-6): the
// report is the flagship Elite artifact, so it must be COMPREHENSIVE (full
// written paragraphs, never fragments), earn both its praise and its criticism
// from the numbers, and stay 100% factual.
const WEEKLY_REPORT_VOICE = `You are Chad, a no-bullshit AI fitness coach, writing your client's WEEKLY COACH'S REPORT: the same weekly review a $300/month human online coach delivers, and it has to read like it. You are direct, ruthless, and results-obsessed, with zero tolerance for excuses. You call out slacking by name and you hold people to what they said they'd do. You also give real credit when the numbers earn it: a week of hit targets or a new rep PR gets called a win in plain words, because praise from you means something precisely because it has to be earned. No profanity is required; brutal honesty is.

FACTUAL DISCIPLINE, non-negotiable: every number, exercise, meal, and date you write comes from the client's REAL logged data given to you below. Never invent, estimate, or round beyond what the data shows. Where the app has pre-computed a number for you (like the weight trend), use it exactly, do not recalculate. If an area has no data, say that bluntly instead of guessing.

WRITING DISCIPLINE: write in full, complete sentences and real paragraphs. Never bullet-fragment half-sentences, never telegraphic notes, never filler. Specific beats general every time: "you benched 225 for 5 on Tuesday, up from 215 last month" beats "bench is progressing". Never use an em dash; use a comma, colon, or period instead.`;

const REPORT_INSTRUCTIONS = `Write this week's report. This is the flagship deliverable your client pays Elite money for, so it must be COMPREHENSIVE: every area with data gets a real, fully-written section, not a summary line. A thin report is a useless report.

- TRAINING: go through what was actually logged, session by session where it matters. Name the exercises, the top sets, the weights and reps, the total volume. Compare against what their plan and goals say should have been trained and name the gap if there is one. If a lift moved up, say by how much and give credit. If they skipped sessions, count them and say it straight.
- NUTRITION: real averages against their real targets, day-level misses named (which days, which macro, by how much). If protein was short three days, name the three days. If they hit their targets, say so and tell them it showed.
- BODYWEIGHT: use the pre-computed trend numbers exactly when present. Tie the trend to their goal pace: ahead, on pace, or behind, and by how much.
- PHOTOS: if progress photos are attached, add a Photos section comparing them honestly (what visibly changed, what didn't). If only one photo is attached, comment on it and tell them a comparison starts next week.
- SLEEP / WATER / MEASUREMENTS: include each as its own section when the week's data says something worth saying (a pattern, a slide, a win). Skip an area only when there is genuinely nothing there.
- GOAL CHECK: if they have active goals, connect this week's numbers to them. Is this week moving them toward the goal or not, and at this pace when do they arrive.
- ADJUSTMENTS: end with next week's specific changes, each one earned by this week's data, each written as a complete instruction with a complete reason. If the data is thin, the adjustment is about logging itself: a report needs raw material.
- VERDICT: praise where the data earns praise, harsh criticism where the data earns criticism. Both must point at specific numbers. Never soften a miss and never withhold credit for a genuine win.

The report should read like it was worth paying for: concrete, personal, complete sentences, zero filler, and long enough to actually cover the week. When in doubt, more specifics, not more adjectives.`;

const weeklyReportDraftSchema = weeklyReportContentSchema.extend({
  subject: z
    .string()
    .describe(
      "email subject in Chad's voice — short, concrete, references their actual week; no ALL-CAPS spam, no emojis"
    ),
});

export type WeeklyReportResult = {
  userId: string;
  email: string;
  action:
    | "sent"
    | "dry_run"
    | "skipped_no_access"
    | "skipped_not_due"
    | "skipped_dedup"
    | "skipped_no_data"
    | "saved_email_unconfigured"
    | "saved_email_failed"
    | "error";
  subject?: string;
  content?: WeeklyReportContent;
  detail?: string;
};

/** image mediaType from a Blob URL's extension (progress photos are images). */
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
 * The photo-over-photo pair: the newest progress photo taken during the report
 * week, plus the best earlier photo to compare against (the most recent one at
 * least 5 days older, falling back to the earliest ever). Either can be null.
 */
function pickPhotoPair(
  entries: ProgressEntry[],
  windowStart: Date,
  windowEnd: Date
): { current: ProgressEntry | null; baseline: ProgressEntry | null } {
  const photos = entries
    .filter((e) => e.photoUrl != null)
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const current =
    photos
      .filter(
        (p) =>
          p.recordedAt.getTime() >= windowStart.getTime() &&
          p.recordedAt.getTime() < windowEnd.getTime()
      )
      .at(-1) ?? null;
  if (!current) {
    return { current: null, baseline: null };
  }
  const earlier = photos.filter(
    (p) => p.recordedAt.getTime() < current.recordedAt.getTime()
  );
  const baseline =
    earlier.filter(
      (p) => p.recordedAt.getTime() <= current.recordedAt.getTime() - 5 * DAY_MS
    ).at(-1) ??
    earlier[0] ??
    null;
  return { current, baseline };
}

/**
 * The app-computed weight trend (same EMA math as the /progress chart), handed
 * to the model as ground truth so the report's numbers can never be made up.
 * Returns "" when there isn't enough history for a trend to mean anything.
 */
function formatWeightTrend(entries: ProgressEntry[], end: Date): string {
  const weighed = entries
    .filter((e): e is ProgressEntry & { weight: number } => e.weight != null)
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  if (weighed.length < 3) {
    return "";
  }
  const latest = weighed.at(-1) as ProgressEntry & { weight: number };
  const unit = latest.unit;
  const LB_PER_KG = 2.204_62;
  const toUnit = (w: number, from: "lb" | "kg") =>
    from === unit ? w : unit === "lb" ? w * LB_PER_KG : w / LB_PER_KG;
  const rows = ema(
    weighed.map((e) => ({
      t: e.recordedAt.getTime(),
      weight: toUnit(e.weight, e.unit),
    }))
  );
  const last = rows.at(-1);
  if (!last) {
    return "";
  }
  const weekAgoRow = [...rows]
    .reverse()
    .find((r) => r.t <= end.getTime() - REPORT_DAYS * DAY_MS);
  const lines = [
    `- Trend weight now: ${round1(last.trend)} ${unit} (latest raw weigh-in ${round1(latest.weight)} ${unit} on ${formatCalendarDay(latest.recordedAt)}).`,
  ];
  if (weekAgoRow) {
    const change = round1(last.trend - weekAgoRow.trend);
    lines.push(
      `- Trend change over the report week: ${change > 0 ? "+" : ""}${change} ${unit}.`
    );
  }
  const recent = withinDays(rows, 28);
  if (recent.length >= 3) {
    const rate = round1(ratePerWeek(recent));
    lines.push(
      `- 4-week rate: ${rate > 0 ? "+" : ""}${rate} ${unit}/week.`
    );
  }
  return `COMPUTED WEIGHT TREND (already calculated by the app with the same smoothing the client sees on their dashboard — use these numbers exactly, do not recalculate):\n${lines.join("\n")}`;
}

/**
 * Compose (and, unless dryRun, persist + deliver) one weekly report for one
 * member. Guards run BEFORE the model call so a not-due/deduped user costs
 * nothing. `force` bypasses the schedule + dedup checks (verification only).
 */
export async function runUserWeeklyReport(
  user: User,
  opts: { dryRun?: boolean; force?: boolean } = {}
): Promise<WeeklyReportResult> {
  const base: Pick<WeeklyReportResult, "userId" | "email"> = {
    userId: user.id,
    email: user.email,
  };

  // Defense in depth: the eligibility query filters status, this also honors
  // the period-end/dunning grace windows.
  if (!hasActiveAccess(user)) {
    return { ...base, action: "skipped_no_access" };
  }

  const now = new Date();
  if (!(opts.force || isReportDue(now, user))) {
    return { ...base, action: "skipped_not_due" };
  }

  // Once per week, ever — the hourly cron keeps matching ">= hour" for the
  // rest of the report day, and this is what stops repeat sends.
  if (!opts.force) {
    const latest = await getLatestWeeklyReport(user.id);
    if (
      latest &&
      latest.sentAt.getTime() > now.getTime() - DEDUP_DAYS * DAY_MS
    ) {
      return { ...base, action: "skipped_dedup" };
    }
  }

  // --- Assemble the week, from the same sources chat + check-ins use. ---
  // Bounded by the member's own local days (FEAT-8), so the "week" ends at
  // their tonight — not at a UTC midnight that may already be tomorrow.
  const end = new Date(todayStartInTz(user.timezone).getTime() + DAY_MS);
  const start = new Date(end.getTime() - REPORT_DAYS * DAY_MS);

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
    sleepTotals,
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
    getSleepDailyTotals(user.id, user.timezone, REPORT_DAYS + 1),
  ]);

  const inWindow = (d: Date) =>
    d.getTime() >= start.getTime() && d.getTime() < end.getTime();
  const weekWeighIns = allWeighIns.filter((e) => inWindow(e.recordedAt));
  const weekSleep = sleepTotals.filter((s) => s.t >= start.getTime());

  // A report needs raw material: skip only when the week is completely empty
  // AND there's no plan/goal to hold them to (a brand-new blank account).
  const hasWeekData =
    meals.length > 0 ||
    workouts.length > 0 ||
    weekWeighIns.length > 0 ||
    waterMl > 0 ||
    weekSleep.length > 0;
  if (!hasWeekData && goals.length === 0 && plans.length === 0) {
    return { ...base, action: "skipped_no_data" };
  }

  const weekLog = buildDayLog({
    start,
    end,
    meals,
    workouts,
    weighIns: weekWeighIns,
    waterMl,
    measurements: allMeasurements.filter((b) => inWindow(b.recordedAt)),
    kitchen,
    target,
    timezone: user.timezone,
  });

  const sleepBlock =
    weekSleep.length > 0
      ? `SLEEP THIS WEEK:\n${weekSleep
          .map((s) => {
            const h = Math.floor(s.minutes / 60);
            const m = s.minutes % 60;
            return `- ${formatCalendarDay(new Date(s.t))}: ${m === 0 ? `${h}h` : `${h}h ${m}m`}${s.quality == null ? "" : `, quality ${s.quality}/5`}`;
          })
          .join("\n")}`
      : "";

  const { current: currentPhoto, baseline: baselinePhoto } = pickPhotoPair(
    allWeighIns,
    start,
    end
  );
  const photoNote = currentPhoto
    ? baselinePhoto
      ? `PROGRESS PHOTOS ATTACHED: the FIRST image is the earlier baseline (taken ${formatCalendarDay(baselinePhoto.recordedAt)}), the SECOND is this week's (taken ${formatCalendarDay(currentPhoto.recordedAt)}). Compare them honestly in a Photos section.`
      : `PROGRESS PHOTO ATTACHED: taken this week (${formatCalendarDay(currentPhoto.recordedAt)}). There is no earlier photo to compare against yet — comment on it and tell them the comparison starts next week.`
    : "";

  const firstName = user.name?.trim().split(/\s+/)[0];
  const context = [
    formatProfileForPrompt(user),
    formatMemoryForPrompt(memory?.profile),
    formatGoalsForPrompt(goals, plans),
    `THIS CLIENT'S LOGGED DATA FOR THE REPORT WEEK (${formatCalendarDay(start)} – ${formatCalendarDay(new Date(end.getTime() - 1))}, today inclusive — this is everything; if it's not here, it wasn't logged):\n\n${weekLog.summary}`,
    sleepBlock,
    formatWeightTrend(allWeighIns, end),
    photoNote,
  ]
    .filter(Boolean)
    .join("\n\n---\n\n");

  const prompt = `Today is ${formatCalendarDay(now, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })}.${firstName ? ` The client's name is ${firstName}.` : ""}

${REPORT_INSTRUCTIONS}

Here is everything you know about this client:

${context}`;

  const images = [baselinePhoto, currentPhoto]
    .filter((p): p is ProgressEntry & { photoUrl: string } =>
      Boolean(p?.photoUrl)
    )
    .map((p) => ({
      type: "file" as const,
      mediaType: mediaTypeFor(p.photoUrl),
      data: new URL(p.photoUrl),
    }));

  const { object: draft } = await generateObject({
    model: getLanguageModel(DEFAULT_CHAT_MODEL),
    schema: weeklyReportDraftSchema,
    system: WEEKLY_REPORT_VOICE,
    messages: [
      {
        role: "user",
        content: [{ type: "text" as const, text: prompt }, ...images],
      },
    ],
  });

  const { subject, ...content } = draft;

  if (opts.dryRun) {
    return { ...base, action: "dry_run", subject, content };
  }

  // Persist FIRST — the report is the artifact (the /reports page renders this
  // row) and the ledger (dedup). Email is delivery on top.
  await createWeeklyReport({ userId: user.id, subject, content });

  // Delivery on top of the saved artifact: an email failure must not read as
  // a failed report (it's already on /reports), so it gets its own action.
  const appUrl = getAppUrl();
  try {
    const { skipped } = await sendEmail({
      to: user.email,
      subject,
      html: weeklyReportEmailTemplate({
        content,
        reportUrl: `${appUrl}/reports`,
        chatUrl: `${appUrl}/?prompt=${encodeURIComponent(
          `I read my weekly report — "${content.headline}". Let's talk about it: `
        )}`,
        settingsUrl: `${appUrl}/account`,
      }),
    });
    return {
      ...base,
      action: skipped ? "saved_email_unconfigured" : "sent",
      subject,
      content,
    };
  } catch (error) {
    return {
      ...base,
      action: "saved_email_failed",
      subject,
      content,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * One hourly pass over every report-eligible member (Elite, reports on, live
 * access). Each member's own local day/hour decides whether they're due right
 * now. Sequential like the check-in pass — Elite volume is small — and one
 * user's failure never blocks the rest.
 */
export async function runWeeklyReportPass(
  opts: { dryRun?: boolean; force?: boolean; onlyEmail?: string } = {}
): Promise<WeeklyReportResult[]> {
  let users = await getWeeklyReportEligibleUsers();
  if (opts.onlyEmail) {
    const only = opts.onlyEmail.trim().toLowerCase();
    users = users.filter((u) => u.email.toLowerCase() === only);
  }

  const results: WeeklyReportResult[] = [];
  for (const user of users) {
    try {
      results.push(await runUserWeeklyReport(user, opts));
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
