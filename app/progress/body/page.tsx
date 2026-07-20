import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProgressSkeleton } from "@/components/dashboard/page-skeletons";
import { auth } from "@/app/(auth)/auth";
import { DeleteEntryButton } from "@/components/progress/delete-entry-button";
import { EditEntryButton } from "@/components/progress/edit-entry-button";
import { RewardProvider } from "@/components/dashboard/reward";
import { LogEntryForm } from "@/components/progress/log-entry-form";
import { MeasurementsSection } from "@/components/progress/measurements-section";
import { MontageCard } from "@/components/progress/montage-card";
import { PhotoCompare } from "@/components/progress/photo-compare";
import { WeightChartInteractive } from "@/components/progress/weight-chart-interactive";
import { BackLink } from "@/components/nav/back-link";
import { PageShell } from "@/components/nav/page-shell";
import { ScrollToHash } from "@/components/nav/scroll-to-hash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import {
  formatCalendarDay,
  toCalendarDayISO,
  todayAnchorInTz,
} from "@/lib/date";
import {
  getActiveGoalsByUserId,
  getBodyMeasurementsByUserId,
  getLatestProgressMontage,
  getProgressEntriesByUserId,
  getUserById,
} from "@/lib/db/queries";
import type { ProgressEntry } from "@/lib/db/schema";
import { parseProgressMontageContent } from "@/lib/montage/content";
import {
  convertWeight,
  round1,
  weightGoalStart,
  weightGoalTarget,
} from "@/lib/progress/weight";

const isoDate = toCalendarDayISO;

/** Numeric calendar-day display (e.g. "6/25/2026"), tz-stable. */
function displayDate(d: Date): string {
  return formatCalendarDay(d, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

/**
 * FIX-31 (DEC-02): the Body category page. This is the former /progress page,
 * relocated with every capability, value, and deep link preserved; /progress
 * itself is now the cross-domain overview (FIX-32). Legacy /weight and /body
 * URLs redirect here (next.config.ts).
 */
export default function ProgressBodyPage() {
  return (
    // Full-width desktop layout (LAY-1): the wide frame, filled with a real
    // dashboard grid (chart + log form side by side, paired photo panels).
    <PageShell active="/progress" className="max-w-[var(--container-content)]">
      {/* richColors: success renders green, error red (the "Logged." confirmation
          reads as a clear success instead of a neutral gray toast). */}

      <div className="mb-8">
        <BackLink href="/progress" label="Progress" />
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-2xl tracking-tight">Body</h1>
          {/* "Pro feature", not bare "Pro" (LC-13). */}
          <Badge variant="secondary">Pro feature</Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">
          Track your weight, measurements, and progress photos over time.
        </p>
      </div>

      <Suspense fallback={<ProgressSkeleton />}>
        <BodyContent />
      </Suspense>
    </PageShell>
  );
}

async function BodyContent() {
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

  const isPro = canAccessProFeatures(user);

  return isPro ? (
    <RewardProvider haptics={user.hapticsEnabled} sound={user.soundEnabled}>
      <Dashboard
        preferredUnit={user.weightUnit}
        timezone={user.timezone}
        userId={user.id}
      />
    </RewardProvider>
  ) : (
    <UpgradePrompt />
  );
}

function UpgradePrompt() {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center">
      <h2 className="font-medium text-lg">
        Body tracking is a Chad Pro feature
      </h2>
      <p className="mx-auto mt-2 max-w-md text-muted-foreground text-sm">
        Upgrade to Pro to log your weight, track progress photos over time, and
        watch the trend, the stuff a real coach keeps on you about.
      </p>
      <Button asChild className="mt-5">
        <Link href="/account">Upgrade to Pro</Link>
      </Button>
    </div>
  );
}

async function Dashboard({
  userId,
  preferredUnit,
  timezone,
}: {
  userId: string;
  preferredUnit: "lb" | "kg" | null;
  timezone: string | null;
}) {
  const [entries, measurements, goals, latestMontage] = await Promise.all([
    getProgressEntriesByUserId(userId),
    getBodyMeasurementsByUserId(userId),
    getActiveGoalsByUserId(userId),
    getLatestProgressMontage(userId),
  ]);

  const weighed = entries.filter(
    (e): e is ProgressEntry & { weight: number } => e.weight != null
  );
  // The account-level unit preference wins; otherwise infer from the most recent
  // weigh-in (falling back to lb). All points below convert into this unit, so
  // flipping the preference re-labels + re-scales the whole weight dashboard.
  const displayUnit: "lb" | "kg" =
    preferredUnit ??
    (weighed.length > 0 ? weighed[weighed.length - 1].unit : "lb");

  const points = weighed.map((e) => ({
    t: e.recordedAt.getTime(),
    weight: round1(convertWeight(e.weight, e.unit, displayUnit)),
  }));

  const goalWeight = weightGoalTarget(goals, displayUnit);
  const goalStartWeight = weightGoalStart(goals, displayUnit);

  const photos = entries.filter((e) => e.photoUrl).reverse();
  const recent = [...entries].reverse();

  return (
    <div className="flex flex-col gap-8">
      <ScrollToHash />
      {/* Desktop (LAY-1): the trend chart with the log form beside it; a single
          column below xl. Explicit grid-cols-1 + min-w-0 children: without
          them the implicit column sizes to max-content and phones/tablets get
          silently clipped by overflow-x: clip. */}
      <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-3">
        {/* Weight trend: the chart owns its card chrome, KPI strip and toggle. */}
        <div className="min-w-0 xl:col-span-2">
          {points.length > 0 ? (
            <WeightChartInteractive
              goalStartWeight={goalStartWeight}
              goalWeight={goalWeight}
              points={points}
              todayMs={todayAnchorInTz(timezone).getTime()}
              unit={displayUnit}
              urlState
            />
          ) : (
            <section className="rounded-2xl border border-border bg-card p-6">
              <h2 className="mb-2 font-medium text-lg">Weight trend</h2>
              <p className="text-muted-foreground text-sm">
                Log a weight below and your trend shows up here.
              </p>
            </section>
          )}
        </div>

        {/* Log a new entry. id: the dashboard card's "Log weight" landing spot (R2-5). */}
        <section
          className="min-w-0 scroll-mt-20 rounded-2xl border border-border bg-card p-6"
          id="log-entry"
        >
          <h2 className="mb-4 font-medium text-lg">Log an entry</h2>
          <LogEntryForm defaultUnit={displayUnit} />
        </section>
      </div>

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

      {/* Before/after compare + Chad's montage (FEAT-18): both need 2+ photos,
          so they pair into one desktop row; stacked below xl. */}
      {photos.length >= 2 && (
        <div className="grid grid-cols-1 items-start gap-8 xl:grid-cols-2">
          <div className="min-w-0">
            <PhotoCompare
              photos={[...photos].reverse().map((e) => ({
                url: e.photoUrl ?? "",
                date: displayDate(e.recordedAt),
              }))}
            />
          </div>
          <div className="min-w-0">
            <MontageCard
              generatedAtLabel={
                latestMontage ? displayDate(latestMontage.createdAt) : null
              }
              initial={
                latestMontage
                  ? parseProgressMontageContent(latestMontage.content)
                  : null
              }
            />
          </div>
        </div>
      )}

      {/* Progress photos */}
      {photos.length > 0 && (
        <section>
          <h2 className="mb-4 font-medium text-lg">Progress photos</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
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
          <h2 className="mb-4 font-medium text-lg">Weight History</h2>
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
                <div className="flex shrink-0 items-center gap-2">
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
