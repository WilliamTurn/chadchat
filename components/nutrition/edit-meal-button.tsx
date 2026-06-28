"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { editMeal } from "@/app/nutrition/actions";
import {
  defaultMealForNow,
  MealCategoryPicker,
  parseMacro,
} from "@/components/nutrition/meal-shared";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toCalendarDayISO, todayLocalISO } from "@/lib/date";
import type { MealAnalysis } from "@/lib/db/schema";
import type { MealCategory } from "@/lib/validation/nutrition";

export function EditMealButton({ entry }: { entry: MealAnalysis }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(entry.title);
  const [meal, setMeal] = useState<MealCategory>(
    (entry.meal as MealCategory | null) ?? defaultMealForNow()
  );
  const [date, setDate] = useState(
    toCalendarDayISO(entry.recordedAt ?? entry.createdAt)
  );
  const [cal, setCal] = useState(entry.calories?.toString() ?? "");
  const [pro, setPro] = useState(entry.protein?.toString() ?? "");
  const [carb, setCarb] = useState(entry.carbs?.toString() ?? "");
  const [fatG, setFatG] = useState(entry.fat?.toString() ?? "");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Name this meal.");
      return;
    }
    const calNum = parseMacro(cal);
    const proNum = parseMacro(pro);
    const carbNum = parseMacro(carb);
    const fatNum = parseMacro(fatG);
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
      const result = await editMeal({
        id: entry.id,
        title: title.trim(),
        meal,
        recordedAt: date,
        calories: calNum,
        protein: proNum,
        carbs: carbNum,
        fat: fatNum,
      });
      if (result.ok) {
        toast.success("Updated.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't save changes.");
      }
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button
          className="size-8 text-muted-foreground"
          size="icon"
          variant="ghost"
        >
          <Pencil className="size-4" />
          <span className="sr-only">Edit meal</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit meal</DialogTitle>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={onSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="e-title">Name</Label>
            <Input
              id="e-title"
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              value={title}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground text-xs">Meal</Label>
            <MealCategoryPicker onChange={setMeal} value={meal} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="e-date">Date</Label>
            <DatePicker
              className="w-44"
              id="e-date"
              max={todayLocalISO()}
              onChange={setDate}
              value={date}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="e-cal">Calories</Label>
              <Input
                id="e-cal"
                inputMode="numeric"
                onChange={(e) => setCal(e.target.value)}
                placeholder="kcal"
                value={cal}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="e-pro">Protein</Label>
              <Input
                id="e-pro"
                inputMode="numeric"
                onChange={(e) => setPro(e.target.value)}
                placeholder="g"
                value={pro}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="e-carb">Carbs</Label>
              <Input
                id="e-carb"
                inputMode="numeric"
                onChange={(e) => setCarb(e.target.value)}
                placeholder="g"
                value={carb}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="e-fat">Fat</Label>
              <Input
                id="e-fat"
                inputMode="numeric"
                onChange={(e) => setFatG(e.target.value)}
                placeholder="g"
                value={fatG}
              />
            </div>
          </div>
          <DialogFooter>
            <Button disabled={pending} type="submit">
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
