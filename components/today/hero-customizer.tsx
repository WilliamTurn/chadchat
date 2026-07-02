"use client";

// DSH-21 — lets a member personalize the decorative /today header figure:
// switch between the built-in male / female silhouettes, or upload their own
// background image. Lives in the header's bottom-right corner (lg+ only, where
// the figure is visible). The actual figure is rendered server-side by the
// page; this only writes the choice and refreshes.

import { ImagePlus, Loader2, RotateCcw, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  // Which control the pending transition belongs to, so only the clicked
  // figure tile (or the reset link) shows the busy spinner (DSH-37: the
  // male/female switch gave no feedback while the server action + refresh ran).
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
      toast.success("Header image updated.");
      // Keep the button in its "Uploading…" state through the refresh so the
      // control never looks idle while the old image is still on screen.
      startTransition(() => {
        router.refresh();
        setUploading(false);
        setOpen(false);
      });
    } else {
      setUploading(false);
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
            const isBusy = pending && busy === f.key;
            return (
              <button
                aria-busy={isBusy}
                aria-pressed={active}
                className={cn(
                  "group relative flex h-24 items-end justify-center overflow-hidden rounded-lg border bg-background/60 p-1 transition-colors disabled:cursor-default",
                  active
                    ? "border-blood ring-1 ring-blood"
                    : "border-border hover:border-foreground/30"
                )}
                disabled={pending || uploading}
                key={f.key}
                onClick={() => choose(f.key)}
                type="button"
              >
                <img
                  alt={`${f.label} silhouette`}
                  className="h-full w-auto object-contain"
                  src={f.src}
                />
                {/* Busy veil: the clicked tile shows a spinner until the new
                    figure is actually on screen (server action + refresh). */}
                {isBusy && (
                  <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70">
                    <Loader2 className="size-4 animate-spin text-foreground" />
                  </span>
                )}
                <span className="absolute bottom-1 left-0 right-0 text-center font-medium text-[11px] text-muted-foreground group-hover:text-foreground">
                  {f.label}
                </span>
              </button>
            );
          })}
        </div>

        <input
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={onFile}
          ref={fileRef}
          type="file"
        />
        <Button
          className="mt-2 w-full gap-1.5"
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
          <button
            className="mt-2 inline-flex items-center gap-1.5 text-muted-foreground text-xs transition-colors hover:text-foreground disabled:cursor-default"
            disabled={pending || uploading}
            onClick={reset}
            type="button"
          >
            {pending && busy === "reset" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RotateCcw className="size-3" />
            )}
            Use a default figure
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
