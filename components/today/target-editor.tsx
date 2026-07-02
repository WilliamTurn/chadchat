"use client";

import { Settings2 } from "lucide-react";
import Link from "next/link";
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
  carbs,
  fat,
  prominent = false,
}: {
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  /** Render a solid primary button (for the empty-state CTA) vs the default
   *  ghost text button used in card headers. */
  prominent?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [cal, setCal] = useState(calories?.toString() ?? "");
  const [pro, setPro] = useState(protein?.toString() ?? "");
  const [carb, setCarb] = useState(carbs?.toString() ?? "");
  const [fatG, setFatG] = useState(fat?.toString() ?? "");

  function parseField(raw: string): number | null | "bad" {
    if (!raw.trim()) {
      return null;
    }
    const n = Math.round(Number(raw));
    if (Number.isNaN(n) || n <= 0) {
      return "bad";
    }
    return n;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const calNum = parseField(cal);
    const proNum = parseField(pro);
    const carbNum = parseField(carb);
    const fatNum = parseField(fatG);
    if (
      calNum === "bad" ||
      proNum === "bad" ||
      carbNum === "bad" ||
      fatNum === "bad"
    ) {
      toast.error("Enter sensible numbers.");
      return;
    }

    startTransition(async () => {
      const result = await saveNutritionTarget({
        calories: calNum,
        protein: proNum,
        carbs: carbNum,
        fat: fatNum,
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

  const hasAny = calories || protein || carbs || fat;

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        {prominent ? (
          <Button className="gap-1.5" size="sm">
            <Settings2 className="size-3.5" />
            {hasAny ? "Edit targets" : "Set your targets"}
          </Button>
        ) : (
          <Button className="gap-1.5 text-xs" size="sm" variant="ghost">
            <Settings2 className="size-3.5" />
            {hasAny ? "Edit targets" : "Set targets"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Daily targets</DialogTitle>
          <DialogDescription>
            Set your daily macro goals — your fuel rings fill toward calories and
            protein. Leave a field blank to skip it. Not sure what to aim for?{" "}
            <Link
              className="text-foreground underline underline-offset-4"
              href={`/?prompt=${encodeURIComponent(
                "Help me set my daily calorie and macro targets. Ask me what you need to know, then give me exact numbers for calories, protein, carbs, and fat."
              )}`}
            >
              Ask Chad
            </Link>
            .
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="t-cal">Calories</Label>
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="t-carb">Carbs (g)</Label>
              <Input
                id="t-carb"
                inputMode="numeric"
                onChange={(e) => setCarb(e.target.value)}
                placeholder="e.g. 250"
                value={carb}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="t-fat">Fat (g)</Label>
              <Input
                id="t-fat"
                inputMode="numeric"
                onChange={(e) => setFatG(e.target.value)}
                placeholder="e.g. 70"
                value={fatG}
              />
            </div>
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
