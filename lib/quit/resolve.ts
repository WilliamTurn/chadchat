import "server-only";

import { buildQuitReissueVerdict } from "@/lib/ai/quit";
import {
  calendarDayAnchorInTz,
  formatCalendarDay,
  toCalendarDayISO,
  todayAnchorInTz,
} from "@/lib/date";
import {
  createQuitPrediction,
  getActivityDaysSince,
  getCheckInsSince,
  getDueQuitPredictionsWithUsers,
  resolveQuitPredictionRow,
} from "@/lib/db/queries";
import type { QuitPrediction, User } from "@/lib/db/schema";
import {
  parseQuitPredictionContent,
  type QuitOutcomeRecord,
  type QuitPredictionContent,
} from "@/lib/quit/content";
import { reissueQuitDay } from "@/lib/quit/heuristics";
import {
  DANGER_WINDOW_BEFORE_DAYS,
  DAY_MS,
  dayNumberOn,
  dayOneAnchor,
  quitOutcome,
} from "@/lib/quit/lifecycle";

export type QuitResolution = {
  userId: string;
  predictionId: string;
  action: "beaten" | "hit" | "pending" | "skipped_malformed" | "error";
  detail?: string;
};

/**
 * Resolve one due prediction on its owner's wall clock (FEAT-22 outcomes):
 * - Logged activity on a day past the date → BEATEN: Chad concedes on the
 *   record and immediately issues a new, harder prediction (the retention
 *   loop). The concession narrative is generated FIRST, so a model failure
 *   leaves the row active and the next hourly pass simply retries.
 * - Silent for HIT_SILENCE_DAYS past the date → HIT: the row resolves and the
 *   /today card + Chad's context flip to the "I called it" callback.
 * Either way the resolved row's content gains the outcome ledger record:
 * days lasted + every check-in sent in the danger window, so announced
 * predictions accumulate intervention-vs-outcome ground truth.
 */
async function resolveOne(
  owner: User,
  prediction: QuitPrediction
): Promise<QuitResolution> {
  const base = { userId: owner.id, predictionId: prediction.id };

  const content = parseQuitPredictionContent(prediction.content);
  if (!content) {
    return { ...base, action: "skipped_malformed" };
  }

  const quitAnchor = prediction.quitDate;
  const todayAnchor = todayAnchorInTz(owner.timezone);
  const dayOne = dayOneAnchor(quitAnchor, content.dayCount);

  // Their whole activity history for this prediction, bucketed onto their own
  // calendar days; the newest day decides beaten-vs-silent.
  const activity = await getActivityDaysSince(
    owner.id,
    new Date(dayOne.getTime() - DAY_MS)
  );
  let lastActivityAnchor: Date | null = null;
  for (const t of activity) {
    const anchor = calendarDayAnchorInTz(t, owner.timezone);
    if (!lastActivityAnchor || anchor.getTime() > lastActivityAnchor.getTime()) {
      lastActivityAnchor = anchor;
    }
  }

  const outcome = quitOutcome({
    todayAnchor,
    quitDateAnchor: quitAnchor,
    lastActivityAnchor,
  });
  if (outcome === "pending") {
    return { ...base, action: "pending" };
  }

  // The intervention ledger: every check-in Chad sent from the start of the
  // danger window until now rides on the resolved row.
  const windowStart = new Date(
    quitAnchor.getTime() - (DANGER_WINDOW_BEFORE_DAYS + 1) * DAY_MS
  );
  const checkIns = await getCheckInsSince(owner.id, windowStart);
  const daysLasted = lastActivityAnchor
    ? Math.max(0, dayNumberOn(lastActivityAnchor, quitAnchor, content.dayCount))
    : 0;
  const record: QuitOutcomeRecord = {
    status: outcome,
    resolvedAtISO: new Date().toISOString(),
    daysLasted,
    dangerWindowCheckIns: checkIns.map((c) => ({
      sentAtISO: c.sentAt.toISOString(),
      slot: c.slot,
      subject: c.subject,
    })),
  };

  if (outcome === "hit") {
    await resolveQuitPredictionRow(prediction.id, {
      status: "hit",
      content: { ...content, outcome: record },
    });
    return { ...base, action: "hit" };
  }

  // BEATEN. Compute the harder date deterministically, have Chad concede and
  // narrate it, then flip the old row and put the new one on the record (in
  // that order: if the insert fails, the beaten row's "run it back" path on
  // /quit-date still lets the member get a fresh date).
  const currentDay = dayNumberOn(todayAnchor, quitAnchor, content.dayCount);
  const newDayCount = reissueQuitDay(content.dayCount, currentDay);
  const newQuitDate = new Date(dayOne.getTime() + (newDayCount - 1) * DAY_MS);
  const newDateLabel = formatCalendarDay(newQuitDate);

  const narrative = await buildQuitReissueVerdict(owner, content.answers, {
    previousDayCount: content.dayCount,
    previousDateLabel: content.dateLabel,
    daysLasted,
    dayCount: newDayCount,
    dateLabel: newDateLabel,
    failureMode: content.failureMode,
  });

  await resolveQuitPredictionRow(prediction.id, {
    status: "beaten",
    content: { ...content, outcome: record },
  });

  const newContent: QuitPredictionContent = {
    answers: content.answers,
    dayCount: newDayCount,
    quitDateISO: toCalendarDayISO(newQuitDate),
    dateLabel: newDateLabel,
    failureMode: content.failureMode,
    narrative,
    round: (content.round ?? 1) + 1,
  };
  await createQuitPrediction({
    userId: owner.id,
    quitDate: newQuitDate,
    failureMode: content.failureMode,
    content: newContent,
  });

  return { ...base, action: "beaten" };
}

/**
 * One sweep over every active prediction whose date has arrived (runs from
 * the hourly check-ins cron, before the check-in pass, so escalation and
 * composition always see fresh prediction state). One member's failure never
 * blocks the rest.
 */
export async function resolveDueQuitPredictions(): Promise<QuitResolution[]> {
  // Generous SQL pre-filter: anchors are 00:00 UTC, wall clocks sit within
  // ±14h of UTC, so "now" catches every member whose local day could have
  // passed the date; resolveOne re-checks exactly.
  const due = await getDueQuitPredictionsWithUsers(new Date());
  const results: QuitResolution[] = [];
  for (const { prediction, owner } of due) {
    // Opted out on /account (FEAT-25): leave the row untouched. If they flip
    // the switch back on, the next sweep resolves it normally.
    if (!owner.quitDateEnabled) {
      continue;
    }
    try {
      results.push(await resolveOne(owner, prediction));
    } catch (error) {
      results.push({
        userId: owner.id,
        predictionId: prediction.id,
        action: "error",
        detail: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}
