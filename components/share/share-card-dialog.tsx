"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ShareDestinations } from "@/components/share/share-destinations";

/**
 * The pro-app share dialog (FEAT-23): the card preview big, the stakes copy,
 * and real destinations (X, Facebook, native sheet on phones, copy link,
 * download) — never a silent file download. The share link is the public
 * /q/[id] page whose OG image IS the card, so feeds unfurl it visually.
 */
export function ShareCardDialog({
  open,
  onOpenChange,
  title,
  explainer,
  preview,
  caption,
  shareUrl,
  getBlob,
  filename,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  explainer?: string;
  preview: string | null;
  caption: string;
  shareUrl?: string;
  getBlob: () => Promise<Blob>;
  filename: string;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {explainer && <DialogDescription>{explainer}</DialogDescription>}
        </DialogHeader>
        {preview ? (
          // biome-ignore lint/performance/noImgElement: locally generated data URL
          <img
            alt="Preview of your card"
            className="max-h-80 w-auto self-center rounded-xl border border-border"
            src={preview}
          />
        ) : (
          <div className="h-40 animate-pulse self-stretch rounded-xl bg-muted-foreground/10" />
        )}
        <ShareDestinations
          caption={caption}
          filename={filename}
          getBlob={getBlob}
          shareUrl={shareUrl}
        />
      </DialogContent>
    </Dialog>
  );
}
