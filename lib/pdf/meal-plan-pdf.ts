import type { jsPDF as JsPdf } from "jspdf";
import { type Macros, scaleMacros, sumMacros } from "@/lib/nutrition/macros";
import type {
  MacroTarget,
  PlanDay,
  PlanFood,
} from "@/lib/validation/meal-plan";

// A clean, dependency-light PDF of a structured meal plan: a branded cover with
// the daily target, then a day-by-day breakdown — each meal's foods with grams +
// macros, per-meal subtotals, and a day total against the target.
//
// jspdf is imported lazily (dynamic import inside the handler) so its browser-
// only bundle never enters the SSR graph. Mirrors lib/pdf/goal-pdf.ts.

const MARGIN = 56; // ~0.78in
const LINE_HEIGHT = 16;
const BLOOD: [number, number, number] = [164, 22, 26];
const INK: [number, number, number] = [20, 20, 20];
const MUTED: [number, number, number] = [110, 110, 110];

/** Live macros for a food: re-scale per-100g when present, else stored values. */
function foodMacros(food: PlanFood): Macros {
  if (food.per100g) {
    return scaleMacros(food.per100g, food.grams);
  }
  return {
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
  };
}

function macroSummary(m: Macros): string {
  return `${m.calories.toLocaleString()} cal  ${m.protein}P / ${m.carbs}C / ${m.fat}F`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function safeFileName(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "meal-plan"
  );
}

async function newDoc(): Promise<JsPdf> {
  const { jsPDF } = await import("jspdf");
  return new jsPDF({ unit: "pt", format: "letter" });
}

export async function downloadMealPlanPdf(plan: {
  title: string;
  target: MacroTarget | null;
  days: PlanDay[];
}): Promise<void> {
  const doc = await newDoc();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - MARGIN * 2;
  const rightX = pageWidth - MARGIN;
  let y = MARGIN;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  // --- Cover ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BLOOD);
  doc.text("CHAD — MEAL PLAN", MARGIN, y);
  y += LINE_HEIGHT * 1.6;

  doc.setTextColor(...INK);
  doc.setFontSize(20);
  for (const line of doc.splitTextToSize(plan.title, maxWidth) as string[]) {
    doc.text(line, MARGIN, y);
    y += LINE_HEIGHT * 1.3;
  }
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  if (plan.target?.calories != null) {
    const t = plan.target;
    doc.text(
      `Daily target: ${t.calories?.toLocaleString()} cal  ${t.protein ?? 0}P / ${t.carbs ?? 0}C / ${t.fat ?? 0}F`,
      MARGIN,
      y
    );
    y += LINE_HEIGHT;
  }
  doc.text(`Generated: ${formatDate(new Date())}`, MARGIN, y);
  y += LINE_HEIGHT * 1.6;

  // --- Days ---
  for (const day of plan.days) {
    ensureSpace(LINE_HEIGHT * 4);

    // Day header bar.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...BLOOD);
    doc.text(day.label, MARGIN, y);
    const dayTotal = sumMacros(
      day.meals.flatMap((m) => m.foods.map(foodMacros))
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(macroSummary(dayTotal), rightX, y, { align: "right" });
    y += 6;
    doc.setDrawColor(...BLOOD);
    doc.setLineWidth(0.8);
    doc.line(MARGIN, y, rightX, y);
    y += LINE_HEIGHT;

    for (const meal of day.meals) {
      ensureSpace(LINE_HEIGHT * 3);

      // Meal title + subtotal.
      const mealTotal = sumMacros(meal.foods.map(foodMacros));
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...INK);
      doc.text(meal.title, MARGIN, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(macroSummary(mealTotal), rightX, y, { align: "right" });
      y += LINE_HEIGHT;

      // Foods.
      doc.setFontSize(10);
      for (const food of meal.foods) {
        ensureSpace(LINE_HEIGHT);
        const m = foodMacros(food);
        doc.setTextColor(...INK);
        const label = `${Math.round(food.grams)}g  ${food.name}`;
        const labelLines = doc.splitTextToSize(
          label,
          maxWidth - 150
        ) as string[];
        doc.text(labelLines[0] ?? label, MARGIN + 10, y);
        doc.setTextColor(...MUTED);
        doc.text(food.per100g ? macroSummary(m) : "—", rightX, y, {
          align: "right",
        });
        y += LINE_HEIGHT;
      }
      y += 4;
    }
    y += LINE_HEIGHT * 0.5;
  }

  // Footer on the last page.
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "Built with Chad — your AI coach. Macros sourced from the USDA food database.",
    MARGIN,
    pageHeight - 32
  );

  doc.save(`chad-meal-plan-${safeFileName(plan.title)}.pdf`);
}
