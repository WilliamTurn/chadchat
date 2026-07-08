"use client";

import { Clock, Dumbbell, Flame, ListChecks, Trophy } from "lucide-react";
import Link from "next/link";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { Button } from "@/components/ui/button";
import { formatDuration } from "@/lib/workouts/stats";
import { cn } from "@/lib/utils";

export type SummaryPr = {
  exercise: string;
  label: string;
  detail: string;
};

export type MuscleSlice = {
  label: string;
  sets: number;
};

/**
 * The post-workout payoff screen (MOB-18): most trackers end a session on a
 * plain save toast; the best (Boostcamp, RepCount) make finishing feel like
 * something. Duration / volume / sets, every PR earned, the muscle-group
 * breakdown, volume vs your recent average, then hand the session to Chad.
 */
export function FinishSummary({
  title,
  durationSeconds,
  volumeLb,
  setsDone,
  exerciseCount,
  prs,
  muscles,
  volumeVsAverage,
  chadPrompt,
}: {
  title: string;
  durationSeconds: number | null;
  volumeLb: number;
  setsDone: number;
  exerciseCount: number;
  prs: SummaryPr[];
  muscles: MuscleSlice[];
  /** Signed % vs the average of recent sessions; null with too little history. */
  volumeVsAverage: number | null;
  chadPrompt: string;
}) {
  const maxSets = Math.max(1, ...muscles.map((m) => m.sets));

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <p className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
          Workout logged
        </p>
        <h2 className="mt-1 font-display font-semibold text-3xl tracking-tight">
          {title}
        </h2>
        {volumeVsAverage != null && (
          <p
            className={cn(
              "mt-2 text-sm",
              volumeVsAverage >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground"
            )}
          >
            {volumeVsAverage >= 0
              ? `${volumeVsAverage}% more volume than your recent average.`
              : `${Math.abs(volumeVsAverage)}% below your recent average volume.`}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <SummaryStat
          icon={<Clock className="size-4" />}
          label="Duration"
          value={formatDuration(durationSeconds) ?? "—"}
        />
        <SummaryStat
          icon={<Flame className="size-4" />}
          label="Volume"
          value={volumeLb > 0 ? `${volumeLb.toLocaleString()} lb` : "—"}
        />
        <SummaryStat
          icon={<ListChecks className="size-4" />}
          label="Sets done"
          value={String(setsDone)}
        />
        <SummaryStat
          icon={<Dumbbell className="size-4" />}
          label="Exercises"
          value={String(exerciseCount)}
        />
      </div>

      {prs.length > 0 && (
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="flex items-center gap-2 font-medium text-sm uppercase tracking-wide">
            <Trophy className="size-4 text-amber-500" />
            {prs.length === 1
              ? "New personal record"
              : `${prs.length} new personal records`}
          </h3>
          <div className="mt-3 flex flex-col gap-2">
            {prs.map((pr) => (
              <div
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg border border-border bg-card px-3 py-2"
                key={`${pr.exercise}-${pr.label}-${pr.detail}`}
              >
                <span className="font-medium text-sm">{pr.exercise}</span>
                <span className="text-muted-foreground text-xs">
                  {pr.label} · {pr.detail}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {muscles.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <h3 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
            What you trained
          </h3>
          <div className="mt-3 flex flex-col gap-2">
            {muscles.map((m) => (
              <div className="flex items-center gap-3" key={m.label}>
                <span className="w-24 shrink-0 text-sm">{m.label}</span>
                <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-foreground/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blood/70 to-blood"
                    style={{ width: `${Math.round((m.sets / maxSets) * 100)}%` }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right text-muted-foreground text-xs">
                  {m.sets} set{m.sets === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-col items-center gap-3">
        <Button asChild className="h-11 w-full sm:w-auto sm:min-w-56">
          <Link href="/workouts">Done, back to Workouts</Link>
        </Button>
        <AskChadButton prompt={chadPrompt} />
      </div>
    </div>
  );
}

function SummaryStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-3 py-4 text-center">
      <span className="text-muted-foreground">{icon}</span>
      <span className="font-semibold text-lg tracking-tight tabular-nums">
        {value}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}
