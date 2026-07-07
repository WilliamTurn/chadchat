"use client";

import { Download, MessageSquare, Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { RoastShareDialog } from "@/components/share/roast-share-dialog";
import { Button } from "@/components/ui/button";
import { downloadWeeklyReportPdf } from "@/lib/pdf/weekly-report-pdf";
import type { WeeklyReportContent } from "@/lib/reports/content";

/** Download a weekly report as a PDF, take it into chat with Chad, or turn
 * its best burn into a share card (FEAT-24). */
export function ReportActions({
  content,
  dateLabel,
}: {
  content: WeeklyReportContent;
  dateLabel: string;
}) {
  const discussPrompt = `I read my weekly report — "${content.headline}". Let's talk about it: `;
  const [roastOpen, setRoastOpen] = useState(false);

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
      <Button
        className="gap-1.5"
        onClick={() => setRoastOpen(true)}
        size="sm"
        variant="outline"
      >
        <Share2 className="size-3.5" />
        Share a line
      </Button>
      {/* Pre-filled with the report's bottom line — the burn people post. */}
      <RoastShareDialog
        initialText={content.bottomLine}
        onOpenChange={setRoastOpen}
        open={roastOpen}
      />
    </div>
  );
}
