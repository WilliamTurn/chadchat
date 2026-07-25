"use client";

/**
 * RECORDS & MILESTONES TIMELINE (FIX-33): the wave's signature reward
 * surface. A chronological trophy wall of every record-beating set and every
 * reached milestone, newest first, each entry tapping through to the workout
 * that earned it (the Hevy record-to-source + Strava trophy-case patterns;
 * evidence-p56b/benchmark-teardown.md sections 2d/2e).
 *
 * Honesty laws, enforced here:
 *   - Every entry is a REAL event from the one replay in
 *     lib/workouts/stats.ts / training-analytics.ts (registered metrics
 *     training.pr.timeline / training.milestones.timeline); nothing is
 *     projected or decorative.
 *   - The celebration hero appears only when the newest win is genuinely
 *     recent, announces itself via an aria-live region in words, and its
 *     motion flourish (celebration-scene.tsx) loads on demand and is gated
 *     behind prefers-reduced-motion with a designed static treatment.
 *   - Retroactive credit (the Apple model): the timeline is replayed from
 *     the member's full real history on first view, never zeroed.
 */

import { ArrowUpRight, Flag, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { KpiHelp } from "@/components/dashboard/kpi";
import { Button } from "@/components/ui/button";
import { MS_PER_DAY } from "@/lib/chart/trend";
import { formatShortDate } from "@/lib/chart/format";
import { REWARD_GOLD_WASH } from "@/lib/chart/palette";
import type { PrEvent } from "@/lib/workouts/stats";
import type { TrainingMilestone } from "@/lib/workouts/training-analytics";
import { CelebrationScene } from "./celebration-scene";

/** Tokenized reward glows (owner reward-glow direction), color-mix derived
 *  like the P56-A TREND_GLOW so they can never drift from the tokens. */
const GOLD_GLOW =
  "[filter:drop-shadow(0_0_6px_color-mix(in_oklab,var(--chart-3)_60%,transparent))]";
const EMERALD_GLOW =
  "[filter:drop-shadow(0_0_6px_color-mix(in_oklab,var(--chart-2)_55%,transparent))]";

const INITIAL_ROWS = 8;
/** A win this recent gets the celebration hero. */
const RECENT_DAYS = 7;

type TimelineEntry =
  | { kind: "pr"; t: number; pr: PrEvent }
  | { kind: "milestone"; t: number; milestone: TrainingMilestone };

function interleave(
  prEvents: readonly PrEvent[],
  milestones: readonly TrainingMilestone[]
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...prEvents.map((pr) => ({
      kind: "pr" as const,
      t: new Date(pr.performedAt).getTime(),
      pr,
    })),
    ...milestones.map((milestone) => ({
      kind: "milestone" as const,
      t: new Date(milestone.achievedAt).getTime(),
      milestone,
    })),
  ];
  return entries.sort((a, b) => b.t - a.t);
}

/* Row grammar (member-copy-writer W3, canon 04 §129-130): in the list the
 * exercise name IS the headline - the section header and per-row "beat X lb"
 * already say "record", so a repeated "New record:" prefix burns both scan
 * words on every row. The celebration hero keeps the prefix: there it is
 * the news, and the aria-live announcement needs the event framing. */
function prHeadline(pr: PrEvent): string {
  return pr.exerciseName;
}

function prHeroHeadline(pr: PrEvent): string {
  return `New record: ${pr.exerciseName}`;
}

function prDetail(pr: PrEvent): string {
  const set = `${pr.weight} ${pr.unit}${pr.reps != null ? ` × ${pr.reps}` : ""}`;
  if (pr.beatWeight && pr.previousWeightLb > 0) {
    return `${set} · beat ${pr.previousWeightLb} lb`;
  }
  if (pr.beatE1rm && pr.e1rmLb != null) {
    return `${set} · est. 1RM ${pr.e1rmLb} lb, beat ${pr.previousE1rmLb} lb`;
  }
  // The words, not the trophy icon, must say this is a record (a11y;
  // member-copy-writer W3).
  return `${set} · personal best`;
}

