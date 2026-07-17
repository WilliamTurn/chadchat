"use client";

import {
  Camera,
  History,
  Loader2,
  PencilLine,
  Plus,
  ScanBarcode,
  ScanLine,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { analyzeMeal, logMealManually } from "@/app/nutrition/actions";
import { useReward } from "@/components/dashboard/reward";
import { FoodSearch } from "@/components/nutrition/food-search";
import {
  defaultMealForNow,
  MealCategoryPicker,
  parseMacro,
} from "@/components/nutrition/meal-shared";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PhotoInput } from "@/components/ui/photo-input";
import { Textarea } from "@/components/ui/textarea";
import { formatCalendarDay, parseCalendarDay, todayLocalISO } from "@/lib/date";
import {
  formatMacroSummary,
  type RecentFood,
} from "@/lib/nutrition/recent-foods";
import { cn } from "@/lib/utils";
import type { MealCategory } from "@/lib/validation/nutrition";

/**
 * A single manual-macro field. The unit ("cal"/"g") is a persistent suffix
 * inside the input — not a placeholder that vanishes the moment you type — so
 * the three macro boxes never collapse into undifferentiated number fields
 * while you're filling them in (NUT-14).
 */
function MacroField({
  id,
  label,
  unit,
  value,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          className="pr-9"
          id={id}
          inputMode="numeric"
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          value={value}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground text-xs">
          {unit}
        </span>
      </div>
    </div>
  );
}

type Mode = "search" | "barcode" | "photo" | "label" | "manual" | "recent";

