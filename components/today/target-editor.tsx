"use client";

import { Settings2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveNutritionTarget } from "@/app/nutrition/actions";
import { SegmentedPicker } from "@/components/meal-plan/segmented-picker";
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
  gramsFromSplit,
  reconcileTarget,
  splitFromGrams,
  type TargetSplit,
} from "@/lib/nutrition/target-math";
import { cn } from "@/lib/utils";

/**
 * R2-3: calories and macros are one equation (protein/carbs 4 kcal per g,
 * fat 9), so the editor reconciles them instead of accepting any four numbers.
 * Two modes, the same pair the leading trackers offer:
 *  - Grams: enter grams, a live line shows what they add up to vs the calorie
 *    target. Falling short warns; exceeding the target blocks the save.
 *  - Percent split: enter calories + a P/C/F split that must total 100%; the
 *    grams are derived live and saved.
 */

type Mode = "grams" | "percent";

/** Fallback split for the percent tab when no grams exist yet (30P/40C/30F,
 *  a standard balanced starting point). */
const DEFAULT_SPLIT: TargetSplit = { protein: 30, carbs: 40, fat: 30 };

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
  const [mode, setMode] = useState<Mode>("grams");

  // Grams mode fields
  const [cal, setCal] = useState(calories?.toString() ?? "");
  const [pro, setPro] = useState(protein?.toString() ?? "");
  const [carb, setCarb] = useState(carbs?.toString() ?? "");
  const [fatG, setFatG] = useState(fat?.toString() ?? "");

  // Percent mode fields, seeded from the saved grams when they exist
  const seed = splitFromGrams({ protein, carbs, fat }) ?? DEFAULT_SPLIT;
  const [pctPro, setPctPro] = useState(seed.protein.toString());
  const [pctCarb, setPctCarb] = useState(seed.carbs.toString());
  const [pctFat, setPctFat] = useState(seed.fat.toString());

  // Live reconciliation for grams mode. "bad" fields read as unset here; the
  // submit handler rejects them with a message before anything saves.
  const verdict = useMemo(() => {
    const num = (v: number | null | "bad") => (v === "bad" ? null : v);
    return reconcileTarget(num(parseField(cal)), {
      protein: num(parseField(pro)),
      carbs: num(parseField(carb)),
      fat: num(parseField(fatG)),
    });
  }, [cal, pro, carb, fatG]);

  // Live derived grams for percent mode
  const pct = {
    protein: Number(pctPro) || 0,
    carbs: Number(pctCarb) || 0,
    fat: Number(pctFat) || 0,
  };
  const pctTotal = pct.protein + pct.carbs + pct.fat;
  const pctCalories = parseField(cal);
  const derived =
    typeof pctCalories === "number" && pctTotal === 100
      ? gramsFromSplit(pctCalories, pct)
      : null;

  function save(input: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
  }) {
    startTransition(async () => {
      const result = await saveNutritionTarget(input);
      if (result.ok) {
        toast.success("Targets saved.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't save targets.");
      }
    });
  }

  function onSubmitGrams(e: FormEvent) {
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
    if (verdict.kind === "impossible") {
      toast.error(
        `Those macros alone add up to ${verdict.macroCal.toLocaleString()} calories, more than your ${calNum?.toLocaleString()} calorie target. Raise the calories or lower the macros.`
      );
      return;
    }
    save({ calories: calNum, protein: proNum, carbs: carbNum, fat: fatNum });
  }

  function onSubmitPercent(e: FormEvent) {
    e.preventDefault();
    const calNum = parseField(cal);
    if (calNum === "bad" || calNum == null) {
      toast.error("Enter a calorie target first.");
      return;
    }
    if (pctTotal !== 100) {
      toast.error(`Your split totals ${pctTotal}%. It has to total 100%.`);
      return;
    }
    const g = gramsFromSplit(calNum, pct);
    save({ calories: calNum, protein: g.protein, carbs: g.carbs, fat: g.fat });
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
            Set your daily calorie and macro goals. Protein and carbs are 4
            calories per gram, fat is 9, so the numbers have to add up. Not
            sure what to aim for?{" "}
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

        <SegmentedPicker
          ariaLabel="Target entry mode"
          onChange={setMode}
          options={[
            { value: "grams", label: "Grams" },
            { value: "percent", label: "Percent split" },
          ]}
          value={mode}
        />

        {mode === "grams" ? (
          <form className="flex flex-col gap-4" onSubmit={onSubmitGrams}>
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

            <ReconcileLine
              onUseMacroCal={(n) => setCal(String(n))}
              verdict={verdict}
            />

            <DialogFooter>
              <Button
                disabled={pending || verdict.kind === "impossible"}
                type="submit"
              >
                {pending ? "Saving…" : "Save targets"}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={onSubmitPercent}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="t-cal-pct">Calories</Label>
              <Input
                id="t-cal-pct"
                inputMode="numeric"
                onChange={(e) => setCal(e.target.value)}
                placeholder="e.g. 2400"
                value={cal}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <PercentField
                derivedGrams={derived?.protein}
                id="t-pct-pro"
                label="Protein"
                onChange={setPctPro}
                value={pctPro}
              />
              <PercentField
                derivedGrams={derived?.carbs}
                id="t-pct-carb"
                label="Carbs"
                onChange={setPctCarb}
                value={pctCarb}
              />
              <PercentField
                derivedGrams={derived?.fat}
                id="t-pct-fat"
                label="Fat"
                onChange={setPctFat}
                value={pctFat}
              />
            </div>

            <p
              className={cn(
                "text-sm",
                pctTotal === 100
                  ? "text-muted-foreground"
                  : "text-amber-600 dark:text-amber-500"
              )}
            >
              {pctTotal === 100
                ? "Your split totals 100%."
                : `Your split totals ${pctTotal}%. It has to total 100%.`}
            </p>

            <DialogFooter>
              <Button
                disabled={pending || pctTotal !== 100 || !derived}
                type="submit"
              >
                {pending ? "Saving…" : "Save targets"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The live "do these numbers add up?" line under the grams form. */
function ReconcileLine({
  verdict,
  onUseMacroCal,
}: {
  verdict: ReturnType<typeof reconcileTarget>;
  onUseMacroCal: (n: number) => void;
}) {
  if (verdict.kind === "none") {
    return null;
  }
  const macroCal = verdict.macroCal.toLocaleString();

  if (verdict.kind === "impossible") {
    return (
      <p className="text-destructive text-sm" role="alert">
        These macros alone add up to {macroCal} calories,{" "}
        {verdict.overBy.toLocaleString()} more than your calorie target. Fix
        one side, or{" "}
        <button
          className="font-medium underline underline-offset-4"
          onClick={() => onUseMacroCal(verdict.macroCal)}
          type="button"
        >
          set calories to {macroCal}
        </button>
        .
      </p>
    );
  }
  if (verdict.kind === "under") {
    return (
      <p className="text-amber-600 text-sm dark:text-amber-500">
        These macros add up to {macroCal} calories,{" "}
        {verdict.underBy.toLocaleString()} under your calorie target. That can
        be fine, or{" "}
        <button
          className="font-medium underline underline-offset-4"
          onClick={() => onUseMacroCal(verdict.macroCal)}
          type="button"
        >
          set calories to {macroCal}
        </button>
        .
      </p>
    );
  }
  if (verdict.kind === "match") {
    return (
      <p className="text-muted-foreground text-sm">
        These macros add up to {macroCal} calories. Matches your target.
      </p>
    );
  }
  // info (no calorie target) or partial (some macros blank)
  return (
    <p className="text-muted-foreground text-sm">
      {verdict.kind === "info"
        ? `These macros add up to ${macroCal} calories.`
        : `The macros you've entered account for ${macroCal} calories of your target.`}
    </p>
  );
}

function PercentField({
  id,
  label,
  value,
  onChange,
  derivedGrams,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  derivedGrams: number | undefined;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label} (%)</Label>
      <Input
        id={id}
        inputMode="numeric"
        onChange={(e) => onChange(e.target.value)}
        value={value}
      />
      <span className="text-muted-foreground text-xs">
        {derivedGrams != null ? `= ${derivedGrams} g` : " "}
      </span>
    </div>
  );
}
