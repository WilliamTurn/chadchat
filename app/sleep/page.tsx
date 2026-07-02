import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
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

/**
 * The dedicated Sleep & recovery page (NAV-30) — sleep's ONE deep surface
 * (audit rule 3: compact readout on /today, the full chart + history here).
 * Tracker card + full nightly trend + an editable History list, so any logged
 * night can be corrected or deleted (audit P1-3).
 */

export default function SleepPage() {
  return (
    <PageShell>
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
        }}
      />

      <StandaloneHeader active="/sleep" />

      <div className="mb-8">
        <BackToDashboard />
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">
            Sleep &amp; recovery
          </h1>
          <Badge variant="secondary">Pro</Badge>
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

  return (
    <div className="flex flex-col gap-6">
      <SleepTracker last={lastNight} week={sleepWeek} />
      {sleepDaily.length >= 2 && <SleepTrendChart days={sleepDaily} />}
      <SleepHistory entries={history} />
    </div>
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
