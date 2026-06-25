"use client";

import { Download, MessageSquare, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { removeGoal } from "@/app/today/actions";
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
import { downloadGoalPdf } from "@/lib/pdf/goal-pdf";
import type { EditableGoal } from "./goal-editor";

/** Read the full goal, download it as a PDF, discuss it with Chad, or delete it. */
export function GoalViewer({ goal }: { goal: EditableGoal }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const discussPrompt = `Let's review my goal: "${goal.title}". Where am I at, and what should I be doing right now to hit it?`;

  function onDelete() {
    startTransition(async () => {
      const result = await removeGoal(goal.id);
      if (result.ok) {
        toast.success("Goal deleted.");
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
          View
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{goal.title}</DialogTitle>
          <DialogDescription>
            {goal.targetDate ? `Target: ${goal.targetDate}` : "Your goal."}
          </DialogDescription>
        </DialogHeader>
        <div className="whitespace-pre-line text-sm leading-relaxed">
          {goal.detail.trim() || "No details written yet. Hit edit to add them."}
        </div>
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
                downloadGoalPdf(goal).catch(() =>
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
