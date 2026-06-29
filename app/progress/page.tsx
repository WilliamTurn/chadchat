import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProgressSkeleton } from "@/components/dashboard/page-skeletons";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { DeleteEntryButton } from "@/components/progress/delete-entry-button";
import { EditEntryButton } from "@/components/progress/edit-entry-button";
import { LogEntryForm } from "@/components/progress/log-entry-form";
import { MeasurementsSection } from "@/components/progress/measurements-section";
import { PhotoCompare } from "@/components/progress/photo-compare";
import { WeightChartInteractive } from "@/components/progress/weight-chart-interactive";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import { formatCalendarDay, toCalendarDayISO } from "@/lib/date";
import {
  getActiveGoalsByUserId,
  getBodyMeasurementsByUserId,
  getProgressEntriesByUserId,
  getUserById,
} from "@/lib/db/queries";
import type { Goal, ProgressEntry } from "@/lib/db/schema";

const isoDate = toCalendarDayISO;

/** Numeric calendar-day display (e.g. "6/25/2026"), tz-stable. */
function displayDate(d: Date): string {
  return formatCalendarDay(d, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

const LB_PER_KG = 2.204_62;

function convert(weight: number, from: "lb" | "kg", to: "lb" | "kg"): number {
  if (from === to) {
    return weight;
  }
  return to === "lb" ? weight * LB_PER_KG : weight / LB_PER_KG;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** The target weight (in `displayUnit`) from the user's active weight goal, if any. */
function weightGoalTarget(
  goals: Goal[],
  displayUnit: "lb" | "kg"
): number | null {
  const wg = goals.find(
    (g) => g.metric === "weight" && g.targetValue != null
  );
  if (!wg || wg.targetValue == null) {
    return null;
  }
  const from: "lb" | "kg" =
    (wg.unit ?? "").trim().toLowerCase().startsWith("k") ? "kg" : "lb";
  return round1(convert(wg.targetValue, from, displayUnit));
}

export default function ProgressPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-12">
      {/* richColors: success → green, error → red (the "Logged." confirmation
          reads as a clear success instead of a neutral gray toast). */}
      <Toaster position="top-center" richColors theme="system" />

      <StandaloneHeader active="/progress" />

      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">
            Your progress
          </h1>
          <Badge variant="secondary">Pro</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Track your weight and progress photos over time.
        </p>
      </div>

      <Suspense fallback={<ProgressSkeleton />}>
        <ProgressContent />
      </Suspense>
    </main>
  );
}

async function ProgressContent() {
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

  const isPro = canAccessProFeatures(user);

  return isPro ? <Dashboard userId={user.id} /> : <UpgradePrompt />;
}

function UpgradePrompt() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <h2 className="font-medium text-lg">
        The progress dashboard is a Chad Pro feature
      </h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
        Upgrade to Pro to log your weight, track progress photos over time, and
        watch the trend — the stuff a real coach keeps on you about.
      </p>
      <Button asChild className="mt-5">
        <Link href="/account">Upgrade to Pro</Link>
      </Button>
    </div>
  );
}

async function Dashboard({ userId }: { userId: string }) {
  const [entries, measurements, goals] = await Promise.all([
    getProgressEntriesByUserId(userId),
    getBodyMeasurementsByUserId(userId),
    getActiveGoalsByUserId(userId),
  ]);

  const weighed = entries.filter(
    (e): e is ProgressEntry & { weight: number } => e.weight != null
  );
  const displayUnit: "lb" | "kg" =
    weighed.length > 0 ? weighed[weighed.length - 1].unit : "lb";

  const points = weighed.map((e) => ({
    t: e.recordedAt.getTime(),
    weight: round1(convert(e.weight, e.unit, displayUnit)),
  }));

  const goalWeight = weightGoalTarget(goals, displayUnit);

  const photos = entries.filter((e) => e.photoUrl).reverse();
  const recent = [...entries].reverse();

  return (
    <div className="flex flex-col gap-8">
      {/* Weight trend — the chart owns its card chrome, KPI strip and toggle. */}
      {points.length > 0 ? (
        <WeightChartInteractive
          goalWeight={goalWeight}
          points={points}
          unit={displayUnit}
        />
      ) : (
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-2 font-medium text-lg">Weight trend</h2>
          <p className="text-muted-foreground text-sm">
            Log a weight below and your trend shows up here.
          </p>
        </section>
      )}

      {/* Log a new entry */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 font-medium text-lg">Log an entry</h2>
        <LogEntryForm defaultUnit={displayUnit} />
      </section>

      {/* Body measurements */}
      <MeasurementsSection
        measurements={measurements.map((m) => ({
          id: m.id,
          recordedAt: isoDate(m.recordedAt),
          kind: m.kind,
          value: m.value,
          unit: m.unit,
        }))}
      />

      {/* Before / after compare */}
      {photos.length >= 2 && (
        <PhotoCompare
          photos={[...photos]
            .reverse()
            .map((e) => ({
              url: e.photoUrl ?? "",
              date: displayDate(e.recordedAt),
            }))}
        />
      )}

      {/* Progress photos */}
      {photos.length > 0 && (
        <section>
          <h2 className="mb-4 font-medium text-lg">Progress photos</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {photos.map((e) => (
              <figure
                className="overflow-hidden rounded-xl border border-border bg-card"
                key={e.id}
              >
                {/* biome-ignore lint/performance/noImgElement: user-uploaded blob images, sizes vary */}
                <img
                  alt={`Progress on ${displayDate(e.recordedAt)}`}
                  className="aspect-square w-full object-cover"
                  src={e.photoUrl ?? ""}
                />
                <figcaption className="px-3 py-2 text-muted-foreground text-xs">
                  {displayDate(e.recordedAt)}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* History */}
      {recent.length > 0 && (
        <section>
          <h2 className="mb-4 font-medium text-lg">History</h2>
          <div className="overflow-hidden rounded-2xl border border-border">
            {recent.map((e, i) => (
              <div
                className={`flex items-start justify-between gap-4 bg-card px-5 py-3.5 ${
                  i === 0 ? "" : "border-border border-t"
                }`}
                key={e.id}
              >
                <div className="min-w-0">
                  <div className="font-medium text-sm">
                    {displayDate(e.recordedAt)}
                    {e.weight != null && (
                      <span className="ml-2 text-muted-foreground">
                        {round1(e.weight)} {e.unit}
                      </span>
                    )}
                  </div>
                  {e.note && (
                    <p className="mt-0.5 break-words text-muted-foreground text-sm">
                      {e.note}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <EditEntryButton
                    id={e.id}
                    note={e.note}
                    recordedAt={isoDate(e.recordedAt)}
                    unit={e.unit}
                    weight={e.weight == null ? null : round1(e.weight)}
                  />
                  <DeleteEntryButton id={e.id} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
