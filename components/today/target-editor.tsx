"use client";

import { Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveNutritionTarget } from "@/app/nutrition/actions";
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

export function TargetEditor({
  calories,
  protein,
}: {
  calories: number | null;
  protein: number | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [cal, setCal] = useState(calories?.toString() ?? "");
  const [pro, setPro] = useState(protein?.toString() ?? "");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const calNum = cal.trim() ? Math.round(Number(cal)) : null;
    const proNum = pro.trim() ? Math.round(Number(pro)) : null;
    if (
      (calNum != null && (Number.isNaN(calNum) || calNum <= 0)) ||
      (proNum != null && (Number.isNaN(proNum) || proNum <= 0))
    ) {
      toast.error("Enter sensible numbers.");
      return;
    }

    startTransition(async () => {
      const result = await saveNutritionTarget({
        calories: calNum,
        protein: proNum,
      });
      if (result.ok) {
        toast.success("Targets saved.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't save targets.");
      }
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="gap-1.5 text-xs" size="sm" variant="ghost">
          <Settings2 className="size-3.5" />
          {calories || protein ? "Edit targets" : "Set targets"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Daily targets</DialogTitle>
          <DialogDescription>
            Set your daily calorie and protein goals. Your fuel rings fill toward
            these. Not sure? Ask Chad.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="t-cal">Calories (kcal)</Label>
            <Input
              id="t-cal"
              inputMode="numeric"
              onChange={(e) => setCal(e.target.value)}
              placeholder="e.g. 2400"
              value={cal}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="t-pro">Protein (g)</Label>
            <Input
              id="t-pro"
              inputMode="numeric"
              onChange={(e) => setPro(e.target.value)}
              placeholder="e.g. 180"
              value={pro}
            />
          </div>
          <DialogFooter>
            <Button disabled={pending} type="submit">
              {pending ? "Saving…" : "Save targets"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
