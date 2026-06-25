"use client";

import { Camera, Loader2, PencilLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { analyzeMeal, logMealManually } from "@/app/nutrition/actions";
import {
  defaultMealForNow,
  MealCategoryPicker,
  parseMacro,
} from "@/components/nutrition/meal-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { MealCategory } from "@/lib/validation/nutrition";

type Mode = "photo" | "manual";

export function AnalyzeForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<Mode>("photo");
  const [meal, setMeal] = useState<MealCategory>(defaultMealForNow());
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // Manual fields
  const [title, setTitle] = useState("");
  const [cal, setCal] = useState("");
  const [pro, setPro] = useState("");
  const [carb, setCarb] = useState("");
  const [fatG, setFatG] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
  }

  async function submitPhoto() {
    if (!file) {
      toast.error("Add a photo first.");
      return;
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
      toast.error("Upload failed — try again.");
      setUploading(false);
      return;
    }
    setUploading(false);

    startTransition(async () => {
      const result = await analyzeMeal({
        photoUrl,
        mediaType: mediaType as "image/jpeg" | "image/png",
        kind: "meal",
        meal,
        note: note.trim() || null,
      });
      if (result.ok) {
        toast.success("Chad's verdict is in.");
        resetCommon();
        pick(null);
        if (inputRef.current) {
          inputRef.current.value = "";
        }
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
        calories: calNum,
        protein: proNum,
        carbs: carbNum,
        fat: fatNum,
        note: note.trim() || null,
      });
      if (result.ok) {
        toast.success("Logged.");
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (mode === "photo") {
      submitPhoto();
    } else {
      submitManual();
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <div>
        <h2 className="font-medium text-lg">Log a meal</h2>
        <p className="mt-1 text-muted-foreground text-sm">
          Snap your plate and Chad reads the photo — calories, macros, and a
          straight verdict on what it's doing to your goal. Or type the numbers
          yourself.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 font-medium text-sm transition-colors ${
            mode === "photo"
              ? "border-blood bg-blood/10"
              : "border-border bg-background/40 text-muted-foreground hover:bg-accent/50"
          }`}
          onClick={() => setMode("photo")}
          type="button"
        >
          <Camera className="size-4" />
          Photo
        </button>
        <button
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 font-medium text-sm transition-colors ${
            mode === "manual"
              ? "border-blood bg-blood/10"
              : "border-border bg-background/40 text-muted-foreground hover:bg-accent/50"
          }`}
          onClick={() => setMode("manual")}
          type="button"
        >
          <PencilLine className="size-4" />
          Log manually
        </button>
      </div>

      {/* Meal category */}
      <div className="flex flex-col gap-2">
        <Label className="text-muted-foreground text-xs">Meal</Label>
        <MealCategoryPicker onChange={setMeal} value={meal} />
      </div>

      {mode === "photo" ? (
        <>
          <button
            className="relative flex min-h-44 w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-border border-dashed bg-background/40 px-4 py-6 text-center transition-colors hover:bg-accent/40"
            onClick={() => inputRef.current?.click()}
            type="button"
          >
            {preview ? (
              // biome-ignore lint/performance/noImgElement: local object-URL preview
              <img
                alt="Selected"
                className="max-h-64 w-auto rounded-lg object-contain"
                src={preview}
              />
            ) : (
              <>
                <Camera className="size-7 text-muted-foreground" />
                <span className="font-medium text-sm">Tap to add a photo</span>
                <span className="text-muted-foreground text-xs">
                  JPEG or PNG, up to 5MB
                </span>
              </>
            )}
          </button>
          <input
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
            ref={inputRef}
            type="file"
          />
          <Textarea
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything Chad should know? (optional) — e.g. 'post-workout', 'cutting'"
            rows={2}
            value={note}
          />
        </>
      ) : (
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="m-cal">Calories</Label>
              <Input
                id="m-cal"
                inputMode="numeric"
                onChange={(e) => setCal(e.target.value)}
                placeholder="kcal"
                value={cal}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="m-pro">Protein</Label>
              <Input
                id="m-pro"
                inputMode="numeric"
                onChange={(e) => setPro(e.target.value)}
                placeholder="g"
                value={pro}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="m-carb">Carbs</Label>
              <Input
                id="m-carb"
                inputMode="numeric"
                onChange={(e) => setCarb(e.target.value)}
                placeholder="g"
                value={carb}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="m-fat">Fat</Label>
              <Input
                id="m-fat"
                inputMode="numeric"
                onChange={(e) => setFatG(e.target.value)}
                placeholder="g"
                value={fatG}
              />
            </div>
          </div>
        </>
      )}

      <Button
        className="gap-2"
        disabled={busy || (mode === "photo" && !file)}
        size="lg"
        type="submit"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {mode === "photo"
          ? uploading
            ? "Uploading…"
            : pending
              ? "Chad's analyzing…"
              : "Analyze with Chad"
          : pending
            ? "Logging…"
            : "Log meal"}
      </Button>
    </form>
  );
}
