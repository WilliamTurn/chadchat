"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveGoal } from "@/app/today/actions";
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

export function GoalEditor({
  goal,
  deadline,
  phase,
  variant = "icon",
}: {
  goal: string | null;
  deadline: string | null;
  phase: string | null;
  /** "icon" = small edit button beside an existing goal; "cta" = full button for the empty state. */
  variant?: "icon" | "cta";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [g, setG] = useState(goal ?? "");
  const [d, setD] = useState(deadline ?? "");
  const [p, setP] = useState(phase ?? "");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!g.trim()) {
      toast.error("Tell Chad what you're chasing.");
      return;
    }
    startTransition(async () => {
      const result = await saveGoal({
        goal: g,
        deadline: d.trim() || null,
        phase: p.trim() || null,
      });
      if (result.ok) {
        toast.success("Goal saved.");
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your goal</DialogTitle>
          <DialogDescription>
            Set what you're working toward. Chad uses this to keep you
            accountable — he'll see it too.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="g-goal">Primary goal</Label>
            <Input
              id="g-goal"
              onChange={(e) => setG(e.target.value)}
              placeholder="e.g. Lose 20 lb and see abs"
              value={g}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="g-deadline">Target / deadline (optional)</Label>
            <Input
              id="g-deadline"
              onChange={(e) => setD(e.target.value)}
              placeholder="e.g. By September"
              value={d}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="g-phase">Current phase (optional)</Label>
            <Input
              id="g-phase"
              onChange={(e) => setP(e.target.value)}
              placeholder="e.g. Cutting — week 3"
              value={p}
            />
          </div>
          <DialogFooter>
            <Button disabled={pending} type="submit">
              {pending ? "Saving…" : "Save goal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
