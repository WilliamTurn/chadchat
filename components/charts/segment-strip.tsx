import { cn } from "@/lib/utils";

/**
 * SEGMENT STRIP (P56-E; rule-9 new visual primitive). A horizontal row of
 * equal rounded segments, one per step of a bounded progression: rotation
 * sessions in a training plan, planned meals in a day, graded days in a
 * week. The tremor Tracker / TrainingPeaks compliance-strip language
 * (benchmark evidence: evidence-p56e/visual-hunt.md, benchmark-teardown.md),
 * hand-built on the app's semantic tokens: done = filled positive, the NEXT
 * step carries the domain accent with its reward glow, missed = critical,
 * upcoming = muted, unlogged = hollow dashed (missing is never zero).
 *
 * Deterministic, server-safe CSS only. Each segment carries its own
 * aria-label; the strip is a labeled img group, never color-only (status is
 * always in the label text).
 */

export type SegmentStatus =
  /** Completed / hit its target: filled positive. */
  | "done"
  /** The current or next step: domain accent + reward glow. */
  | "next"
  /** Logged but missed its target: critical (a genuine at-most alert). */
  | "missed"
  /** Logged, no target to grade against: soft accent. */
  | "logged"
  /** Not yet reached / upcoming: muted. */
  | "upcoming"
  /** Nothing logged where data could exist: hollow dashed, never zero. */
  | "unlogged";

export type Segment = {
  key: string | number;
  status: SegmentStatus;
  /** Full status sentence for this segment ("Day 2: Lower, done Tuesday"). */
  label: string;
};

const ACCENTS = {
  blood: "bg-blood shadow-[var(--shadow-glow-blood)]",
  emerald: "bg-positive shadow-[var(--shadow-glow-positive)]",
  amber: "bg-amber-600 shadow-[var(--shadow-glow-positive)] dark:bg-amber-400",
} as const;

const SOFT_ACCENTS = {
  blood: "bg-blood/45",
  emerald: "bg-positive/45",
  amber: "bg-amber-600/45 dark:bg-amber-400/45",
} as const;

export function SegmentStrip({
  segments,
  accent = "blood",
  label,
  className,
}: {
  segments: Segment[];
  /** Domain accent for the "next" segment's fill + glow. */
  accent?: keyof typeof ACCENTS;
  /** Accessible name for the whole strip ("Plan rotation"). */
  label: string;
  className?: string;
}) {
  if (segments.length === 0) {
    return null;
  }
  return (
    <div
      aria-label={label}
      className={cn("flex items-center gap-1.5", className)}
      role="img"
    >
      {segments.map((s) => (
        <div
          aria-label={s.label}
          className={cn(
            "h-2.5 min-w-3 flex-1 rounded-full",
            s.status === "done" && "bg-positive",
            s.status === "next" && ACCENTS[accent],
            s.status === "missed" && "bg-critical",
            s.status === "logged" && SOFT_ACCENTS[accent],
            s.status === "upcoming" && "bg-muted",
            s.status === "unlogged" &&
              "border border-border border-dashed bg-transparent"
          )}
          key={s.key}
          role="img"
          title={s.label}
        />
      ))}
    </div>
  );
}
