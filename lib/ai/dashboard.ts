import { formatCalendarDay } from "@/lib/date";
import type { WorkoutWithChildren } from "@/lib/db/queries";
import type {
  BodyMeasurement,
  MealAnalysis,
  NutritionTarget,
  ProgressEntry,
} from "@/lib/db/schema";
import { toLb } from "@/lib/workouts/stats";

// Keep day-log payloads bounded so a "review my last 30 days" call can't bloat
// the context window.
const MAX_MEALS_IN_LOG = 40;
const MAX_WORKOUTS_IN_LOG = 14;
const MAX_EXERCISES_PER_WORKOUT_IN_LOG = 10;
const MAX_MEASUREMENTS_IN_LOG = 20;
const MAX_KITCHEN_IN_LOG = 20;

const LB_PER_KG = 2.204_62;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function round(n: number): number {
  return Math.round(n);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Effective day a meal is logged for (back-dateable), as a Date. */
function mealDay(m: MealAnalysis): Date {
  return m.recordedAt ?? m.createdAt;
}

export type MacroTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: number;
};

/** Sum a set of meals into rounded macro totals. */
export function sumMacros(meals: MealAnalysis[]): MacroTotals {
  return meals.reduce<MacroTotals>(
    (acc, m) => ({
      calories: acc.calories + (m.calories ?? 0),
      protein: acc.protein + (m.protein ?? 0),
      carbs: acc.carbs + (m.carbs ?? 0),
      fat: acc.fat + (m.fat ?? 0),
      meals: acc.meals + 1,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 }
  );
}

/** "1,450 / 2,200 kcal" when a target exists, else "1,450 kcal". */
function vsTarget(
  value: number,
  target: number | null | undefined,
  unit: string
): string {
  const v = round(value).toLocaleString();
  if (target == null) {
    return `${v} ${unit}`;
  }
  return `${v} / ${round(target).toLocaleString()} ${unit}`;
}

function macroLine(totals: MacroTotals, target?: NutritionTarget): string {
  const parts = [
    vsTarget(totals.calories, target?.calories, "kcal"),
    vsTarget(totals.protein, target?.protein, "g protein"),
    `${round(totals.carbs)}g carbs`,
    `${round(totals.fat)}g fat`,
  ];
  return parts.join(", ");
}

export type WeightSummary = {
  current: number;
  unit: "lb" | "kg";
  recordedAt: Date;
  changeSinceStart: number | null;
};

/**
 * Latest weigh-in + net change since the first one, in the unit of the most
 * recent entry. Returns null when nothing's been weighed. `entries` may be in
 * any order (we sort defensively).
 */
export function summarizeWeight(
  entries: ProgressEntry[]
): WeightSummary | null {
  const weighed = entries
    .filter((e): e is ProgressEntry & { weight: number } => e.weight != null)
    .sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  if (weighed.length === 0) {
    return null;
  }
  const latest = weighed.at(-1) as ProgressEntry & { weight: number };
  const first = weighed[0] as ProgressEntry & { weight: number };
  const unit = latest.unit;
  const toUnit = (w: number, from: "lb" | "kg") => {
    if (from === unit) {
      return w;
    }
    return unit === "lb" ? w * LB_PER_KG : w / LB_PER_KG;
  };
  const current = round1(latest.weight);
  const start = round1(toUnit(first.weight, first.unit));
  return {
    current,
    unit,
    recordedAt: latest.recordedAt,
    changeSinceStart: weighed.length > 1 ? round1(current - start) : null,
  };
}

/**
 * The always-on "today's dashboard" block injected into Chad's system prompt so
 * he has live, ambient awareness of where the client stands — without being
 * asked. Mirrors the goals/workouts blocks. Returns "" when there's nothing to
 * show (e.g. a brand-new member who hasn't logged anything).
 */
export function formatTodaySnapshot({
  date,
  meals,
  target,
  waterMl,
  weight,
  goalWeight,
  lastSleep,
}: {
  date: Date;
  meals: MealAnalysis[];
  target?: NutritionTarget;
  waterMl: number;
  weight: WeightSummary | null;
  goalWeight?: { value: number; unit: string } | null;
  lastSleep?: { minutes: number; quality: number | null; recordedAt: Date } | null;
}): string {
  const lines: string[] = [];

  const totals = sumMacros(meals);
  if (totals.meals > 0) {
    lines.push(
      `- Nutrition today: ${macroLine(totals, target)} across ${totals.meals} meal${totals.meals === 1 ? "" : "s"} logged.`
    );
  } else if (target?.calories != null || target?.protein != null) {
    lines.push(
      `- Nutrition today: nothing logged yet (target ${vsTarget(0, target?.calories, "kcal").split(" / ")[1] ?? "—"}${target?.protein != null ? `, ${target.protein}g protein` : ""}).`
    );
  }

  if (weight) {
    const change =
      weight.changeSinceStart == null
        ? ""
        : `, ${weight.changeSinceStart > 0 ? "+" : ""}${weight.changeSinceStart} ${weight.unit} since start`;
    const goal = goalWeight
      ? `; goal ${round1(goalWeight.value)} ${goalWeight.unit}`
      : "";
    lines.push(
      `- Latest weigh-in: ${weight.current} ${weight.unit} (${formatCalendarDay(weight.recordedAt)})${change}${goal}.`
    );
  }

  if (waterMl > 0) {
    lines.push(`- Water today: ${round(waterMl).toLocaleString()} ml.`);
  }

  // Sleep is logged per night; only surface it if it's recent (within ~2 days)
  // so the always-on snapshot stays "today", not stale.
  if (
    lastSleep &&
    lastSleep.recordedAt.getTime() >= date.getTime() - 2 * MS_PER_DAY
  ) {
    const h = Math.floor(lastSleep.minutes / 60);
    const m = lastSleep.minutes % 60;
    const dur = m === 0 ? `${h}h` : `${h}h ${m}m`;
    const quality =
      lastSleep.quality == null ? "" : `, quality ${lastSleep.quality}/5`;
    lines.push(
      `- Last night's sleep: ${dur}${quality} (${formatCalendarDay(lastSleep.recordedAt)}).`
    );
  }

  if (lines.length === 0) {
    return "";
  }

  return `TODAY'S DASHBOARD (${formatCalendarDay(date)}) — live data this client logged in the app. It's real; reference it and hold them to it:

${lines.join("\n")}`;
}

/** One workout rendered as a compact "Title — Ex A 3×135lb; Ex B 4×8" line. */
function formatWorkoutLine(w: WorkoutWithChildren): string {
  const exParts = w.exercises
    .slice(0, MAX_EXERCISES_PER_WORKOUT_IN_LOG)
    .map((ex) => {
      const working = ex.sets.filter(
        (s) => s.completed && s.setType !== "warmup"
      );
      if (working.length === 0) {
        return ex.exerciseName;
      }
      const top = working.reduce((a, b) =>
        toLb(b.weight ?? 0, b.unit) > toLb(a.weight ?? 0, a.unit) ? b : a
      );
      const load = top.weight == null ? "BW" : `${top.weight}${top.unit}`;
      const reps = top.reps == null ? "" : `×${top.reps}`;
      return `${ex.exerciseName} ${working.length}×(top ${load}${reps})`;
    });
  return `${w.title} — ${exParts.join("; ")}`;
}

export type DayLog = {
  range: { start: string; end: string; singleDay: boolean };
  nutrition: MacroTotals & { target: NutritionTarget | null };
  weighIns: {
    date: string;
    weight: number | null;
    unit: string;
    note: string | null;
    photoUrl: string | null;
  }[];
  workouts: { date: string; title: string; summary: string }[];
  waterMl: number;
  measurements: { date: string; kind: string; value: number; unit: string }[];
  // Fridge/pantry shots Chad graded (not eaten food) — "Rate My Kitchen".
  kitchen: {
    date: string;
    kind: string;
    title: string;
    healthScore: number | null;
  }[];
  summary: string;
};

/**
 * Assemble a structured + human-readable log of everything the client logged in
 * a calendar-day window — what Chad's getDashboard tool returns. The `summary`
 * string is the primary thing the model reads; the structured fields are there
 * if it wants exact numbers.
 */
export function buildDayLog({
  start,
  end,
  meals,
  workouts,
  weighIns,
  waterMl,
  measurements,
  kitchen,
  target,
}: {
  start: Date;
  end: Date;
  meals: MealAnalysis[];
  workouts: WorkoutWithChildren[];
  weighIns: ProgressEntry[];
  waterMl: number;
  measurements: BodyMeasurement[];
  kitchen?: MealAnalysis[];
  target?: NutritionTarget;
}): DayLog {
  // The inclusive last day is one tick before the exclusive `end`.
  const lastDay = new Date(end.getTime() - 1);
  const singleDay =
    formatCalendarDay(start, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }) ===
    formatCalendarDay(lastDay, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  const label = singleDay
    ? formatCalendarDay(start, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : `${formatCalendarDay(start)} – ${formatCalendarDay(lastDay)}`;

  const totals = sumMacros(meals);
  const cappedMeals = meals.slice(0, MAX_MEALS_IN_LOG);
  const cappedWorkouts = workouts.slice(0, MAX_WORKOUTS_IN_LOG);
  const cappedMeasurements = measurements.slice(0, MAX_MEASUREMENTS_IN_LOG);
  const cappedKitchen = (kitchen ?? []).slice(0, MAX_KITCHEN_IN_LOG);

  const sections: string[] = [`DASHBOARD — ${label}`];

  if (totals.meals > 0) {
    const mealLines = cappedMeals.map((m) => {
      const macros = [
        m.calories != null ? `${round(m.calories)} kcal` : null,
        m.protein != null ? `${round(m.protein)}g P` : null,
        m.carbs != null ? `${round(m.carbs)}g C` : null,
        m.fat != null ? `${round(m.fat)}g F` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      const when = singleDay ? "" : `${formatCalendarDay(mealDay(m))} `;
      const slot = m.meal ? `[${m.meal}] ` : "";
      return `  - ${when}${slot}${m.title}${macros ? ` (${macros})` : ""}`;
    });
    sections.push(
      `Nutrition: ${macroLine(totals, target)} — ${totals.meals} meal${totals.meals === 1 ? "" : "s"}.\n${mealLines.join("\n")}`
    );
  } else {
    sections.push("Nutrition: no meals logged.");
  }

  if (cappedWorkouts.length > 0) {
    const lines = cappedWorkouts.map((w) => {
      const when = singleDay ? "" : `${formatCalendarDay(w.performedAt)} `;
      return `  - ${when}${formatWorkoutLine(w)}`;
    });
    sections.push(`Workouts: ${cappedWorkouts.length}.\n${lines.join("\n")}`);
  } else {
    sections.push("Workouts: none logged.");
  }

  // Progress entries: weight, a progress photo, or both. Photo-only entries
  // still matter (they're a logged check-in), so surface them too.
  const loggedEntries = weighIns.filter(
    (e) => e.weight != null || e.photoUrl != null
  );
  if (loggedEntries.length > 0) {
    const lines = loggedEntries.map((e) => {
      const weight = e.weight == null ? null : `${round1(e.weight)} ${e.unit}`;
      const photo = e.photoUrl ? "progress photo" : null;
      const what = [weight, photo].filter(Boolean).join(" + ");
      return `  - ${formatCalendarDay(e.recordedAt)}: ${what}${e.note ? ` — ${e.note}` : ""}`;
    });
    sections.push(`Progress check-ins:\n${lines.join("\n")}`);
  }

  if (waterMl > 0) {
    sections.push(`Water: ${round(waterMl).toLocaleString()} ml.`);
  }

  if (cappedMeasurements.length > 0) {
    const lines = cappedMeasurements.map(
      (b) =>
        `  - ${formatCalendarDay(b.recordedAt)}: ${b.kind} ${round1(b.value)} ${b.unit}`
    );
    sections.push(`Measurements:\n${lines.join("\n")}`);
  }

  if (cappedKitchen.length > 0) {
    const lines = cappedKitchen.map((k) => {
      const when = singleDay ? "" : `${formatCalendarDay(k.createdAt)} `;
      const score = k.healthScore != null ? ` (${k.healthScore}/10)` : "";
      return `  - ${when}${k.kind}: ${k.title}${score}`;
    });
    sections.push(
      `Kitchen shots (fridge/pantry Chad graded, not eaten):\n${lines.join("\n")}`
    );
  }

  const toISO = (d: Date) => d.toISOString().slice(0, 10);

  return {
    range: { start: toISO(start), end: toISO(lastDay), singleDay },
    nutrition: { ...totals, target: target ?? null },
    weighIns: loggedEntries.map((e) => ({
      date: toISO(e.recordedAt),
      weight: e.weight,
      unit: e.unit,
      note: e.note,
      photoUrl: e.photoUrl,
    })),
    workouts: cappedWorkouts.map((w) => ({
      date: toISO(w.performedAt),
      title: w.title,
      summary: formatWorkoutLine(w),
    })),
    waterMl: round(waterMl),
    measurements: cappedMeasurements.map((b) => ({
      date: toISO(b.recordedAt),
      kind: b.kind,
      value: round1(b.value),
      unit: b.unit,
    })),
    kitchen: cappedKitchen.map((k) => ({
      date: toISO(k.createdAt),
      kind: k.kind,
      title: k.title,
      healthScore: k.healthScore,
    })),
    summary: sections.join("\n\n"),
  };
}
