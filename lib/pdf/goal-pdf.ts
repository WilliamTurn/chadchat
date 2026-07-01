import type { jsPDF as JsPdf } from "jspdf";

// A clean, dependency-light text PDF for a goal or plan. One-click client-side
// download — no server round-trip, no images. Shared by goals and plans.
//
// jspdf is imported lazily (dynamic import inside the handler) so its browser-
// only bundle (which pulls in a Web Worker path) never enters the SSR graph.

type PdfDoc = {
  heading: string;
  title: string;
  meta: string[];
  body: string;
};

const MARGIN = 56; // ~0.78in
const LINE_HEIGHT = 16;

function buildPdf(doc: JsPdf, { heading, title, meta, body }: PdfDoc): JsPdf {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  const writeLines = (lines: string[]) => {
    for (const line of lines) {
      if (y > pageHeight - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }
      doc.text(line, MARGIN, y);
      y += LINE_HEIGHT;
    }
  };

  // Brand line.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(180, 30, 30);
  doc.text(heading.toUpperCase(), MARGIN, y);
  y += LINE_HEIGHT * 1.6;

  // Title.
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(20);
  writeLines(doc.splitTextToSize(title, maxWidth));
  y += 6;

  // Meta lines (target, status, generated date).
  if (meta.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(110, 110, 110);
    writeLines(meta);
    y += 10;
  }

  // Body.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(30, 30, 30);
  const paragraphs = (body || "No details written yet.").split(/\n/);
  for (const para of paragraphs) {
    if (para.trim() === "") {
      y += LINE_HEIGHT * 0.6;
      continue;
    }
    writeLines(doc.splitTextToSize(para, maxWidth));
  }

  // Footer on the last page.
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text("Built with Chad — your AI coach.", MARGIN, pageHeight - 32);

  return doc;
}

async function newDoc(): Promise<JsPdf> {
  const { jsPDF } = await import("jspdf");
  return new jsPDF({ unit: "pt", format: "letter" });
}

function safeFileName(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "document"
  );
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export async function downloadGoalPdf(g: {
  title: string;
  detail: string;
  targetDate: string | null;
  status: string;
  metric: string | null;
  metricRef?: string | null;
  startValue: number | null;
  targetValue: number | null;
  unit: string | null;
}): Promise<void> {
  const meta: string[] = [];
  if (g.targetDate) {
    meta.push(`Target: ${g.targetDate}`);
  }
  if (g.metric === "lift" && g.metricRef) {
    meta.push(`Lift: ${g.metricRef} (est. 1RM)`);
  }
  if (g.metric && g.targetValue != null) {
    const start = g.startValue != null ? `${g.startValue} → ` : "";
    meta.push(`Measure: ${start}${g.targetValue}${g.unit ? ` ${g.unit}` : ""}`);
  }
  meta.push(`Status: ${g.status}`);
  meta.push(`Generated: ${formatDate(new Date())}`);

  const doc = buildPdf(await newDoc(), {
    heading: "Chad — Goal",
    title: g.title,
    meta,
    body: g.detail,
  });
  doc.save(`chad-goal-${safeFileName(g.title)}.pdf`);
}

export async function downloadPlanPdf(p: {
  title: string;
  detail: string;
  kind: string;
  status: string;
}): Promise<void> {
  const doc = buildPdf(await newDoc(), {
    heading: `Chad — ${p.kind === "diet" ? "Diet" : "Training"} Plan`,
    title: p.title,
    meta: [`Status: ${p.status}`, `Generated: ${formatDate(new Date())}`],
    body: p.detail,
  });
  doc.save(`chad-${p.kind}-plan-${safeFileName(p.title)}.pdf`);
}
