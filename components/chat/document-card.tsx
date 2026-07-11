"use client";

import { FileText, Loader2, Pencil, Sheet, SquareCode } from "lucide-react";
import { useCallback } from "react";
import { useArtifact } from "@/hooks/use-artifact";
import { cn } from "@/lib/utils";
import type { ArtifactKind } from "./artifact";

// One compact card per document, Claude-style: icon chip + title + type
// subtitle, click opens the right-side viewer at the latest version. Edits
// re-use this same card with an "Updated" subtitle instead of stacking a
// second full-size preview in the transcript (the old duplicate-cards bug).

const KIND_LABEL: Record<string, string> = {
  text: "Document",
  code: "Script",
  sheet: "Spreadsheet",
  image: "Image",
};

const KindIcon = ({ kind }: { kind?: ArtifactKind }) => {
  if (kind === "code") {
    return <SquareCode className="size-4" />;
  }
  if (kind === "sheet") {
    return <Sheet className="size-4" />;
  }
  return <FileText className="size-4" />;
};

export function DocumentCard({
  id,
  title,
  kind,
  action = "created",
  isStreaming = false,
}: {
  id?: string;
  title?: string;
  kind?: ArtifactKind;
  action?: "created" | "updated";
  isStreaming?: boolean;
}) {
  const { setArtifact } = useArtifact();

  const handleOpen = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!id) {
        return;
      }
      const boundingBox = event.currentTarget.getBoundingClientRect();
      setArtifact((artifact) => ({
        ...artifact,
        documentId: id,
        title: title ?? artifact.title,
        kind: kind ?? artifact.kind,
        isVisible: true,
        boundingBox: {
          left: boundingBox.x,
          top: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
        },
      }));
    },
    [id, title, kind, setArtifact]
  );

  const typeLabel = KIND_LABEL[kind ?? "text"] ?? "Document";
  // "Tap" on touch screens, "Click" with a mouse (pointer-coarse variant).
  const openVerb = (
    <>
      <span className="pointer-coarse:hidden">Click to open</span>
      <span className="hidden pointer-coarse:inline">Tap to open</span>
    </>
  );
  const subtitle = isStreaming ? (
    action === "updated" ? (
      "Updating..."
    ) : (
      "Writing..."
    )
  ) : (
    <>
      {typeLabel}
      {action === "updated" ? " · Updated" : ""} · {openVerb}
    </>
  );

  return (
    <button
      className={cn(
        "flex w-full max-w-[450px] items-center gap-3 rounded-xl border border-border/50 bg-muted/40 px-4 py-3 text-left transition-colors",
        id && !isStreaming
          ? "cursor-pointer hover:border-border hover:bg-muted"
          : "cursor-default"
      )}
      data-testid="document-card"
      onClick={handleOpen}
      type="button"
    >
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border/50">
        {isStreaming ? (
          <Loader2 className="size-4 animate-spin" />
        ) : action === "updated" ? (
          <Pencil className="size-4" />
        ) : (
          <KindIcon kind={kind} />
        )}
      </div>
      <div className="flex min-w-0 flex-col">
        <div className="truncate text-sm font-medium">
          {title ?? "Untitled document"}
        </div>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </button>
  );
}
