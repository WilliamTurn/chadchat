import { NextResponse } from "next/server";
import { runWeeklyReportPass } from "@/lib/reports/engine";

// One pass loops over every eligible member with a model call each — give it
// the full Fluid Compute window like the other long-running AI work.
export const maxDuration = 300;

/**
 * Weekly-report cron (FEAT-12). Vercel invokes this HOURLY (vercel.json); each
 * pass sends the report only to members whose own local day + hour say it's
 * time — so a member in Chicago who picked "Sunday 5pm" gets it Sunday 5pm
 * Chicago time. The once-per-week dedup lives in the WeeklyReport ledger, so
 * the remaining same-day passes (and any cron retries) are no-ops.
 *
 * Auth: identical to /api/cron/check-ins — Vercel sends
 * `Authorization: Bearer ${CRON_SECRET}` on every cron invocation; anything
 * else is rejected, and the route fails CLOSED (503) if the secret was never
 * configured, so it can't be driven anonymously.
 *
 * Query params (mainly for verification):
 * - dryRun=1 — compose everything but persist nothing and send nothing.
 * - force=1 — bypass the day/hour schedule + the once-a-week dedup.
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
  const results = await runWeeklyReportPass({
    dryRun: url.searchParams.get("dryRun") === "1",
    force: url.searchParams.get("force") === "1",
    onlyEmail: url.searchParams.get("email") ?? undefined,
  });

  return NextResponse.json({
    processed: results.length,
    sent: results.filter((r) => r.action === "sent").length,
    results,
  });
}
