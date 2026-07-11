import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { RewardProvider } from "@/components/dashboard/reward";
import { auth } from "@/app/(auth)/auth";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import {
  SleepHistory,
  type SleepHistoryEntry,
} from "@/components/today/sleep-history";
import { SleepTracker } from "@/components/today/sleep-tracker";
import { SleepTrendChart } from "@/components/today/sleep-trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import { formatCalendarDay, toCalendarDayISO } from "@/lib/date";
import {
  getLatestSleepEntry,
  getSleepDailyTotals,
  getSleepEntries,
  getUserById,
} from "@/lib/db/queries";
import { buildLastNight, buildSleepWeek } from "@/lib/today/week";
import { SLEEP_GOAL_MINUTES } from "@/lib/validation/sleep";

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
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
        }}
      />


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
  const [latestSleep, sleepDaily, sleepEntries] = await Promise.all([
    getLatestSleepEntry(user.id),
    getSleepDailyTotals(user.id, timezone),
    getSleepEntries(user.id),
  ]);

  const lastNight = buildLastNight(latestSleep, timezone);
  const sleepWeek = buildSleepWeek(sleepDaily, timezone);
  const history: SleepHistoryEntry[] = sleepEntries.map((e) => ({
    id: e.id,
    iso: toCalendarDayISO(e.recordedAt),
    dateLabel: formatCalendarDay(e.recordedAt, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    minutes: e.minutes,
    quality: e.quality,
  }));

  // One sleep chart per page (VF-2): once the full trend chart below has
  // enough nights to render, the tracker card drops its 7-night strip and
  // stays the readout + logger.
  const showTrend = sleepDaily.length >= 2;

  // The user's nightly target (DSH-40); null = the recommended 7h default.
  const goalMinutes = user.sleepGoalMinutes ?? SLEEP_GOAL_MINUTES;

  return (
    <RewardProvider haptics={user.hapticsEnabled} sound={user.soundEnabled}>
      {showTrend ? (
        <div className="flex flex-col gap-6">
          {/* Desktop (LAY-1): the tracker/logger beside the full trend chart;
              a single column below xl in the unchanged phone order. Explicit
              grid-cols-1 + min-w-0 children: without them the implicit column
              sizes to max-content and phones/tablets get silently clipped by
              overflow-x: clip (s182 gotcha). */}
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="min-w-0">
              <SleepTracker
                goalMinutes={goalMinutes}
                last={lastNight}
                week={sleepWeek}
                weekChart={false}
              />
            </div>
            <div className="min-w-0">
              <SleepTrendChart days={sleepDaily} goalMinutes={goalMinutes} />
            </div>
          </div>
          <SleepHistory entries={history} goalMinutes={goalMinutes} />
        </div>
      ) : (
        // Sparse data (fewer than 2 nights): no trend chart yet, so the
        // tracker (with its in-card week chart) and the at-most-one history
        // row sit in a centered column instead of stranding on the wide frame.
        <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
          <SleepTracker
            goalMinutes={goalMinutes}
            last={lastNight}
            week={sleepWeek}
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
