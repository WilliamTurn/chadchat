"use client";

import { Download, Film } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateMontage } from "@/app/progress/actions";
import { Button } from "@/components/ui/button";
import type { ProgressMontageContent } from "@/lib/montage/content";

/**
 * Chad's montage (FEAT-18): the member's real progress photos side by side in
 * a timeline with Chad's caption under each frame and his overall verdict.
 * The strip below is plain DOM (always works); "Save as image" re-draws the
 * same real photos onto a branded canvas via lib/montage/render.ts.
 */
export function MontageCard({
  initial,
  generatedAtLabel,
}: {
  initial: ProgressMontageContent | null;
  generatedAtLabel: string | null;
}) {
  const [content, setContent] = useState<ProgressMontageContent | null>(
    initial
  );
  const [dateLabel, setDateLabel] = useState<string | null>(generatedAtLabel);
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  const onGenerate = () => {
    startTransition(async () => {
      const result = await generateMontage();
      if (result.ok) {
        setContent(result.content);
        setDateLabel("today");
        toast.success("Montage ready. Chad has looked. Scroll down for it.");
      } else {
        toast.error(result.error);
      }
    });
  };

  const onDownload = async () => {
    if (!content) {
      return;
    }
    setIsExporting(true);
    try {
      const { downloadMontagePng } = await import("@/lib/montage/render");
      await downloadMontagePng(content);
    } catch (_error) {
      toast.error(
        "Couldn't export the image on this device. Screenshot the montage instead."
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-medium text-lg">
            <Film aria-hidden className="size-4 text-muted-foreground" />
            Chad&apos;s montage
          </h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Your photos, side by side, with Chad&apos;s read on each frame.
            {dateLabel ? ` Last built ${dateLabel}.` : ""}
          </p>
        </div>
        <Button disabled={isPending} onClick={onGenerate}>
          {isPending
            ? "Chad is looking..."
            : content
              ? "Rebuild with latest photos"
              : "Build my montage"}
        </Button>
      </div>

      {content && (
        <>
          {/* xl: the card sits in a half-page column (LAY-1), so the strip
              drops back to 2-up there. */}
          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-2">
            {content.frames.map((frame) => (
              <figure key={frame.photoUrl} className="min-w-0">
                {/* biome-ignore lint/performance/noImgElement: user-uploaded blob images, sizes vary */}
                <img
                  alt={`Progress on ${frame.dateLabel}`}
                  className="aspect-[3/4] w-full rounded-xl border border-border object-cover"
                  src={frame.photoUrl}
                />
                <figcaption className="mt-2">
                  <span className="font-medium text-sm">{frame.dateLabel}</span>
                  {frame.weightLabel && (
                    <span className="ml-2 text-muted-foreground text-xs">
                      {frame.weightLabel}
                    </span>
                  )}
                  <p className="mt-1 text-muted-foreground text-sm leading-snug">
                    {frame.caption}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <p className="font-semibold text-destructive text-xs tracking-[0.12em]">
              CHAD&apos;S VERDICT
            </p>
            <p className="mt-2 text-sm leading-relaxed">{content.verdict}</p>
          </div>

          <Button
            className="mt-4"
            disabled={isExporting}
            onClick={onDownload}
            variant="outline"
          >
            <Download aria-hidden className="size-4" />
            {isExporting ? "Exporting..." : "Save as image"}
          </Button>
        </>
      )}
    </section>
  );
}
