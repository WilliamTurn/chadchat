"use client";

import { format } from "date-fns";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  MessageSquare,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import Papa from "papaparse";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { deleteDocumentAction } from "@/app/files/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { downloadTextFile, safeFileName } from "@/lib/files/download";
import { remarkHardBreaks } from "@/lib/markdown/hard-breaks";
import { downloadDocumentPdf } from "@/lib/pdf/goal-pdf";

// The full-page read view of one Chad-generated document (/files/[id]):
// version browsing (read-only, Claude's library pattern), copy/download,
// discuss-with-Chad, delete. Editing stays in the chat viewer.

export type DocumentVersion = {
  title: string;
  content: string;
  createdAt: string;
};

const KIND_LABEL: Record<string, string> = {
  text: "Document",
  code: "Script",
  sheet: "Spreadsheet",
  image: "Image",
};

const CATEGORY_LABEL: Record<string, string> = {
  training: "Training",
  nutrition: "Nutrition",
  recovery: "Recovery",
  progress: "Progress",
  other: "Other",
};

export function DocumentView({
  id,
  kind,
  category,
  description,
  chatId,
  versions,
}: {
  id: string;
  kind: string;
  category: string | null;
  description: string | null;
  chatId: string | null;
  versions: DocumentVersion[];
}) {
  const router = useRouter();
  const [versionIndex, setVersionIndex] = useState(versions.length - 1);
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const current = versions[versionIndex] ?? versions.at(-1);
  const isLatest = versionIndex === versions.length - 1;
  const latestTitle = versions.at(-1)?.title ?? "Document";

  const discussPrompt = `Let's go over the document you wrote me: "${latestTitle}". I have some questions.`;

  function onDelete() {
    startTransition(async () => {
      const result = await deleteDocumentAction({ id });
      if (result.ok) {
        toast.success("Document deleted.");
        router.push("/files");
        router.refresh();
      } else {
        toast.error(result.error);
        setConfirming(false);
      }
    });
  }

  function onCopy() {
    navigator.clipboard.writeText(current?.content ?? "");
    toast.success("Copied to clipboard.");
  }

  function onDownload() {
    if (!current) {
      return;
    }
    if (kind === "sheet") {
      downloadTextFile({
        filename: `${safeFileName(latestTitle)}.csv`,
        content: current.content,
        mime: "text/csv",
      });
      return;
    }
    downloadTextFile({
      filename: `${safeFileName(latestTitle)}.md`,
      content: current.content,
      mime: "text/markdown",
    });
  }

  if (!current) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display font-semibold text-xl leading-tight">
                {current.title}
              </h2>
              <Badge variant="outline">{KIND_LABEL[kind] ?? "Document"}</Badge>
              {category && CATEGORY_LABEL[category] ? (
                <Badge variant="secondary">{CATEGORY_LABEL[category]}</Badge>
              ) : null}
            </div>
            <p className="mt-1 text-muted-foreground text-sm">
              {description ??
                "Written by Chad in chat. Ask him there to change it."}
            </p>
          </div>

          {versions.length > 1 ? (
            <div className="flex items-center gap-1">
              <Button
                aria-label="View previous version"
                className="size-8 max-sm:size-11"
                disabled={versionIndex === 0}
                onClick={() => setVersionIndex((index) => index - 1)}
                size="icon"
                variant="ghost"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-muted-foreground text-xs tabular-nums">
                Version {versionIndex + 1} of {versions.length}
              </span>
              <Button
                aria-label="View next version"
                className="size-8 max-sm:size-11"
                disabled={isLatest}
                onClick={() => setVersionIndex((index) => index + 1)}
                size="icon"
                variant="ghost"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          ) : null}
        </div>

        {!isLatest && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              Viewing an older version from{" "}
              {format(new Date(current.createdAt), "MMM d, yyyy")}. To restore
              it, ask Chad in chat.
            </span>
            <Button
              onClick={() => setVersionIndex(versions.length - 1)}
              size="sm"
              variant="outline"
            >
              Back to latest
            </Button>
          </div>
        )}

        <div className="mt-5">
          <DocumentBody content={current.content} kind={kind} />
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {confirming ? (
          <div className="flex items-center gap-2">
            <Button
              disabled={pending}
              onClick={onDelete}
              size="sm"
              variant="destructive"
            >
              {pending ? "Deleting..." : "Delete document"}
            </Button>
            <Button
              disabled={pending}
              onClick={() => setConfirming(false)}
              size="sm"
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            className="gap-1.5 text-muted-foreground max-sm:h-11"
            onClick={() => setConfirming(true)}
            size="sm"
            variant="ghost"
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button
            className="gap-1.5 max-sm:h-11"
            onClick={onCopy}
            size="sm"
            variant="outline"
          >
            <Copy className="size-3.5" />
            Copy text
          </Button>
          <Button
            className="gap-1.5 max-sm:h-11"
            onClick={onDownload}
            size="sm"
            variant="outline"
          >
            <Download className="size-3.5" />
            {kind === "sheet" ? "Download CSV" : "Download"}
          </Button>
          {kind === "text" ? (
            <Button
              className="gap-1.5 max-sm:h-11"
              onClick={() => {
                downloadDocumentPdf({
                  title: latestTitle,
                  content: current.content,
                }).catch(() => toast.error("Couldn't generate the PDF."));
              }}
              size="sm"
              variant="outline"
            >
              <Download className="size-3.5" />
              PDF
            </Button>
          ) : null}
          <Button asChild className="gap-1.5 max-sm:h-11" size="sm">
            <Link
              href={
                chatId
                  ? `/chat/${chatId}`
                  : `/?prompt=${encodeURIComponent(discussPrompt)}`
              }
            >
              <MessageSquare className="size-3.5" />
              Discuss with Chad
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function DocumentBody({ kind, content }: { kind: string; content: string }) {
  if (kind === "code") {
    return (
      <div className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-4">
        <pre className="text-sm leading-relaxed">
          <code>{content}</code>
        </pre>
      </div>
    );
  }

  if (kind === "sheet") {
    return <SheetTable content={content} />;
  }

  return (
    <Streamdown
      className="text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
      // No per-block copy/download chips: they render at 25px (untappable on
      // phones) and duplicate the page's own Copy/Download buttons.
      controls={false}
      // Passing remarkPlugins REPLACES Streamdown's default list (which is
      // just remark-gfm), so gfm must be re-added or tables render as raw
      // pipe text.
      remarkPlugins={[remarkGfm, remarkHardBreaks]}
    >
      {content.trim()}
    </Streamdown>
  );
}

function SheetTable({ content }: { content: string }) {
  const rows = useMemo(() => {
    const parsed = Papa.parse<string[]>(content.trim(), {
      skipEmptyLines: true,
    });
    return parsed.data;
  }, [content]);

  if (rows.length === 0) {
    return <p className="text-muted-foreground text-sm">Empty spreadsheet.</p>;
  }

  const [header, ...body] = rows;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/50 text-left">
            {header.map((cell, index) => (
              <th
                className="whitespace-nowrap px-3 py-2 font-medium"
                key={`h-${index}-${cell}`}
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr
              className="border-b border-border/50 last:border-b-0"
              key={`r-${rowIndex}-${row[0] ?? ""}`}
            >
              {row.map((cell, cellIndex) => (
                <td className="px-3 py-2" key={`c-${rowIndex}-${cellIndex}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
