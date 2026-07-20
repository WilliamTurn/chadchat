import Link from "next/link";
import { redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { auth } from "@/app/(auth)/auth";
import { Kpi } from "@/components/dashboard/kpi";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { BackLink } from "@/components/nav/back-link";
import { PageShell } from "@/components/nav/page-shell";
import { HydrationPanel } from "@/components/today/hydration-panel";
import { WaterBackfill } from "@/components/today/water-backfill";
import {
  WaterHistory,
  type WaterHistoryDay,
} from "@/components/today/water-history";
import { WaterTodayLog } from "@/components/today/water-today-log";
import { RewardProvider } from "@/components/dashboard/reward";
import { WaterTrendChart } from "@/components/today/water-trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import {
  getUserById,
  getWaterDailyTotals,
  getWaterGoalMlByDay,
  getWaterLogsSince,
} from "@/lib/db/queries";
import {
  calendarDayAnchorInTz,
  resolveTimezone,
  todayAnchorInTz,
  todayStartInTz,
} from "@/lib/date";
import { getHydrationPanelData } from "@/lib/today/panel-data";
import { computeWaterStats } from "@/lib/today/water-stats";
import { DEFAULT_WATER_GOAL_ML, formatOz } from "@/lib/today/water-units";

/**
 * The dedicated Hydration page, water's ONE deep surface (audit rule 3 /
 * DSH-33: the /home card keeps the compact vessel + week strip; the deep
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

      <div className="mb-8">
        <BackLink />
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
  // The panel's numbers come from the canonical assembler (P56-C, FIX-26:
  // one source for every mount, per-day FIX-07 goals included); the page's
  // deep surfaces (itemized log, trend, history) keep their own queries.
  // History entries (last 30 days) power the per-entry delete rows.
  const [panelData, todayEntries, waterDaily, historyEntries] =
    await Promise.all([
      getHydrationPanelData(user),
      getWaterLogsSince(user.id, todayStartInTz(timezone)),
      getWaterDailyTotals(user.id, timezone),
      getWaterLogsSince(user.id, new Date(Date.now() - 30 * 86_400_000)),
    ]);
  const timeLabelOf = (at: Date) =>
    at.toLocaleTimeString("en-US", {
      timeZone: resolveTimezone(timezone),
      hour: "numeric",
      minute: "2-digit",
    });
  const todayLog = todayEntries.map((e) => ({
    id: e.id,
    timeLabel: timeLabelOf(e.recordedAt),
    amountLabel: formatOz(e.amountMl),
  }));

  // Each history day grades against the goal active on THAT day (FIX-07) and
  // carries its individual entries for the per-entry confirmed delete.
  const historyGoals = await getWaterGoalMlByDay(
    user.id,
    waterDaily.map((d) => new Date(d.t))
  );
  const entriesByDay = new Map<number, WaterHistoryDay["entries"]>();
  for (const e of historyEntries) {
    const t = calendarDayAnchorInTz(e.recordedAt, timezone).getTime();
    const list = entriesByDay.get(t) ?? [];
    list.push({
      id: e.id,
      timeLabel: timeLabelOf(e.recordedAt),
      amountLabel: formatOz(e.amountMl),
    });
    entriesByDay.set(t, list);
  }
  const historyDays: WaterHistoryDay[] = waterDaily.map((d, i) => ({
    t: d.t,
    ml: d.ml,
    goalMl: historyGoals[i] ?? DEFAULT_WATER_GOAL_ML,
    entries: entriesByDay.get(d.t) ?? [],
  }));

  const waterGoalMl = panelData.goalMl;
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
          {/* The FIX-26 typed panel (P56-C): strip AND chart in every state
              (owner law s181; the one-chart-per-page VF-2 note yielded to the
              panel role contract), quick-log overlay, exact-entry Undo. */}
          <HydrationPanel
            backfillHref="#log-past-day"
            goalMl={panelData.goalMl}
            totalMl={panelData.totalMl}
            // Already on the deep surface: the named detail link points at
            // this page's own history section instead of itself.
            viewHref="#history"
            week={panelData.week}
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
      {/* Sections share one alignment (pre-delivery audit P2: with only the
          centered column above, a full-width History stranded a dead band). */}
      <div className={hasDataColumn ? undefined : "mx-auto w-full max-w-xl"}>
        <WaterHistory days={historyDays} />
      </div>
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
