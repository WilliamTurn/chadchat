import Link from "next/link";
import { redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { Kpi } from "@/components/dashboard/kpi";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { BackToDashboard } from "@/components/nav/back-to-dashboard";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { WaterHistory } from "@/components/today/water-history";
import { WaterTodayLog } from "@/components/today/water-today-log";
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
import { resolveTimezone, todayStartInTz } from "@/lib/date";
import { computeWaterStats } from "@/lib/today/water-stats";
import { DEFAULT_WATER_GOAL_ML, formatOz } from "@/lib/today/water-units";
import { buildWaterWeek } from "@/lib/today/week";

/**
 * The dedicated Hydration page, water's ONE deep surface (audit rule 3 /
 * DSH-33: the /today card keeps the compact vessel + week strip; the deep
 * stats live here). Built to the /workouts template (VF-6): streak stat tiles,
 * the daily trend chart, and a day-by-day history, on the narrow tool-page
 * frame so the quick-add controls stop stretching.
 */

export default function HydrationPage() {
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

      <StandaloneHeader active="/hydration" />

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

  return (
    <div className="flex flex-col gap-6">
      {waterDaily.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
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
      {/* One chart per page: the tracker's week strip only shows while there
          isn't enough history for the full trend chart below (the same call
          /sleep made in s123). Tracker + today's itemized log share a 2-up row
          at the standard page width (DSH-49) so neither stretches sparse. */}
      <div
        className={
          todayLog.length > 0
            ? "grid gap-6 md:grid-cols-2 md:items-start"
            : undefined
        }
      >
        <WaterTracker
          goalMl={waterGoalMl}
          totalMl={waterMl}
          week={showTrend ? undefined : buildWaterWeek(waterDaily, timezone)}
        />
        <WaterTodayLog entries={todayLog} />
      </div>
      {showTrend && <WaterTrendChart days={waterDaily} goalMl={waterGoalMl} />}
      <WaterHistory days={waterDaily} goalMl={waterGoalMl} />
    </div>
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
