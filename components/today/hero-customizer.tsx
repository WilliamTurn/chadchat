"use client";

// DSH-21 — lets a member personalize the decorative /today header figure:
// switch between the built-in male / female silhouettes, or upload their own
// background image. Lives in the header's bottom-right corner (lg+ only, where
// the figure is visible). The actual figure is rendered server-side by the
// page; this only writes the choice and refreshes.

import { ImagePlus, Loader2, RotateCcw, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  resetHeroFigure,
  setHeroFigure,
  uploadHeroImage,
} from "@/app/today/actions";
import {
  HERO_FEMALE_SRC,
  HERO_MALE_SRC,
  type ResolvedHero,
} from "@/lib/today/goal-diagram";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const FIGURES = [
  { key: "male", label: "Male", src: HERO_MALE_SRC },
  { key: "female", label: "Female", src: HERO_FEMALE_SRC },
] as const;

export function HeroCustomizer({ hero }: { hero: ResolvedHero }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  function choose(figure: "male" | "female") {
    startTransition(async () => {
      const res = await setHeroFigure(figure);
      if (res.ok) {
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't update that.");
      }
    });
  }

  function reset() {
    startTransition(async () => {
      const res = await resetHeroFigure();
      if (res.ok) {
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't reset that.");
      }
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
    setUploading(false);
    if (res.ok) {
      toast.success("Header image updated.");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error ?? "Couldn't save that image.");
    }
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-label="Personalize header image"
          className="hidden items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-muted-foreground text-xs backdrop-blur-sm transition-colors hover:bg-accent hover:text-foreground lg:inline-flex"
          type="button"
        >
          <ImagePlus className="size-3.5" />
          Personalize
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64" side="bottom">
        <p className="font-medium text-sm">Header image</p>
        <p className="mt-0.5 text-muted-foreground text-xs">
          Pick a figure or upload your own.
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {FIGURES.map((f) => {
            const active = hero.effective === f.key;
            return (
              <button
                aria-pressed={active}
                className={cn(
                  "group relative flex h-24 items-end justify-center overflow-hidden rounded-lg border bg-background/60 p-1 transition-colors",
                  active
                    ? "border-blood ring-1 ring-blood"
                    : "border-border hover:border-foreground/30"
                )}
                disabled={pending}
                key={f.key}
                onClick={() => choose(f.key)}
                type="button"
              >
                <img
                  alt={`${f.label} silhouette`}
                  className="h-full w-auto object-contain"
                  src={f.src}
                />
                <span className="absolute bottom-1 left-0 right-0 text-center font-medium text-[11px] text-muted-foreground group-hover:text-foreground">
                  {f.label}
                </span>
              </button>
            );
          })}
        </div>

        <label className="mt-2 block">
          <input
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={onFile}
            type="file"
          />
          <Button
            asChild
            className="w-full gap-1.5"
            disabled={uploading || pending}
            size="sm"
            variant="outline"
          >
            <span>
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Upload className="size-3.5" />
              )}
              {uploading ? "Uploading…" : "Upload your own"}
            </span>
          </Button>
        </label>

        {hero.kind === "custom" && (
          <button
            className="mt-2 inline-flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground"
            disabled={pending}
            onClick={reset}
            type="button"
          >
            <RotateCcw className="size-3" />
            Use a default figure
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
