import { NextResponse } from "next/server";
import { runCheckInPass } from "@/lib/checkins/engine";

// One pass loops over every eligible member with a model call each — give it
// the full Fluid Compute window like the other long-running AI work.
export const maxDuration = 300;

/**
 * Proactive check-ins cron (FEAT-11). Vercel invokes this HOURLY (vercel.json);
 * each pass derives every member's slot from their own local hour (FEAT-8) —
 * the morning brief in their ~7-10am window, the evening callout in their
 * ~8-11pm window — and the per-slot ledger dedup makes the repeated hourly
 * visits safe. Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` on
 * every cron invocation once the env var is set; anything else is rejected,
 * and the route fails CLOSED (503) if the secret was never configured, so it
 * can't be driven anonymously.
 *
 * Query params (mainly for verification):
 * - slot=morning|evening — force the slot instead of deriving per member.
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

  const results = await runCheckInPass({
    slot:
      slotParam === "morning" || slotParam === "evening"
        ? slotParam
        : undefined,
    dryRun: url.searchParams.get("dryRun") === "1",
    onlyEmail: url.searchParams.get("email") ?? undefined,
  });

  return NextResponse.json({
    processed: results.length,
    sent: results.filter((r) => r.action === "sent").length,
    results,
  });
}
