import "server-only";

import { todayAnchorInTz } from "@/lib/date";
import {
  getQuitPredictionsByUserId,
  getQuitPredictionWithOwner,
} from "@/lib/db/queries";
import { parseQuitPredictionContent } from "@/lib/quit/content";
import { dayNumberOn, dayOneAnchor } from "@/lib/quit/lifecycle";

/*
 * The public share view of a quit prediction (FEAT-23 pro-app share flow):
 * what the /q/[id] page and its OG card image render. Public by unguessable
 * uuid — the member creates the link only by sharing, same trust model as
 * public chat links. Deliberately exposes ONLY the prediction facts (date,
 * day counts, failure mode) — never the owner's name, email, or confession.
 */

export type QuitShareView = {
  variant: "verdict" | "receipt";
  round: number;
  dateLabel: string;
  dayCount: number;
  failureMode: string;
  // Receipt only: the chain's original call vs where they are now.
  givenDays: number;
  currentDay: number;
};

export async function getQuitShareView(
  id: string,
  variantParam: string | undefined
): Promise<QuitShareView | null> {
  // Route params come from the URL; a malformed uuid must 404, not 500.
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return null;
  }
  const row = await getQuitPredictionWithOwner(id);
  if (!row) {
    return null;
  }
  const { prediction, owner } = row;
  const content = parseQuitPredictionContent(prediction.content);
  if (!content) {
    return null;
  }

  // Chain-original day count (reissued rounds share their day-one anchor).
  const dayOne = dayOneAnchor(prediction.quitDate, content.dayCount);
  let givenDays = content.dayCount;
  for (const r of await getQuitPredictionsByUserId(prediction.userId)) {
    const c = parseQuitPredictionContent(r.content);
    if (
      c &&
      dayOneAnchor(r.quitDate, c.dayCount).getTime() === dayOne.getTime()
    ) {
      givenDays = c.dayCount;
      break;
    }
  }
  const currentDay = dayNumberOn(
    todayAnchorInTz(owner.timezone),
    prediction.quitDate,
    content.dayCount
  );

  // The receipt is only real once they're past the original call and not
  // resolved as a hit; otherwise fall back to the verdict view.
  const receiptValid = prediction.status !== "hit" && currentDay > givenDays;
  const variant =
    variantParam === "receipt" && receiptValid ? "receipt" : "verdict";

  return {
    variant,
    round: content.round ?? 1,
    dateLabel: content.dateLabel,
    dayCount: content.dayCount,
    failureMode: content.failureMode,
    givenDays,
    currentDay,
  };
}