export function RewardsTimeline({
  prEvents,
  milestones,
  nextMilestone,
  todayMs,
  rangeLabel,
  totalPrEvents,
}: {
  /** Record events inside the selected window, newest first. */
  prEvents: readonly PrEvent[];
  /** All reached milestones, newest first (milestones are not windowed:
   *  a trophy case keeps its history). */
  milestones: readonly TrainingMilestone[];
  nextMilestone: { threshold: number; remaining: number } | null;
  todayMs: number;
  rangeLabel: string;
  /** All-time record count (for the "records in range" honesty note). */
  totalPrEvents: number;
}) {
  const [expanded, setExpanded] = useState(false);

  const entries = interleave(prEvents, milestones);
  const newest = entries[0];
  const heroRecent =
    newest != null && todayMs - newest.t <= RECENT_DAYS * MS_PER_DAY;
  const listed = heroRecent ? entries.slice(1) : entries;
  const visible = expanded ? listed : listed.slice(0, INITIAL_ROWS);

  return (
    <section className="min-w-0">
      {/* Zone header on the shared grammar (06 #15/#16: one header style per
          level, quiet, no icon decoration 04 §6 #77); wraps instead of
          clipping at 320-384 (07 #50; burns the smoke clipped-text pin). */}
      {/* Measure-capped column (audit F-11; 07 #23: width buys margin for
          reading; a record and its date must share one eye span). */}
      <div className="mb-3 flex max-w-2xl flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-card-title text-muted-foreground">
          <span>Record and milestone timeline</span>
          <KpiHelp label="Record and milestone timeline">
            Every set that beat one of your records and every training
            milestone you have reached, in the order they happened. All of it
            is earned: entries come straight from your logged workouts (your
            full history counts from day one), and each one links to the
            workout behind it.
          </KpiHelp>
        </h2>
        <span className="text-muted-foreground text-xs">
          {prEvents.length} record {prEvents.length === 1 ? "set" : "sets"}{" "}
          {inRange(rangeLabel)}
          {totalPrEvents > prEvents.length
            ? ` · ${totalPrEvents} all time`
            : ""}
        </span>
      </div>

      {/* The celebration hero: only for a genuinely recent win. */}
      {heroRecent && newest && (
        <CelebrationHero entry={newest} todayMs={todayMs} />
      )}

      {entries.length === 0 ? (
        /* Designed empty in the rows' position, uncontained like every
           sibling zone state (01 #66/#73; 05 #68). */
        <div className="flex min-h-36 flex-col items-center justify-center gap-2 px-6 py-8 text-center">
          <Trophy aria-hidden className="size-5 text-muted-foreground" />
          <p className="max-w-md text-body text-muted-foreground">
            {totalPrEvents > 0
              ? `No records ${inRange(rangeLabel)}. Widen the range to see your full trophy wall.`
              : "Beat a personal best or reach a training milestone and it lands here, permanently."}
          </p>
          {nextMilestone && (
            <p className="text-meta text-muted-foreground">
              Next up: your {ordinalLabel(nextMilestone.threshold)} workout,{" "}
              {nextMilestone.remaining} to go.
            </p>
          )}
        </div>
      ) : (
        <ol className="relative flex max-w-2xl list-none flex-col">
          {visible.map((entry, i) => (
            <TimelineRow
              entry={entry}
              isLast={i === visible.length - 1 && listed.length <= visible.length}
              key={`${entryKey(entry)}-${i}`}
            />
          ))}
          {listed.length > INITIAL_ROWS && !expanded && (
            <li className="mt-2 ml-9 list-none">
              <Button
                className="pointer-coarse:min-h-11"
                onClick={() => setExpanded(true)}
                size="sm"
                variant="outline"
              >
                Show all {listed.length}
              </Button>
            </li>
          )}
        </ol>
      )}
    </section>
  );
}

function entryKey(e: TimelineEntry): string {
  return e.kind === "pr"
    ? `pr-${e.pr.workoutId}-${e.pr.exerciseName}-${e.pr.weightLb}-${e.pr.e1rmLb ?? 0}`
    : `ms-${e.milestone.id}`;
}

