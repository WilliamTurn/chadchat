import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import {
  type LastNight,
  type SleepNight,
  SleepTracker,
} from "@/components/today/sleep-tracker";
import { SleepTrendChart } from "@/components/today/sleep-trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import {
  formatCalendarDay,
  startOfDayUTC,
  startOfTodayUTC,
} from "@/lib/date";
import {
  getLatestSleepEntry,
  getSleepDailyTotals,
  getUserById,
} from "@/lib/db/queries";

/**
 * The dedicated Sleep & recovery page (NAV-30). The sleep tracker + trend were
 * only reachable as cards buried on /today, so they were easy to miss; this
 * gives the Pro sleep feature its own home in the shared nav, the same way every
 * other tracked metric (weight, workouts, nutrition) has a focused page. It
 * reuses the exact /today components (one source of truth) — the last-night
 * readout + week strip + the full nightly trend.
 */

const DAY_MS = 86_400_000;
const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

/** "Today" / "Yesterday" / "N days ago" / a short date — matches /today. */
function relativeDay(d: Date): string {
  const today = startOfTodayUTC();
  const that = startOfDayUTC(d);
  const diffDays = Math.round((today.getTime() - that.getTime()) / DAY_MS);
  if (diffDays <= 0) {
    return "Today";
  }
  if (diffDays === 1) {
    return "Yesterday";
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return formatCalendarDay(d, { month: "short", day: "numeric" });
}

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

  const [latestSleep, sleepDaily] = await Promise.all([
    getLatestSleepEntry(user.id),
    getSleepDailyTotals(user.id),
  ]);

  // Last night's readout + the rolling 7-night week strip, built exactly like
  // /today (daily totals are keyed to each day's midnight-UTC ms).
  const startOfToday = startOfTodayUTC();
  const sleepByDay = new Map(sleepDaily.map((s) => [s.t, s] as const));
  const lastNight: LastNight = latestSleep
    ? {
        minutes: latestSleep.minutes,
        quality: latestSleep.quality,
        whenLabel: relativeDay(latestSleep.recordedAt),
      }
    : null;
  const sleepWeek: SleepNight[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfToday.getTime() - (6 - i) * DAY_MS);
    const entry = sleepByDay.get(d.getTime());
    return {
      t: d.getTime(),
      label: WEEKDAY_INITIALS[d.getUTCDay()],
      minutes: entry?.minutes ?? 0,
      quality: entry?.quality ?? null,
      logged: entry != null,
      isToday: i === 6,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <SleepTracker last={lastNight} week={sleepWeek} />
      {sleepDaily.length >= 2 && <SleepTrendChart days={sleepDaily} />}
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
