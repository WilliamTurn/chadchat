import Link from "next/link";
import { redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { Kpi } from "@/components/dashboard/kpi";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import { WaterBackfill } from "@/components/today/water-backfill";
import { WaterHistory } from "@/components/today/water-history";
import { WaterTodayLog } from "@/components/today/water-today-log";
import { RewardProvider } from "@/components/dashboard/reward";
import { WaterTracker } from "@/components/today/water-tracker";
import { WaterTrendChart } from "@/components/today/water-trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import {
  getUserById,
  getWaterDailyTotals,
  getWaterLogsSince,
} from "@/lib/db/queries";
import { resolveTimezone, todayAnchorInTz, todayStartInTz } from "@/lib/date";
import { computeWaterStats } from "@/lib/today/water-stats";
import { DEFAULT_WATER_GOAL_ML, formatOz } from "@/lib/today/water-units";
import { buildWaterWeek } from "@/lib/today/week";

/**
 * The dedicated Hydration page, water's ONE deep surface (audit rule 3 /
 * DSH-33: the /today card keeps the compact vessel + week strip; the deep
 * stats live here). Streak stat tiles, the daily trend chart, a day-by-day
 * history, and the "Log a past day" backfill card (DSH-57).
 *
 * Full-width desktop layout (LAY-1): the wide frame, with the logger column
 * (tracker + backfill) beside the day's data (today's itemized log + the
 * trend chart) at xl; phones keep the stacked order unchanged.
 */

export default function HydrationPage() {
  return (
    <PageShell active="/hydration" className="max-w-[1500px]">
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
          <h1 className="font-semibold text-2xl tracking-tight">Hydration</h1>
          {/* "Pro feature", not bare "Pro" (LC-13). */}
          <Badge variant="secondary">Pro feature</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Log your water with one tap and track it against a daily goal. Chad
          reads it alongside your food and training.
        </p>
      </div>

      <Suspense fallback={<TodaySkeleton />}>
        <HydrationContent />
      </Suspense>
    </PageShell>
  );
}

async function HydrationContent() {
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
  // Today's individual increments back BOTH the counter (summed) and the
  // itemized "Today's log" below (LC-11) — one query, one source of truth.
  const [todayEntries, waterDaily] = await Promise.all([
    getWaterLogsSince(user.id, todayStartInTz(timezone)),
    getWaterDailyTotals(user.id, timezone),
  ]);
  const waterMl = todayEntries.reduce((sum, e) => sum + e.amountMl, 0);
  const todayLog = todayEntries.map((e) => ({
    id: e.id,
    timeLabel: e.recordedAt.toLocaleTimeString("en-US", {
      timeZone: resolveTimezone(timezone),
      hour: "numeric",
      minute: "2-digit",
    }),
    amountLabel: formatOz(e.amountMl),
  }));

  const waterGoalMl = user.waterGoalMl ?? DEFAULT_WATER_GOAL_ML;
  const showTrend = waterDaily.length >= 2;
  const stats = computeWaterStats(waterDaily, waterGoalMl, timezone);
  // Anything for the data column? Without it the 2-col grid would strand a
  // dead band beside the logger (pro-app parity gate: no empty shells).
  const hasDataColumn = showTrend || todayLog.length > 0;

  return (
    <RewardProvider haptics={user.hapticsEnabled} sound={user.soundEnabled}>
    <div className="flex flex-col gap-6">
      {/* Stacked below sm like the /workouts stat tiles (house pattern); when
          the logger column below is centered (no data column yet), center the
          tiles with it so the page doesn't read as two different widths. */}
      {waterDaily.length > 0 && (
        <div
          className={
            hasDataColumn
              ? "grid grid-cols-1 gap-3 sm:grid-cols-3"
              : "mx-auto grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-3"
          }
        >
          <StatCard>
            <Kpi
              label="Goal streak"
              size="lg"
              tone={stats.current > 0 ? "good" : "neutral"}
              value={String(stats.current)}
            />
          </StatCard>
          <StatCard>
            <Kpi label="Best streak" size="lg" value={String(stats.best)} />
          </StatCard>
          <StatCard>
            <Kpi
              label="Days hit goal"
              size="lg"
              sub="30d"
              value={`${stats.hit30} / 30`}
            />
          </StatCard>
        </div>
      )}
      {/* Desktop (LAY-1): the logger column (tracker + past-day backfill)
          beside the day's data (today's itemized log + the trend chart); a
          single column below xl in the unchanged phone order. Explicit
          grid-cols-1 + min-w-0 children: without them the implicit column
          sizes to max-content and phones/tablets get silently clipped by
          overflow-x: clip (s182 gotcha).

          One CHART per page (VF-2): once the full trend chart renders, the
          tracker drops its in-card 7-day chart via weekChart, but its streak
          dot strip always stays (owner law s181, streak-strips-never-removed). */}
      <div
        className={
          hasDataColumn
            ? "grid grid-cols-1 items-start gap-6 xl:grid-cols-[420px_minmax(0,1fr)]"
            : "mx-auto flex w-full max-w-xl flex-col gap-6"
        }
      >
        <div className="flex min-w-0 flex-col gap-6">
          <WaterTracker
            goalMl={waterGoalMl}
            totalMl={waterMl}
            week={buildWaterWeek(waterDaily, timezone)}
            weekChart={!showTrend}
          />
          <WaterBackfill />
        </div>
        {hasDataColumn && (
          <div className="flex min-w-0 flex-col gap-6">
            <WaterTodayLog entries={todayLog} />
            {showTrend && (
              <WaterTrendChart
                days={waterDaily}
                goalMl={waterGoalMl}
                todayMs={todayAnchorInTz(timezone).getTime()}
              />
            )}
          </div>
        )}
      </div>
      <WaterHistory days={waterDaily} goalMl={waterGoalMl} />
    </div>
    </RewardProvider>
  );
}

/** The /workouts stat-tile treatment: a shared `Kpi` inside a card. */
function StatCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5">
      {children}
    </div>
  );
}

function UpgradePrompt() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <h2 className="font-medium text-lg">Hydration is a Chad Pro feature</h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
        Upgrade to Pro to track your daily water against a goal with one-tap
        logging.
      </p>
      <Button asChild className="mt-5">
        <Link href="/account">Upgrade to Pro</Link>
      </Button>
    </div>
  );
}