function TimelineRow({
  entry,
  isLast,
}: {
  entry: TimelineEntry;
  isLast: boolean;
}) {
  const isPr = entry.kind === "pr";
  const href = isPr
    ? `/workouts/history/${entry.pr.workoutId}`
    : entry.kind === "milestone" && entry.milestone.workoutId
      ? `/workouts/history/${entry.milestone.workoutId}`
      : null;

  const icon = isPr ? (
    <Trophy aria-hidden className={`size-4 text-amber-500 ${GOLD_GLOW}`} />
  ) : (
    <Flag
      aria-hidden
      className={`size-4 text-emerald-600 dark:text-emerald-400 ${EMERALD_GLOW}`}
    />
  );

  const headline = isPr
    ? prHeadline(entry.pr)
    : (entry as Extract<TimelineEntry, { kind: "milestone" }>).milestone.label;
  const detail = isPr
    ? prDetail(entry.pr)
    : (entry as Extract<TimelineEntry, { kind: "milestone" }>).milestone.detail;

  const body = (
    <>
      <span
        className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border ${
          isPr
            ? "border-amber-500/30 bg-amber-500/10"
            : "border-emerald-500/30 bg-emerald-500/10"
        }`}
      >
        {icon}
      </span>
      {/* Stable row anatomy (audit F-5; 08 #34-38): identity top-left,
          detail always directly beneath it, date in one trailing slot --
          never a wrap-dependent position. */}
      <span className="flex min-w-0 flex-1 items-start justify-between gap-x-4 py-1.5">
        <span className="min-w-0">
          <span className="block font-medium text-sm">{headline}</span>
          {detail && (
            <span className="block text-muted-foreground text-xs tabular-nums">
              {detail}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex shrink-0 items-center gap-1 text-muted-foreground text-xs tabular-nums">
          {formatShortDate(entry.t)}
          {href && <ArrowUpRight aria-hidden className="size-3.5" />}
        </span>
      </span>
    </>
  );

  return (
    <li className="relative flex items-center gap-3">
      {/* The connecting spine, behind the icon chips. */}
      {!isLast && (
        <span
          aria-hidden
          className="absolute top-8 left-4 h-full w-px bg-border"
        />
      )}
      {href ? (
        <Link
          className="flex min-h-11 w-full items-center gap-3 rounded-lg px-1 transition-colors hover:bg-muted/40"
          href={href}
        >
          {body}
        </Link>
      ) : (
        <span className="flex min-h-11 w-full items-center gap-3 px-1">
          {body}
        </span>
      )}
    </li>
  );
}

/**
 * The recent-win hero: the newest record/milestone, celebrated. The scene
 * flourish is honest (a real event, dated), deferred (never first-load JS), and
 * reduced-motion-safe (celebration-scene.tsx renders the static treatment).
 * No sound and no haptics fire on page load (nothing starts uninvited);
 * those stay tied to the explicit save action in the logger.
 */
function CelebrationHero({
  entry,
  todayMs,
}: {
  entry: TimelineEntry;
  todayMs: number;
}) {
  const isPr = entry.kind === "pr";
  /* The hero keeps the event framing the list rows drop ("New record:" /
     "Milestone reached:"): it appears once, and it is what the aria-live
     region announces (member-copy-writer W3). */
  const headline = isPr
    ? prHeroHeadline(entry.pr)
    : `Milestone reached: ${(entry as Extract<TimelineEntry, { kind: "milestone" }>).milestone.label}`;
  const detail = isPr
    ? prDetail(entry.pr)
    : (entry as Extract<TimelineEntry, { kind: "milestone" }>).milestone.detail;
  const href = isPr
    ? `/workouts/history/${entry.pr.workoutId}`
    : (entry as Extract<TimelineEntry, { kind: "milestone" }>).milestone
          .workoutId
      ? `/workouts/history/${(entry as Extract<TimelineEntry, { kind: "milestone" }>).milestone.workoutId}`
      : null;
  const daysAgo = Math.max(0, Math.round((todayMs - entry.t) / MS_PER_DAY));

  return (
    /* UNCONTAINED celebration moment (W3 composition audit F-4): the hero
       is the timeline's own newest entry promoted, so no earning test holds
       (01 #41: the app quoting its own stats earns nothing). The newest-win
       difference is carried by scale, gold, and a soft glow whose wash and
       WebGL flourish fade to nothing before their box edges, so no boundary
       rectangle exists (06 #24). */
    <div className="relative mb-4 max-w-2xl">
      {/* Deferred WebGL flourish behind the words; static gradient fallback.
          Masked to fade out before the edges. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          maskImage:
            "radial-gradient(130% 150% at 15% 50%, black 35%, transparent 92%)",
          WebkitMaskImage:
            "radial-gradient(130% 150% at 15% 50%, black 35%, transparent 92%)",
        }}
      >
        <CelebrationScene className="h-full w-full" />
      </div>
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 140% at 0% 50%, ${REWARD_GOLD_WASH}, transparent 70%)`,
        }}
      />
      <div className="relative flex min-h-28 flex-wrap items-center gap-x-6 gap-y-3 py-5 md:min-h-32 md:py-6">
        <span
          className={`flex size-12 shrink-0 items-center justify-center rounded-full border ${
            isPr
              ? "border-amber-500/40 bg-amber-500/15"
              : "border-emerald-500/40 bg-emerald-500/15"
          }`}
        >
          {isPr ? (
            <Trophy aria-hidden className={`size-6 text-amber-500 ${GOLD_GLOW}`} />
          ) : (
            <Flag
              aria-hidden
              className={`size-6 text-emerald-600 dark:text-emerald-400 ${EMERALD_GLOW}`}
            />
          )}
        </span>
        <div className="min-w-0 flex-1 basis-52">
          {/* The words carry the win; assistive tech hears it too. */}
          <p aria-live="polite" className="font-semibold text-lg leading-tight">
            {headline}
          </p>
          <p className="mt-0.5 text-muted-foreground text-sm">
            {detail ? `${detail} · ` : ""}
            {daysAgo === 0
              ? "today"
              : daysAgo === 1
                ? "yesterday"
                : `${daysAgo} days ago`}
          </p>
        </div>
        {href && (
          <Button
            asChild
            className="pointer-coarse:min-h-11"
            size="sm"
            variant="outline"
          >
            <Link href={href}>
              View the workout
              <ArrowUpRight aria-hidden className="size-3.5" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

/** "in the last 30 days" / "all time" (never "in the all time"). */
function inRange(rangeLabel: string): string {
  return rangeLabel === "all time" ? "all time" : `in the ${rangeLabel}`;
}

function ordinalLabel(n: number): string {
  const tail = n % 100;
  if (tail >= 11 && tail <= 13) {
    return `${n}th`;
  }
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}
