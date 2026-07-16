import type { WeightUnit } from "@/lib/workouts/stats";
import { toLb } from "@/lib/workouts/stats";
import type { SessionExercise, SessionSet } from "./types";

// Every number the UI shows is computed here, and every screen that shows one
// also explains it in plain language:
//   Volume    = weight × reps, added up. A simple "how much work" number.
//   Est. 1RM  = the heaviest single rep a set suggests you could do,
//               using the Epley formula: weight × (1 + reps / 30).

/** 152.5 -> "152.5", 150 -> "150" */
export function formatWeight(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** 4321 -> "4,321" */
export function formatVolume(lb: number): string {
  return Math.round(lb).toLocaleString("en-US");
}

/** Seconds -> "47 min" / "1 h 12 min" (summary style). */
export function formatDurationLong(totalSeconds: number): string {
  const minutes = Math.max(1, Math.round(totalSeconds / 60));
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Seconds -> "0:47" / "12:03" / "1:02:15" (ticking clock style). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "Today", "Yesterday", "Mon, Jun 30", or "Jun 30, 2025" for older years. */
export function formatDay(ts: number, now: number = Date.now()): string {
  const d = new Date(ts);
  const today = new Date(now);
  const startOf = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOf(today) - startOf(d)) / 86_400_000);
  if (dayDiff === 0) {
    return "Today";
  }
  if (dayDiff === 1) {
    return "Yesterday";
  }
  const sameYear = d.getFullYear() === today.getFullYear();
  return d.toLocaleDateString("en-US", {
    weekday: sameYear && dayDiff < 180 ? "short" : undefined,
    month: "short",
    day: "numeric",
    year: sameYear ? undefined : "numeric",
  });
}

/** Rest seconds -> "2 min" / "90 sec" for plan labels. */
export function formatRest(seconds: number): string {
  if (seconds % 60 === 0) {
    return `${seconds / 60} min`;
  }
  return seconds < 120
    ? `${seconds} sec`
    : `${Math.floor(seconds / 60)} min ${seconds % 60} sec`;
}

/** Volume of one completed, non-warm-up set, in lb. */
function setVolumeLb(set: SessionSet, unit: WeightUnit): number {
  if (!set.completed || set.type === "warmup" || !set.weight || !set.reps) {
    return 0;
  }
  return toLb(set.weight, unit) * set.reps;
}

/** Total volume (lb) of the completed, non-warm-up sets in a live session.
 * Timed exercises are excluded, their "reps" are seconds, not reps. */
export function sessionVolumeLb(
  exercises: SessionExercise[],
  unit: WeightUnit
): number {
  let sum = 0;
  for (const ex of exercises) {
    if (ex.kind === "timed") {
      continue;
    }
    for (const set of ex.sets) {
      sum += setVolumeLb(set, unit);
    }
  }
  return sum;
}

/** A live session counts as ENGAGED once the member has pressed Play at
 * least once or completed a set. Merely entering a workout page creates a
 * session object but does not engage it — the mini bar and the "finish your
 * current workout first" guard key off engagement, never off existence
 * (charter LAW 9; flaws SYS-06/RUN-06/RUN-08). */
export function sessionEngaged(
  session: {
    timer: { running: boolean; startedAt: number | null; accumulatedMs: number };
    exercises: SessionExercise[];
  } | null
): boolean {
  if (!session) {
    return false;
  }
  const t = session.timer;
  if (t.running || t.startedAt !== null || t.accumulatedMs > 0) {
    return true;
  }
  return session.exercises.some((ex) => ex.sets.some((s) => s.completed));
}

export function sessionCompletedSets(exercises: SessionExercise[]): number {
  let n = 0;
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (s.completed) {
        n++;
      }
    }
  }
  return n;
}

/** Per-side plate loading for a barbell weight, 45 lb bar. */
export function plateMath(totalLb: number): string {
  const BAR = 45;
  if (totalLb < BAR) {
    return `Lighter than the empty bar (${BAR} lb)`;
  }
  if (totalLb === BAR) {
    return "Just the empty bar (45 lb)";
  }
  let perSide = (totalLb - BAR) / 2;
  const plates: number[] = [];
  for (const p of [45, 35, 25, 10, 5, 2.5]) {
    while (perSide >= p) {
      plates.push(p);
      perSide -= p;
    }
  }
  const list = plates.map((p) => formatWeight(p)).join(" + ");
  const note =
    perSide > 0
      ? ` (closest. ${formatWeight(perSide * 2)} lb short of exact)`
      : "";
  return plates.length > 0
    ? `45 lb bar + per side: ${list}${note}`
    : `Just the bar${note}`;
}

/** Plain-language meaning of the weight number, per equipment type. */
export function weightMeaning(
  equipment: string | null,
  kind: string,
  unit: WeightUnit
): string {
  if (kind === "timed") {
    return "Log the seconds each set lasted";
  }
  if (kind === "bodyweight") {
    return `Weight = added weight in ${unit} (0 = just your body)`;
  }
  switch (equipment) {
    case "barbell":
      return "Weight = total, bar included";
    case "dumbbell":
      return "Weight = one dumbbell";
    case "kettlebell":
      return "Weight = one kettlebell";
    case "machine":
    case "cable":
      return "Weight = the stack setting";
    default:
      return `Weight in ${unit}`;
  }
}
