"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import { canAccessChad } from "@/lib/admin";
import { buildQuitVerdict } from "@/lib/ai/quit";
import {
  formatCalendarDay,
  toCalendarDayISO,
  todayAnchorInTz,
} from "@/lib/date";
import {
  createQuitPrediction,
  getActiveQuitPrediction,
  getUserById,
} from "@/lib/db/queries";
import {
  type AutopsyAnswersInput,
  autopsyAnswersSchema,
  type QuitPredictionContent,
} from "@/lib/quit/content";
import { failureModeFor, predictQuitDay } from "@/lib/quit/heuristics";

const DAY_MS = 86_400_000;

/** Any member who can use Chad can take the autopsy (not tier-gated: the
 * prediction is the retention hook, so it fires at the start of the trial). */
async function requireChad() {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  const user = await getUserById(session.user.id);
  if (!(user && canAccessChad(user))) {
    return null;
  }
  return user;
}

export type AutopsyActionResult =
  // id feeds the public share link (FEAT-23 pro share flow: /q/[id]).
  | { ok: true; content: QuitPredictionContent; id: string | null }
  | { ok: false; error: string };

/**
 * The Autopsy (FEAT-21): validate the member's failure-history intake, compute
 * the quit date deterministically (lib/quit/heuristics.ts, on their own wall
 * clock), have the model write the verdict narrative, and put the prediction
 * on the record. One standing prediction at a time: the verdict is a
 * diagnosis, not a slot machine, so there is no re-roll while one is active.
 */
export async function runAutopsy(
  input: AutopsyAnswersInput
): Promise<AutopsyActionResult> {
  const user = await requireChad();
  if (!user) {
    return { ok: false, error: "Sign in to take the test." };
  }

  // The member switched the whole mechanic off on /account (FEAT-25).
  if (!user.quitDateEnabled) {
    return {
      ok: false,
      error:
        "The Quit Date is switched off on your account page. Turn it on first.",
    };
  }

  const parsed = autopsyAnswersSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.errors[0]?.message ?? "Answer every question first.",
    };
  }

  const existing = await getActiveQuitPrediction(user.id);
  if (existing) {
    return {
      ok: false,
      error:
        "Your date is already on the record. There is no re-roll: beat it.",
    };
  }

  // Buttons are optional since s157 (no fixed answer may apply); the
  // heuristics stay deterministic by treating a skipped question as the
  // neutral middle of its scale. The failure mode comes from their FIRST
  // picked reason (they're listed in the order clicked), falling back to the
  // legacy single pick, then to the quiet-fade mode.
  const answers = parsed.data;
  const dayCount = predictQuitDay(
    {
      appsTried: answers.appsTried ?? "1-2",
      restarts: answers.restarts ?? "2-3",
      longestStreak: answers.longestStreak ?? "3-4w",
      lifeLoad: answers.lifeLoad ?? "normal",
    },
    user.trainingDaysPerWeek
  );
  // Day 1 = today on the member's own wall clock, so "Day 23" lands on the
  // noon-UTC anchor of their local calendar day 22 days out (FEAT-8 helpers).
  const quitDate = new Date(
    todayAnchorInTz(user.timezone).getTime() + (dayCount - 1) * DAY_MS
  );
  const failureMode = failureModeFor(
    answers.killers?.[0] ?? answers.lastKiller ?? "no-reason"
  );
  const dateLabel = formatCalendarDay(quitDate);

  try {
    const narrative = await buildQuitVerdict(user, parsed.data, {
      dayCount,
      dateLabel,
      failureMode,
    });

    const content: QuitPredictionContent = {
      answers: parsed.data,
      dayCount,
      quitDateISO: toCalendarDayISO(quitDate),
      dateLabel,
      failureMode,
      narrative,
    };

    const created = await createQuitPrediction({
      userId: user.id,
      quitDate,
      failureMode,
      content,
    });

    revalidatePath("/quit-date");
    revalidatePath("/home");
    return { ok: true, content, id: created?.id ?? null };
  } catch (_error) {
    return {
      ok: false,
      error: "Chad couldn't score the test just now. Try again in a minute.",
    };
  }
}
