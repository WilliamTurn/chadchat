"use client";

import { useEffect, useState } from "react";
import { ShareDestinations } from "@/components/share/share-destinations";
import { Textarea } from "@/components/ui/textarea";
import { stripEmphasis } from "@/lib/text/emphasis";

/** Long enough for a real burn, short enough to stay readable on the card. */
export const ROAST_MAX_CHARS = 400;

/**
 * The roast-card composer (FEAT-24): Chad's words in an editable box (so the
 * member trims the message down to the line that hurt), a live preview of the
 * branded card, and Share / Download. Used inside the chat + report share
 * dialogs and on the /roast page the check-in emails link to. The card is
 * drawn client-side (lib/roast/render.ts); sharing uses the native share
 * sheet where the device has one.
 */
export function RoastComposer({ initialText }: { initialText: string }) {
  // Chad's messages carry emphasis markers (**bold** / [[red]]); the card is
  // plain text, so the editable prefill starts clean.
  const [text, setText] = useState(
    stripEmphasis(initialText).slice(0, ROAST_MAX_CHARS)
  );
  const [preview, setPreview] = useState<string | null>(null);

  // Debounced live preview — drawing is cheap, but no need to redraw per key.
  useEffect(() => {
    if (!text.trim()) {
      setPreview(null);
      return;
    }
    const handle = setTimeout(async () => {
      try {
        const { renderRoastCardCanvas } = await import("@/lib/roast/render");
        setPreview(renderRoastCardCanvas(text).toDataURL("image/png"));
      } catch {
        setPreview(null);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [text]);

  async function getBlob(): Promise<Blob> {
    const [{ renderRoastCardCanvas }, canvasLib] = await Promise.all([
      import("@/lib/roast/render"),
      import("@/lib/share/canvas"),
    ]);
    return canvasLib.canvasToPngBlob(renderRoastCardCanvas(text));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Textarea
          aria-label="The roast"
          maxLength={ROAST_MAX_CHARS}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste or trim Chad's words here."
          rows={4}
          value={text}
        />
        <p className="text-muted-foreground text-xs">
          Trim it to the line that hurt — short reads best on the card.
        </p>
      </div>

      {preview && (
        // biome-ignore lint/performance/noImgElement: locally generated data URL
        <img
          alt="Preview of your roast card"
          className="w-full max-w-sm self-center rounded-xl border border-border"
          src={preview}
        />
      )}

      {text.trim() && (
        <ShareDestinations
          caption={`"${stripEmphasis(text).replace(/\s+/g, " ").trim()}" — Chad, my AI coach. chadcoach.ai`}
          filename="chad-roast.png"
          getBlob={getBlob}
        />
      )}
    </div>
  );
}
