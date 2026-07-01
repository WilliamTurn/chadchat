import { NextResponse } from "next/server";
import {
  type CheckInSlot,
  runCheckInPass,
} from "@/lib/checkins/engine";

// One pass loops over every eligible member with a model call each — give it
// the full Fluid Compute window like the other long-running AI work.
export const maxDuration = 300;

/**
 * Proactive check-ins cron (FEAT-11). Vercel invokes this on the schedules in
 * vercel.json — a morning pass (the brief) and an evening pass (the callout).
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` on every cron
 * invocation once the env var is set; anything else is rejected, and the route
 * fails CLOSED (503) if the secret was never configured, so it can't be driven
 * anonymously.
 *
 * Query params (mainly for verification):
 * - slot=morning|evening — override the hour-derived slot.
 * - dryRun=1 — compose everything but send nothing and record nothing.
 * - email=someone@x.com — restrict the pass to one member.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const slotParam = url.searchParams.get("slot");
  // Fallback if the query param is ever stripped: the morning cron fires in
  // the UTC morning/early-afternoon, the evening one around 01:00 UTC.
  const derived: CheckInSlot =
    new Date().getUTCHours() >= 6 && new Date().getUTCHours() < 18
      ? "morning"
      : "evening";
  const slot: CheckInSlot =
    slotParam === "morning" || slotParam === "evening" ? slotParam : derived;

  const results = await runCheckInPass(slot, {
    dryRun: url.searchParams.get("dryRun") === "1",
    onlyEmail: url.searchParams.get("email") ?? undefined,
  });

  return NextResponse.json({
    slot,
    processed: results.length,
    sent: results.filter((r) => r.action === "sent").length,
    results,
  });
}
