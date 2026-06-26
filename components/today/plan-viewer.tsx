"use client";

import { Download, MessageSquare, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { removePlan } from "@/app/today/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { downloadPlanPdf } from "@/lib/pdf/goal-pdf";
import type { EditablePlan } from "./plan-editor";

// biome-ignore lint/suspicious/noExplicitAny: minimal mdast node shapes
type MdNode = { type: string; value?: string; children?: any[] };

/**
 * Honor the author's line breaks: turn single-newline soft breaks into hard
 * <br>. Plans are pasted/generated documents where every line matters, but
 * Markdown collapses single newlines into spaces — without this, consecutive
 * lines like "Day 3 …\nDay 4 …" run together. Markdown (lists, headings, bold)
 * still renders normally; this only affects loose lines inside a paragraph.
 */
function remarkHardBreaks() {
  const walk = (node: MdNode) => {
    if (!node || !Array.isArray(node.children)) {
      return;
    }
    const next: MdNode[] = [];
    for (const child of node.children as MdNode[]) {
      if (
        child.type === "text" &&
        typeof child.value === "string" &&
        child.value.includes("\n")
      ) {
        const parts = child.value.split("\n");
        parts.forEach((part, i) => {
          if (part) {
            next.push({ type: "text", value: part });
          }
          if (i < parts.length - 1) {
            next.push({ type: "break" });
          }
        });
      } else {
        walk(child);
        next.push(child);
      }
    }
    node.children = next;
  };
  return (tree: MdNode) => walk(tree);
}

/** Read the full plan, download it as a PDF, discuss it with Chad, or delete it. */
export function PlanViewer({ plan }: { plan: EditablePlan }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const kindLabel = plan.kind === "diet" ? "diet" : "training";
  const discussPrompt = `Let's go over my ${kindLabel} plan: "${plan.title}". Is it still right for me, and how's it going?`;

  function onDelete() {
    startTransition(async () => {
      const result = await removePlan(plan.id);
      if (result.ok) {
        toast.success("Plan deleted.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't delete that.");
      }
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="px-0 text-blood" size="sm" variant="link">
          View full plan
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">{plan.title}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Badge variant="secondary">
              {plan.kind === "diet" ? "Diet" : "Training"}
            </Badge>
            <span>Ask Chad in chat to change it.</span>
          </DialogDescription>
        </DialogHeader>
        {plan.detail.trim() ? (
          <Streamdown
            className="text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            remarkPlugins={[remarkHardBreaks]}
          >
            {plan.detail.trim()}
          </Streamdown>
        ) : (
          <p className="text-muted-foreground text-sm">
            No details written yet. Hit edit to add them.
          </p>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            className="gap-1.5 text-muted-foreground"
            disabled={pending}
            onClick={onDelete}
            size="sm"
            variant="ghost"
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button
              className="gap-1.5"
              onClick={() => {
                downloadPlanPdf(plan).catch(() =>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
