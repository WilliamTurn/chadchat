import "server-only";

import { toCalendarDayISO, todayAnchorInTz } from "@/lib/date";
import {
  createProgressEntry,
  getProgressEntriesByUserId,
} from "@/lib/db/queries";
import { hasWeighIn } from "@/lib/progress/weight";
import { applyMutationReceipt } from "@/lib/refresh/coordinator";
import { loggingReceipt } from "@/lib/refresh/receipt";

/**
 * Create the member's FIRST weigh-in (ProgressEntry) — the one code path
 * shared by the target editor's missing-data ask and the onboarding wizard,
 * so a collected weight has exactly one storage place. No-ops when the
 * member already has a weigh-in: "first" is literal, never a duplicate.
 */
export async function createFirstWeighIn({
  userId,
  weight,
  unit,
  timezone,
}: {
  userId: string;
  weight: number;
  unit: "lb" | "kg";
  timezone: string | null | undefined;
}): Promise<void> {
  const entries = await getProgressEntriesByUserId(userId);
  if (hasWeighIn(entries)) {
    return;
  }
  await createProgressEntry({
    userId,
    recordedAt: new Date(),
    weight,
    unit,
    photoUrl: null,
    note: null,
  });
  applyMutationReceipt(
    loggingReceipt({
      domain: "body",
      entity: "progressEntry",
      op: "create",
      days: { startISO: toCalendarDayISO(todayAnchorInTz(timezone)) },
    })
  );
}
