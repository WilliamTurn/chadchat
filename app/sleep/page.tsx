import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { RewardProvider } from "@/components/dashboard/reward";
import { auth } from "@/app/(auth)/auth";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import {
  SleepHistory,
  type SleepHistoryEntry,
} from "@/components/today/sleep-history";
import { SleepPanel } from "@/components/today/sleep-panel";
import { SleepTrendChart } from "@/components/today/sleep-trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import {
  calendarDayAnchorInTz,
  formatCalendarDay,
  toCalendarDayISO,
  todayAnchorInTz,
} from "@/lib/date";
import {
  getSleepDailyTotals,
  getSleepEntries,
  getSleepGoalMinutesByDay,
  getUserById,
} from "@/lib/db/queries";
import { getSleepPanelData } from "@/lib/today/panel-data";

/**
 * The dedicated Sleep & recovery page (NAV-30) — sleep's ONE deep surface
 * (audit rule 3: compact readout on /today, the full chart + history here).
 * Tracker card + full nightly trend + an editable History list, so any logged
 * night can be corrected or deleted (audit P1-3).
 *
 * Full-width desktop layout (LAY-1): the wide frame, with the tracker/logger
 * card beside the nightly trend chart at xl and the history rows gridding up
 * below; phones keep the stacked order unchanged.
 */

export default function SleepPage() {
  return (
    <PageShell active="/sleep" className="max-w-[1500px]">

      <div className="mb-8">
        <BackToDashboard />
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">Sleep</h1>
          {/* "Pro feature", not bare "Pro" (LC-13). */}
          <Badge variant="secondary">Pro feature</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Log how you sleep each night and Chad factors recovery into your
          training. See it next to your weight and lifts on{" "}
          <Link
            className="text-foreground underline underline-offset-4"
            href="/progress"
          >
            Progress
          </Link>
          .
        </p>
      </div>

      <Suspense fallback={<TodaySkeleton />}>
        <SleepContent />
      </Suspense>
    </PageShell>
  );
}

async function SleepContent() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await getUserById(session.user.id);
  if (!user) {
    redirect("/login");
  }
  // Legal gate (BLK-4): accept the Terms before using the product.
  if (!user.acceptedTermsAt) {
    redirect("/legal");
  }
  if (!canAccessChad(user)) {
    redirect("/pricing");
  }

  if (!canAccessProFeatures(user)) {
    return <UpgradePrompt />;
  }

  const timezone = user.timezone;
  // The panel's numbers come from the canonical assembler (P56-C, FIX-27:
  // one source for every mount, per-night FIX-07 goals included); the page's
  // deep surfaces (trend chart, history) keep their own queries.
  const [panelData, sleepDaily, sleepEntries] = await Promise.all([
    getSleepPanelData(user),
    getSleepDailyTotals(user.id, timezone),
    getSleepEntries(user.id),
  ]);

  // Each history night grades against the goal active on THAT night (FIX-07).
  const historyGoals = await getSleepGoalMinutesByDay(
    user.id,
    sleepEntries.map((e) => calendarDayAnchorInTz(e.recordedAt, timezone))
  );
  const history: SleepHistoryEntry[] = sleepEntries.map((e, i) => ({
    id: e.id,
    iso: toCalendarDayISO(e.recordedAt),
    dateLabel: formatCalendarDay(e.recordedAt, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    minutes: e.minutes,
    quality: e.quality,
    goalMinutes: historyGoals[i] ?? panelData.goalMinutes,
  }));

  // Enough nights for the full windowed trend chart below?
  const showTrend = sleepDaily.length >= 2;

  // Today's effective-dated goal (FIX-07) from the canonical assembler.
  const goalMinutes = panelData.goalMinutes;

  return (
    <RewardProvider haptics={user.hapticsEnabled} sound={user.soundEnabled}>
      {showTrend ? (
        <div className="flex flex-col gap-6">
          {/* Desktop (LAY-1): the FIX-27 typed panel (P56-C; strip AND chart
              in every state per owner law s181, overlay logging, exact-entry
              Undo) beside the full trend chart; a single column below xl in
              the unchanged phone order. Explicit grid-cols-1 + min-w-0
              children: without them the implicit column sizes to max-content
              and phones/tablets get silently clipped by overflow-x: clip
              (s182 gotcha). */}
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="min-w-0">
              <SleepPanel
                goalMinutes={panelData.goalMinutes}
                isDefaultGoal={panelData.isDefaultGoal}
                lastNight={panelData.lastNight}
                viewHref="#history"
                viewLabel="Night history"
                week={panelData.week}
              />
            </div>
            <div className="min-w-0">
              <SleepTrendChart
                days={sleepDaily}
                goalMinutes={goalMinutes}
                todayMs={todayAnchorInTz(timezone).getTime()}
              />
            </div>
          </div>
          <SleepHistory entries={history} goalMinutes={goalMinutes} />
        </div>
      ) : (
        // Sparse data (fewer than 2 nights): no trend chart yet, so the
        // panel and the at-most-one history row sit in a centered column
        // instead of stranding on the wide frame.
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
          <SleepPanel
            goalMinutes={panelData.goalMinutes}
            isDefaultGoal={panelData.isDefaultGoal}
            lastNight={panelData.lastNight}
            viewHref="#history"
            viewLabel="Night history"
            week={panelData.week}
          />
          <SleepHistory entries={history} goalMinutes={goalMinutes} />
        </div>
      )}
    </RewardProvider>
  );
}

function UpgradePrompt() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <h2 className="font-medium text-lg">
        Sleep &amp; recovery is a Chad Pro feature
      </h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
        Upgrade to Pro to log your sleep each night and have Chad factor recovery
        into your training and progress.
      </p>
      <Button asChild className="mt-5">
        <Link href="/account">Upgrade to Pro</Link>
      </Button>
    </div>
  );
}