export function AnalyzeForm({
  recentFoods,
  initialDate,
}: {
  recentFoods: RecentFood[];
  // The diary day being viewed (BT1-3): the form's date defaults to it, so
  // logging from a past-day view lands on that day. Omitted = today.
  initialDate?: string;
}) {
  const router = useRouter();
  const reward = useReward();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  // Search-first: database search + barcode scan is the default logging path
  // (the pro-app standard, FN-1); Chad's photo analysis stays one tap away.
  const [mode, setMode] = useState<Mode>("search");
  const [loggingFood, setLoggingFood] = useState<string | null>(null);
  const [meal, setMeal] = useState<MealCategory>(defaultMealForNow());
  // The member's own name for the "Other" slot ("Post-workout shake").
  const [mealLabel, setMealLabel] = useState("");
  const [date, setDate] = useState(initialDate ?? todayLocalISO());
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // Label mode: how many of the label's servings the user ate.
  const [servings, setServings] = useState("1");
  // Manual fields
  const [title, setTitle] = useState("");
  const [cal, setCal] = useState("");
  const [pro, setPro] = useState("");
  const [carb, setCarb] = useState("");
  const [fatG, setFatG] = useState("");

  const busy = pending || uploading;

  function pick(f: File | null) {
    setFile(f);
    setPreview((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return f ? URL.createObjectURL(f) : null;
    });
  }

  function resetCommon() {
    setNote("");
    setMeal(defaultMealForNow());
    setMealLabel("");
    setDate(initialDate ?? todayLocalISO());
  }

  // "Logged for Sat, Jun 28." tacked onto the success toast whenever the meal
  // went to a day other than today, so a back-dated log is visibly confirmed
  // instead of silently vanishing from the Today view (BT1-3).
  function loggedDayNote(): string {
    if (date === todayLocalISO()) {
      return "";
    }
    const day = parseCalendarDay(date);
    return day
      ? ` Logged for ${formatCalendarDay(day, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}.`
      : "";
  }

  async function submitPhoto(kind: "meal" | "label") {
    if (!file) {
      toast.error(
        kind === "label"
          ? "Add a photo of the nutrition label first."
          : "Add a photo of your food first."
      );
      return;
    }
    let servingsNum = 1;
    if (kind === "label") {
      servingsNum = Number.parseFloat(servings);
      if (!(Number.isFinite(servingsNum) && servingsNum > 0)) {
        toast.error("How many servings did you eat?");
        return;
      }
    }
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    let photoUrl: string;
    let mediaType = "image/jpeg";
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/files/upload`,
        { method: "POST", body: fd }
      );
      if (!res.ok) {
        const { error } = await res
          .json()
          .catch(() => ({ error: "Upload failed." }));
        toast.error(error ?? "Upload failed.");
        setUploading(false);
        return;
      }
      const data = await res.json();
      photoUrl = data.url;
      mediaType = data.contentType === "image/png" ? "image/png" : "image/jpeg";
    } catch {
      toast.error("Upload failed. Try again.");
      setUploading(false);
      return;
    }
    setUploading(false);

    startTransition(async () => {
      const result = await analyzeMeal({
        photoUrl,
        mediaType: mediaType as "image/jpeg" | "image/png",
        kind,
        meal,
        mealLabel: mealLabel.trim() || null,
        recordedAt: date,
        servings: servingsNum,
        note: note.trim() || null,
      });
      if (result.ok) {
        reward.celebrate(
          (kind === "label" ? "Label logged." : "Chad's verdict is in.") +
            loggedDayNote()
        );
        resetCommon();
        pick(null);
        setServings("1");
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't analyze that.");
      }
    });
  }

  function submitManual() {
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
      const result = await logMealManually({
        title: title.trim(),
        meal,
        mealLabel: mealLabel.trim() || null,
        recordedAt: date,
        calories: calNum,
        protein: proNum,
        carbs: carbNum,
        fat: fatNum,
        note: note.trim() || null,
      });
      if (result.ok) {
        reward.celebrate(`Logged.${loggedDayNote()}`);
        resetCommon();
        setTitle("");
        setCal("");
        setPro("");
        setCarb("");
        setFatG("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't log that.");
      }
    });
  }

  function logRecent(food: RecentFood) {
    setLoggingFood(food.title);
    startTransition(async () => {
      const result = await logMealManually({
        title: food.title,
        meal,
        mealLabel: mealLabel.trim() || null,
        recordedAt: date,
        calories: food.calories,
        protein: food.protein,
        carbs: food.carbs,
        fat: food.fat,
        note: null,
      });
      setLoggingFood(null);
      if (result.ok) {
        reward.celebrate(`Logged ${food.title}.${loggedDayNote()}`);
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't log that.");
      }
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // "search", "barcode", and "recent" log per-row with their own buttons.
    if (mode === "photo") {
      submitPhoto("meal");
    } else if (mode === "label") {
      submitPhoto("label");
    } else if (mode === "manual") {
      submitManual();
    }
  }

  function renderSubmitLabel() {
    if (mode === "photo") {
      if (uploading) {
        return "Uploading…";
      }
      return pending ? "Chad's analyzing…" : "Analyze Food Photo";
    }
    if (mode === "label") {
      if (uploading) {
        return "Uploading…";
      }
      return pending ? "Reading label…" : "Analyze Nutrition Label";
    }
    return pending ? "Logging…" : "Log meal";
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <div>
        <h2 className="font-medium text-lg">Log a meal</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Search the food database or scan a product barcode for verified
          numbers. Snap a photo of your food or of its nutrition facts label and
          Chad reads it, with a straight verdict on what it's doing to your
          goal. Or type the numbers yourself, or re-log a recent meal in one
          tap.
        </p>
      </div>

      {/* Mode toggle. The two-word labels ("Barcode Scanner", "Label Photo")
          must always sit on ONE line: on phones the tiles stack icon-over-
          label (the standard mobile logging-sheet pattern; a horizontal pill
          can't hold the longest label at 320-390px), from sm up they're
          horizontal pills in a 3-col grid (owner report, s164). */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {(
          [
            { value: "search", label: "Search", Icon: Search },
            { value: "barcode", label: "Barcode Scanner", Icon: ScanBarcode },
            { value: "photo", label: "Food Photo", Icon: Camera },
            { value: "label", label: "Label Photo", Icon: ScanLine },
            { value: "manual", label: "Manual Entry", Icon: PencilLine },
            { value: "recent", label: "Recent", Icon: History },
          ] as const
        ).map(({ value, label, Icon }) => (
          <button
            className={`flex flex-col items-center justify-center gap-1 whitespace-nowrap rounded-xl border px-2 py-2 font-medium text-xs transition-colors sm:flex-row sm:gap-1.5 sm:py-2.5 sm:text-sm ${
              mode === value
                ? "border-blood bg-blood/10"
                : "border-border bg-background/40 text-muted-foreground hover:bg-accent/50"
            }`}
            key={value}
            onClick={() => setMode(value)}
            type="button"
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {/* Meal category + date (back-date a meal you forgot) */}
      <div className="flex flex-col gap-2">
        <Label className="text-muted-foreground text-xs">Meal</Label>
        <MealCategoryPicker
          customLabel={mealLabel}
          onChange={setMeal}
          onCustomLabelChange={setMealLabel}
          value={meal}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label className="text-muted-foreground text-xs" htmlFor="m-date">
          Date
        </Label>
        <DatePicker
          className="w-44"
          id="m-date"
          max={todayLocalISO()}
          onChange={setDate}
          value={date}
        />
      </div>

      {mode === "search" ? (
        <FoodSearch
          date={date}
          key="search"
          meal={meal}
          mealLabel={mealLabel.trim() || null}
        />
      ) : mode === "barcode" ? (
        // key forces a fresh mount when hopping Search <-> Barcode, so the
        // Barcode tab's auto-opening camera actually opens every time.
        <FoodSearch
          date={date}
          key="barcode"
          meal={meal}
          mealLabel={mealLabel.trim() || null}
          variant="barcode"
        />
      ) : mode === "photo" || mode === "label" ? (
        <>
          <p className="rounded-xl border border-border border-dashed bg-background/40 px-3 py-2.5 text-muted-foreground text-xs">
            {mode === "label"
              ? "Photograph the nutrition facts panel on packaged food. Chad reads the calories and macros straight off the label."
              : "Photograph your plate or meal. Chad identifies the food and estimates the calories and macros."}
          </p>
          <PhotoInput
            hint={
              mode === "label"
                ? "Add a photo of the nutrition label"
                : "Add a photo of your food"
            }
            icon={mode === "label" ? ScanLine : Camera}
            note="JPEG or PNG, up to 5MB"
            onSelect={(files) => pick(files[0] ?? null)}
            preview={preview}
            previewAlt="Selected"
          />
          {mode === "label" && (
            <div className="flex flex-col gap-2">
              <Label className="text-muted-foreground text-xs" htmlFor="m-serv">
                Servings eaten
              </Label>
              <Input
                className="w-44"
                id="m-serv"
                inputMode="decimal"
                min="0"
                onChange={(e) => setServings(e.target.value)}
                placeholder="1"
                step="0.5"
                type="number"
                value={servings}
              />
              <p className="text-muted-foreground text-xs">
                The label lists values per serving. Chad multiplies by this.
              </p>
            </div>
          )}
          <Textarea
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything Chad should know? (optional) e.g. 'post-workout', 'cutting'"
            rows={2}
            value={note}
          />
        </>
      ) : mode === "manual" ? (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="m-title">What did you eat?</Label>
            <Input
              id="m-title"
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chicken, rice & broccoli"
              value={title}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <MacroField
              id="m-cal"
              label="Calories"
              onChange={setCal}
              unit="cal"
              value={cal}
            />
            <MacroField
              id="m-pro"
              label="Protein"
              onChange={setPro}
              unit="g"
              value={pro}
            />
            <MacroField
              id="m-carb"
              label="Carbs"
              onChange={setCarb}
              unit="g"
              value={carb}
            />
            <MacroField
              id="m-fat"
              label="Fat"
              onChange={setFatG}
              unit="g"
              value={fatG}
            />
          </div>
        </>
      ) : recentFoods.length === 0 ? (
        <p className="rounded-xl border border-border border-dashed bg-background/40 px-4 py-8 text-center text-muted-foreground text-sm">
          No recent meals yet. Log a few by photo or by hand and they'll show up
          here for one-tap re-logging.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs">
            Tap to log it again under the meal and date above.
          </p>
          {recentFoods.map((food) => {
            const summary = formatMacroSummary(food);
            return (
              <button
                className="flex items-center gap-3 rounded-xl border border-border bg-background/40 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 disabled:opacity-60"
                disabled={busy}
                key={food.title}
                onClick={() => logRecent(food)}
                type="button"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-sm">
                    {food.title}
                  </div>
                  {summary && (
                    <div className="truncate text-muted-foreground text-xs">
                      {summary}
                    </div>
                  )}
                </div>
                {pending && loggingFood === food.title ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <Plus className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {mode !== "recent" &&
        mode !== "search" &&
        mode !== "barcode" &&
        (() => {
          // At rest with no photo, don't render a dead flat-grey slab (which made
          // the whole form look inert on first load). Keep the button live and
          // brand-tinted — clicking it without a photo toasts exactly what's
          // missing (NUT-15).
          const needsPhoto = (mode === "photo" || mode === "label") && !file;
          const PhotoIcon = mode === "label" ? ScanLine : Camera;
          return (
            <Button
              className={cn(
                "gap-2",
                needsPhoto &&
                  "border border-blood/40 bg-blood/5 text-blood hover:bg-blood/10"
              )}
              disabled={busy}
              size="lg"
              type="submit"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {!busy && needsPhoto && <PhotoIcon className="size-4" />}
              {renderSubmitLabel()}
            </Button>
          );
        })()}
    </form>
  );
}
