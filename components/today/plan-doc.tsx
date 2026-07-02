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
import { remarkHardBreaks } from "@/lib/markdown/hard-breaks";
import { downloadPlanPdf } from "@/lib/pdf/goal-pdf";
import { type EditablePlan, PlanEditor } from "./plan-editor";

/**
 * The full-page plan document (R2-9): the whole training or diet plan as rich
 * markdown, with the same actions the old cramped dialog carried (edit, PDF,
 * discuss with Chad, delete). Rendered by /plans/[id].
 */
export function PlanDoc({ plan }: { plan: EditablePlan }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const kindLabel = plan.kind === "diet" ? "diet" : "training";
  const discussPrompt = `Let's go over my ${kindLabel} plan: "${plan.title}". Is it still right for me, and how's it going?`;

  function onDelete() {
    startTransition(async () => {
      const result = await removePlan(plan.id);
      if (result.ok) {
        toast.success("Plan deleted.");
        router.push("/today");
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't delete that.");
        setConfirming(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display font-semibold text-xl leading-tight">
                {plan.title}
              </h2>
              <Badge variant="secondary">
                {plan.kind === "diet" ? "Diet" : "Training"}
              </Badge>
              {plan.status !== "active" && (
                <Badge variant="secondary">{plan.status}</Badge>
              )}
            </div>
            <p className="mt-1 text-muted-foreground text-sm">
              Ask Chad in chat to change it, or edit it here.
            </p>
          </div>
          <PlanEditor plan={plan} variant="button" />
        </div>

        <div className="mt-5">
          {plan.detail.trim() ? (
            <Streamdown
              className="text-sm leading-relaxed [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
              remarkPlugins={[remarkHardBreaks]}
            >
              {plan.detail.trim()}
            </Streamdown>
          ) : (
            <p className="text-muted-foreground text-sm">
              No details written yet. Hit Edit to add the full plan.
            </p>
          )}
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
              {pending ? "Deleting…" : "Delete plan"}
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
            className="gap-1.5 text-muted-foreground"
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
      </div>
    </div>
  );
}
