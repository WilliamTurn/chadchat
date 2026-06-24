import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { auth } from "@/app/(auth)/auth";
import { DeleteEntryButton } from "@/components/progress/delete-entry-button";
import { LogEntryForm } from "@/components/progress/log-entry-form";
import { WeightChart } from "@/components/progress/weight-chart";
import { StandaloneHeader } from "@/components/nav/standalone-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canAccessChad, canAccessProFeatures } from "@/lib/admin";
import { getProgressEntriesByUserId, getUserById } from "@/lib/db/queries";
import type { ProgressEntry } from "@/lib/db/schema";

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

export default function ProgressPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-12">
      <Toaster
        position="top-center"
        theme="system"
        toastOptions={{
          className:
            "!bg-card !text-foreground !border-border/50 !shadow-[var(--shadow-float)]",
        }}
      />

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

      <Suspense
        fallback={
          <div className="h-96 animate-pulse rounded-2xl border border-border bg-card" />
        }
      >
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
  const entries = await getProgressEntriesByUserId(userId);

  const weighed = entries.filter(
    (e): e is ProgressEntry & { weight: number } => e.weight != null
  );
  const displayUnit: "lb" | "kg" =
    weighed.length > 0 ? weighed[weighed.length - 1].unit : "lb";

  const points = weighed.map((e) => ({
    t: e.recordedAt.getTime(),
    weight: round1(convert(e.weight, e.unit, displayUnit)),
  }));

  const current = points.at(-1)?.weight ?? null;
  const start = points.at(0)?.weight ?? null;
  const change =
    current != null && start != null ? round1(current - start) : null;

  const photos = entries.filter((e) => e.photoUrl).reverse();
  const recent = [...entries].reverse();

  return (
    <div className="flex flex-col gap-8">
      {/* Summary */}
      {points.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <SummaryCard
            label="Current"
            value={current == null ? "—" : `${current} ${displayUnit}`}
          />
          <SummaryCard
            label="Since start"
            value={
              change == null
                ? "—"
                : `${change > 0 ? "+" : ""}${change} ${displayUnit}`
            }
          />
          <SummaryCard label="Entries" value={String(entries.length)} />
        </div>
      )}

      {/* Weight trend */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 font-medium text-lg">Weight trend</h2>
        {points.length > 0 ? (
          <WeightChart points={points} unit={displayUnit} />
        ) : (
          <p className="text-muted-foreground text-sm">
            Log a weight below and your trend shows up here.
          </p>
        )}
      </section>

      {/* Log a new entry */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 font-medium text-lg">Log an entry</h2>
        <LogEntryForm defaultUnit={displayUnit} />
      </section>

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
                  alt={`Progress on ${e.recordedAt.toLocaleDateString()}`}
                  className="aspect-square w-full object-cover"
                  src={e.photoUrl ?? ""}
                />
                <figcaption className="px-3 py-2 text-muted-foreground text-xs">
                  {e.recordedAt.toLocaleDateString()}
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
                    {e.recordedAt.toLocaleDateString()}
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
                <DeleteEntryButton id={e.id} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="font-semibold text-xl tracking-tight">{value}</div>
      <div className="mt-1 text-muted-foreground text-sm">{label}</div>
    </div>
  );
}
