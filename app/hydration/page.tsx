import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { TodaySkeleton } from "@/components/dashboard/page-skeletons";
import { PageShell } from "@/components/nav/page-shell";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { WaterTracker } from "@/components/today/water-tracker";
import { WaterTrendChart } from "@/components/today/water-trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import {
  getUserById,
  getWaterDailyTotals,
  getWaterMlSince,
} from "@/lib/db/queries";
import { todayStartInTz } from "@/lib/date";
import { DEFAULT_WATER_GOAL_ML } from "@/lib/today/water-units";
import { buildWaterWeek } from "@/lib/today/week";

/**
 * The dedicated Hydration page — water's ONE deep surface (audit rule 3 /
 * DSH-33: the /today card keeps the compact vessel + week strip; the full
 * daily-history chart lives here, exactly like /sleep is sleep's deep surface).
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
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">Hydration</h1>
          <Badge variant="secondary">Pro</Badge>
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
  const [waterMl, waterDaily] = await Promise.all([
    getWaterMlSince(user.id, todayStartInTz(timezone)),
    getWaterDailyTotals(user.id, timezone),
  ]);

  const waterGoalMl = user.waterGoalMl ?? DEFAULT_WATER_GOAL_ML;
  const waterWeek = buildWaterWeek(waterDaily, timezone);

  return (
    <div className="flex flex-col gap-6">
      <WaterTracker goalMl={waterGoalMl} totalMl={waterMl} week={waterWeek} />
      {waterDaily.length >= 2 && (
        <WaterTrendChart days={waterDaily} goalMl={waterGoalMl} />
      )}
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
