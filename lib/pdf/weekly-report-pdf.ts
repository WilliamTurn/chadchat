import type { jsPDF as JsPdf } from "jspdf";
import type { WeeklyReportContent } from "@/lib/reports/content";

// A clean, dependency-light text PDF of a weekly coach's report (FEAT-12) —
// the takeaway copy of what Chad wrote: headline, review sections, next week's
// adjustments with reasons, bottom line. One-click client-side download.
//
// jspdf is imported lazily (dynamic import inside the handler) so its browser-
// only bundle never enters the SSR graph. Mirrors lib/pdf/goal-pdf.ts.

const MARGIN = 56; // ~0.78in
const LINE_HEIGHT = 16;
const BLOOD: [number, number, number] = [164, 22, 26];
const INK: [number, number, number] = [20, 20, 20];
const MUTED: [number, number, number] = [110, 110, 110];

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
      .slice(0, 60) || "weekly-report"
  );
}

export async function downloadWeeklyReportPdf({
  content,
  dateLabel,
}: {
  content: WeeklyReportContent;
  dateLabel: string;
}): Promise<void> {
  const doc = await newDoc();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - MARGIN * 2;
  let y = MARGIN;

  const writeLines = (lines: string[]) => {
    for (const line of lines) {
      if (y > pageHeight - MARGIN) {
        doc.addPage();
        y = LINE_HEIGHT + MARGIN;
      }
      doc.text(line, MARGIN, y);
      y += LINE_HEIGHT;
    }
  };

  const writeParagraphs = (text: string) => {
    for (const para of text.split(/\n/)) {
      if (para.trim() === "") {
        y += LINE_HEIGHT * 0.6;
        continue;
      }
      writeLines(doc.splitTextToSize(para, maxWidth));
    }
  };

  // Brand line.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BLOOD);
  doc.text(`CHAD — WEEKLY REPORT · ${dateLabel.toUpperCase()}`, MARGIN, y);
  y += LINE_HEIGHT * 1.6;

  // Headline.
  doc.setTextColor(...INK);
  doc.setFontSize(20);
  writeLines(doc.splitTextToSize(content.headline, maxWidth));
  y += 8;

  // Intro.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  writeParagraphs(content.intro);
  y += 8;

  // Review sections.
  for (const section of content.sections) {
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...INK);
    writeLines([section.title]);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    writeParagraphs(section.body);
  }

  // Adjustments.
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BLOOD);
  writeLines(["NEXT WEEK'S ADJUSTMENTS"]);
  for (const a of content.adjustments) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    writeLines(doc.splitTextToSize(`• ${a.change}`, maxWidth));
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED);
    writeLines(doc.splitTextToSize(`   Why: ${a.reason}`, maxWidth));
    y += 4;
  }

  // Bottom line.
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  writeParagraphs(content.bottomLine);

  // Footer on the last page.
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text("Built with Chad — your AI coach.", MARGIN, pageHeight - 32);

  doc.save(`chad-weekly-report-${safeFileName(dateLabel)}.pdf`);
}
