"use client";

// DEC-05 (owner, 2026-07-13): the dashboard header silhouette/body customizer,
// relocated from /home to Account > Appearance. Relocation only: every
// capability of the old header popover survives here: switch between the
// built-in male / female silhouettes, upload your own image, reset to the
// default. The page renders the current choice as a live preview; this
// component writes the choice and refreshes.

import { Loader2, RotateCcw, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  resetHeroFigure,
  setHeroFigure,
  uploadHeroImage,
} from "@/app/home/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HERO_FEMALE_SRC,
  HERO_MALE_SRC,
  type ResolvedHero,
} from "@/lib/today/goal-diagram";
import { cn } from "@/lib/utils";

const FIGURES = [
  { key: "male", label: "Male", src: HERO_MALE_SRC },
  { key: "female", label: "Female", src: HERO_FEMALE_SRC },
] as const;

export function AppearanceCustomizer({ hero }: { hero: ResolvedHero }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  // Which control the pending transition belongs to, so only the clicked
  // figure tile (or the reset button) shows the busy spinner (DSH-37).
  const [busy, setBusy] = useState<"male" | "female" | "reset" | null>(null);

  function choose(figure: "male" | "female") {
    setBusy(figure);
    startTransition(async () => {
      const res = await setHeroFigure(figure);
      if (res.ok) {
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't update that.");
      }
      setBusy(null);
    });
  }

  function reset() {
    setBusy("reset");
    startTransition(async () => {
      const res = await resetHeroFigure();
      if (res.ok) {
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't reset that.");
      }
      setBusy(null);
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) {
      return;
    }
    setUploading(true);
    const data = new FormData();
    data.set("file", file);
    const res = await uploadHeroImage(data);
    if (res.ok) {
      toast.success("Your image is saved.");
      // Keep the button in its "Uploading…" state through the refresh so the
      // control never looks idle while the old image is still on screen.
      startTransition(() => {
        router.refresh();
        setUploading(false);
      });
    } else {
      setUploading(false);
      toast.error(res.error ?? "Couldn't save that image.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-medium text-sm">Your figure</h3>
        <p className="mt-1 text-muted-foreground text-sm">
          Pick a silhouette or upload your own image.
        </p>
      </div>

      <div className="grid max-w-xs grid-cols-2 gap-3">
        {FIGURES.map((f) => {
          const active = hero.effective === f.key;
          const isBusy = pending && busy === f.key;
          return (
            <Button
              aria-busy={isBusy}
              aria-pressed={active}
              className={cn(
                "group relative flex h-36 w-full min-w-11 items-end justify-center overflow-hidden rounded-xl border bg-background/60 p-1 transition-colors hover:bg-background/60 disabled:cursor-default",
                active
                  ? "border-blood ring-1 ring-blood"
                  : "border-border hover:border-foreground/30"
              )}
              disabled={pending || uploading}
              key={f.key}
              onClick={() => choose(f.key)}
              type="button"
              variant="ghost"
            >
              <img
                alt={`${f.label} silhouette`}
                className="h-full w-auto object-contain"
                src={f.src}
              />
              {/* Busy veil: the clicked tile shows a spinner until the new
                  figure is actually on screen (server action + refresh). */}
              {isBusy && (
                <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/70">
                  <Loader2 className="size-4 animate-spin text-foreground" />
                </span>
              )}
              <span className="absolute right-0 bottom-1.5 left-0 text-center font-medium text-muted-foreground text-xs group-hover:text-foreground">
                {f.label}
              </span>
            </Button>
          );
        })}
      </div>

      <Input
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={onFile}
        ref={fileRef}
        type="file"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          className="min-h-11 gap-1.5 sm:min-h-9"
          disabled={uploading || pending}
          onClick={() => fileRef.current?.click()}
          size="sm"
          type="button"
          variant="outline"
        >
          {uploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {uploading ? "Uploading…" : "Upload your own"}
        </Button>

        {hero.kind === "custom" && (
          <Button
            className="min-h-11 gap-1.5 sm:min-h-9"
            disabled={pending || uploading}
            onClick={reset}
            size="sm"
            type="button"
            variant="ghost"
          >
            {pending && busy === "reset" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCcw className="size-3.5" />
            )}
            Use a default figure
          </Button>
        )}
      </div>
    </div>
  );
}
