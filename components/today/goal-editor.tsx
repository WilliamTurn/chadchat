"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveGoalRecord, updateGoalRecord } from "@/app/today/actions";
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

export type EditableGoal = {
  id: string;
  title: string;
  detail: string;
  targetDate: string | null;
  status: "active" | "achieved" | "archived";
  metric: "weight" | "bodyfat" | "measurement" | "custom" | null;
  startValue: number | null;
  targetValue: number | null;
  unit: string | null;
};

const NONE = "none";

function numOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) {
    return null;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Create or edit a structured goal. "create" shows an Add button / CTA; "edit"
 * shows a pencil and is prefilled from the goal.
 */
export function GoalEditor({
  goal,
  variant = "icon",
}: {
  goal?: EditableGoal;
  /** "icon" = pencil (edit); "cta" = full button (empty state); "add" = small + (has goals). */
  variant?: "icon" | "cta" | "add";
}) {
  const router = useRouter();
  const isEdit = Boolean(goal);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(goal?.title ?? "");
  const [detail, setDetail] = useState(goal?.detail ?? "");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  const [status, setStatus] = useState<EditableGoal["status"]>(
    goal?.status ?? "active"
  );
  const [metric, setMetric] = useState<string>(goal?.metric ?? NONE);
  const [startValue, setStartValue] = useState(
    goal?.startValue != null ? String(goal.startValue) : ""
  );
  const [targetValue, setTargetValue] = useState(
    goal?.targetValue != null ? String(goal.targetValue) : ""
  );
  const [unit, setUnit] = useState(goal?.unit ?? "");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Give your goal a title.");
      return;
    }
    const hasMetric = metric !== NONE;
    const payload = {
      title: title.trim(),
      detail: detail.trim(),
      targetDate: targetDate.trim() || null,
      status,
      metric: hasMetric ? (metric as EditableGoal["metric"]) : null,
      startValue: hasMetric ? numOrNull(startValue) : null,
      targetValue: hasMetric ? numOrNull(targetValue) : null,
      unit: hasMetric ? unit.trim() || null : null,
    };
    startTransition(async () => {
      const result =
        isEdit && goal
          ? await updateGoalRecord({ id: goal.id, ...payload })
          : await saveGoalRecord(payload);
      if (result.ok) {
        toast.success(isEdit ? "Goal updated." : "Goal saved.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't save your goal.");
      }
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        {variant === "cta" ? (
          <Button className="gap-1.5" size="sm" variant="outline">
            <Plus className="size-3.5" />
            Set your goal
          </Button>
        ) : variant === "add" ? (
          <Button className="gap-1.5" size="sm" variant="ghost">
            <Plus className="size-3.5" />
            Add
          </Button>
        ) : (
          <Button
            aria-label="Edit goal"
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
          <DialogTitle>{isEdit ? "Edit goal" : "New goal"}</DialogTitle>
          <DialogDescription>
            Write the real thing — what you're chasing and why. Chad sees this in
            every chat and holds you to it.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="g-title">Goal</Label>
            <Input
              id="g-title"
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Lose 20 lb and see abs"
              value={title}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="g-detail">Details (optional)</Label>
            <Textarea
              className="min-h-28"
              id="g-detail"
              onChange={(e) => setDetail(e.target.value)}
              placeholder="The full picture — your why, the deadline, how you'll measure it."
              value={detail}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="g-target">Target date (optional)</Label>
              <Input
                id="g-target"
                onChange={(e) => setTargetDate(e.target.value)}
                placeholder="e.g. By September"
                value={targetDate}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="g-status">Status</Label>
              <Select
                onValueChange={(v) => setStatus(v as EditableGoal["status"])}
                value={status}
              >
                <SelectTrigger id="g-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="achieved">Achieved</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <Label htmlFor="g-metric">Measurable target (optional)</Label>
            <p className="text-muted-foreground text-xs">
              Pin a number to track live progress on the dashboard.
            </p>
            <Select onValueChange={setMetric} value={metric}>
              <SelectTrigger id="g-metric">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No number — just a goal</SelectItem>
                <SelectItem value="weight">Bodyweight</SelectItem>
                <SelectItem value="bodyfat">Body fat %</SelectItem>
                <SelectItem value="measurement">A measurement</SelectItem>
                <SelectItem value="custom">Something else</SelectItem>
              </SelectContent>
            </Select>
            {metric !== NONE && (
              <div className="grid grid-cols-3 gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs" htmlFor="g-start">
                    Start
                  </Label>
                  <Input
                    id="g-start"
                    inputMode="decimal"
                    onChange={(e) => setStartValue(e.target.value)}
                    placeholder="200"
                    value={startValue}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs" htmlFor="g-targetval">
                    Target
                  </Label>
                  <Input
                    id="g-targetval"
                    inputMode="decimal"
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="180"
                    value={targetValue}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs" htmlFor="g-unit">
                    Unit
                  </Label>
                  <Input
                    id="g-unit"
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="lb"
                    value={unit}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button disabled={pending} type="submit">
              {pending ? "Saving…" : isEdit ? "Save changes" : "Save goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
