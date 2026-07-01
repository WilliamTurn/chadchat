"use client";

import { Download, MessageSquare } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadWeeklyReportPdf } from "@/lib/pdf/weekly-report-pdf";
import type { WeeklyReportContent } from "@/lib/reports/content";

/** Download a weekly report as a PDF, or take it into chat with Chad. */
export function ReportActions({
  content,
  dateLabel,
}: {
  content: WeeklyReportContent;
  dateLabel: string;
}) {
  const discussPrompt = `I read my weekly report — "${content.headline}". Let's talk about it: `;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        className="gap-1.5"
        onClick={() => {
          downloadWeeklyReportPdf({ content, dateLabel }).catch(() =>
            toast.error("Couldn't generate the PDF.")
          );
        }}
        size="sm"
        variant="outline"
      >
        <Download className="size-3.5" />
        PDF
      </Button>
      <Button asChild className="gap-1.5" size="sm">
        <Link href={`/?prompt=${encodeURIComponent(discussPrompt)}`}>
          <MessageSquare className="size-3.5" />
          Discuss with Chad
        </Link>
      </Button>
    </div>
  );
}
