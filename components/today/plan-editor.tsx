"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { savePlanRecord, updatePlanRecord } from "@/app/today/actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type EditablePlan = {
  id: string;
  title: string;
  detail: string;
  kind: "training" | "diet";
  status: "active" | "achieved" | "archived";
};

/** Create or edit a structured plan (training or diet). */
export function PlanEditor({
  plan,
  variant = "icon",
}: {
  plan?: EditablePlan;
  /** "icon" = pencil (edit); "cta" = full button (empty state); "add" = small + (has plans). */
  variant?: "icon" | "cta" | "add";
}) {
  const router = useRouter();
  const isEdit = Boolean(plan);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(plan?.title ?? "");
  const [detail, setDetail] = useState(plan?.detail ?? "");
  const [kind, setKind] = useState<EditablePlan["kind"]>(
    plan?.kind ?? "training"
  );
  const [status, setStatus] = useState<EditablePlan["status"]>(
    plan?.status ?? "active"
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Give your plan a title.");
      return;
    }
    const payload = { title: title.trim(), detail: detail.trim(), kind, status };
    startTransition(async () => {
      const result =
        isEdit && plan
          ? await updatePlanRecord({ id: plan.id, ...payload })
          : await savePlanRecord(payload);
      if (result.ok) {
        toast.success(isEdit ? "Plan updated." : "Plan saved.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't save your plan.");
      }
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        {variant === "cta" ? (
          <Button className="gap-1.5" size="sm" variant="outline">
            <Plus className="size-3.5" />
            Add a plan
          </Button>
        ) : variant === "add" ? (
          <Button className="gap-1.5" size="sm" variant="ghost">
            <Plus className="size-3.5" />
            Add
          </Button>
        ) : (
          <Button
            aria-label="Edit plan"
            className="size-7 text-muted-foreground"
            size="icon"
            variant="ghost"
          >
            <Pencil className="size-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit plan" : "New plan"}</DialogTitle>
          <DialogDescription>
            Paste or write the full plan — the whole split or diet, every day.
            Chad sees it in every chat.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-title">Title</Label>
            <Input
              id="p-title"
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 4-Day Upper/Lower Split"
              value={title}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-kind">Type</Label>
              <Select
                onValueChange={(v) => setKind(v as EditablePlan["kind"])}
                value={kind}
              >
                <SelectTrigger id="p-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="training">Training</SelectItem>
                  <SelectItem value="diet">Diet</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="p-status">Status</Label>
              <Select
                onValueChange={(v) => setStatus(v as EditablePlan["status"])}
                value={status}
              >
                <SelectTrigger id="p-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="achieved">Completed</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="p-detail">The plan</Label>
            <Textarea
              className="min-h-44"
              id="p-detail"
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Day 1 — Upper&#10;- Bench press 4×6&#10;- ..."
              value={detail}
            />
          </div>
          <DialogFooter>
            <Button disabled={pending} type="submit">
              {pending ? "Saving…" : isEdit ? "Save changes" : "Save plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
