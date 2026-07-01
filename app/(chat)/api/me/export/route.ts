import Papa from "papaparse";
import { auth } from "@/app/(auth)/auth";
import {
  getMealsSince,
  getProgressEntriesByUserId,
  getWorkoutsByUserId,
} from "@/lib/db/queries";

/**
 * CSV data export (ACC-13). A member can download their own logged data as a
 * spreadsheet-friendly CSV — the "own your data" table stake a power user
 * expects, and a genuine escape hatch. One dataset per request:
 *   ?dataset=weighins | meals | workouts
 * Auth is enforced here and every query is owner-scoped, so a user can only
 * ever export their own rows.
 */

type Dataset = "weighins" | "meals" | "workouts";

function isoDay(date: Date | null): string {
  if (!date) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

function round(n: number | null | undefined): string {
  if (n == null) {
    return "";
  }
  return String(Math.round(n * 10) / 10);
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  const dataset = new URL(request.url).searchParams.get("dataset") as Dataset;

  let fields: string[];
  let rows: Record<string, string | number>[];
  if (dataset === "weighins") {
    fields = ["date", "weight", "unit", "note", "photo"];
    const entries = await getProgressEntriesByUserId(userId);
    rows = entries.map((e) => ({
      date: isoDay(e.recordedAt),
      weight: e.weight == null ? "" : round(e.weight),
      unit: e.weight == null ? "" : e.unit,
      note: e.note ?? "",
      photo: e.photoUrl ?? "",
    }));
  } else if (dataset === "meals") {
    fields = [
      "date",
      "meal",
      "title",
      "calories",
      "protein_g",
      "carbs_g",
      "fat_g",
      "source",
      "grade",
    ];
    // Everything (kind=meal) — a wide "since epoch" window is effectively "all".
    const meals = await getMealsSince(userId, new Date(0));
    rows = meals.map((m) => ({
      date: isoDay(m.recordedAt ?? m.createdAt),
      meal: m.meal ?? "",
      title: m.title,
      calories: round(m.calories),
      protein_g: round(m.protein),
      carbs_g: round(m.carbs),
      fat_g: round(m.fat),
      source: m.source,
      grade: m.healthScore ?? "",
    }));
  } else if (dataset === "workouts") {
    fields = [
      "date",
      "workout",
      "exercise",
      "muscle_group",
      "set_type",
      "weight",
      "unit",
      "reps",
      "rpe",
      "completed",
    ];
    const workouts = await getWorkoutsByUserId(userId);
    // One row per set so the CSV is flat and analyzable.
    rows = workouts.flatMap((w) =>
      w.exercises.flatMap((ex) =>
        ex.sets.map((s) => ({
          date: isoDay(w.performedAt),
          workout: w.title,
          exercise: ex.exerciseName,
          muscle_group: ex.muscleGroup ?? "",
          set_type: s.setType,
          weight: s.weight == null ? "" : round(s.weight),
          unit: s.weight == null ? "" : s.unit,
          reps: s.reps ?? "",
          rpe: s.rpe ?? "",
          completed: s.completed ? "yes" : "no",
        }))
      )
    );
  } else {
    return new Response("Unknown dataset", { status: 400 });
  }

  // Papa.unparse handles quoting/escaping; the explicit `fields` guarantees a
  // header row even when the member has no data of this type yet.
  const csv = Papa.unparse({ fields, data: rows });
  const filename = `chad-${dataset}-${isoDay(new Date())}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
