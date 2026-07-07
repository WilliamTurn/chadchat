"use client";

import { Copy, Download, Loader2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/**
 * The share destinations row (FEAT-23/24, pro-app share flow): post to X,
 * share to Facebook, the native share sheet where the device has one, copy
 * the link/text, and download the image — the same destination set the
 * category leaders (Strava, Spotify Wrapped) offer. `shareUrl` should be a
 * public page whose OG image IS the card, so feeds unfurl it visually;
 * without one, X gets the caption text and the image is download-only.
 */
export function ShareDestinations({
  caption,
  shareUrl,
  getBlob,
  filename,
}: {
  caption: string;
  shareUrl?: string;
  getBlob: () => Promise<Blob>;
  filename: string;
}) {
  const [busy, setBusy] = useState<"native" | "download" | null>(null);
  // The native sheet is the primary mechanic on phones/tablets only; on
  // desktop the X/Facebook buttons are the real destinations.
  const [showNative, setShowNative] = useState(false);
  useEffect(() => {
    setShowNative(
      typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        window.matchMedia("(pointer: coarse)").matches
    );
  }, []);

  const text = shareUrl ? `${caption} ${shareUrl}` : caption;

  function openPopup(url: string) {
    window.open(url, "_blank", "noopener,noreferrer,width=640,height=640");
  }

  async function nativeShare() {
    setBusy("native");
    try {
      const blob = await getBlob();
      const file = new File([blob], filename, { type: "image/png" });
      const withFile =
        typeof navigator.canShare === "function" &&
        navigator.canShare({ files: [file] });
      await navigator.share({
        text: caption,
        ...(shareUrl ? { url: shareUrl } : {}),
        ...(withFile ? { files: [file] } : {}),
      });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        toast.error("Couldn't open the share sheet.");
      }
    } finally {
      setBusy(null);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(shareUrl ? "Link copied." : "Text copied.");
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  }

  async function download() {
    setBusy("download");
    try {
      const [{ downloadPng }, blob] = await Promise.all([
        import("@/lib/share/canvas"),
        getBlob(),
      ]);
      downloadPng(blob, filename);
      toast.success("Image saved.");
    } catch {
      toast.error("Couldn't build the image on this device.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {showNative && (
        <Button disabled={busy !== null} onClick={nativeShare}>
          {busy === "native" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Share2 className="size-4" />
          )}
          Share
        </Button>
      )}
      <Button
        onClick={() =>
          openPopup(
            `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
          )
        }
        variant={showNative ? "outline" : "default"}
      >
        Post on X
      </Button>
      {shareUrl && (
        <Button
          onClick={() =>
            openPopup(
              `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
            )
          }
          variant="outline"
        >
          Share on Facebook
        </Button>
      )}
      <Button onClick={copy} variant="outline">
        <Copy className="size-4" />
        {shareUrl ? "Copy link" : "Copy text"}
      </Button>
      <Button disabled={busy !== null} onClick={download} variant="outline">
        {busy === "download" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Download className="size-4" />
        )}
        Download
      </Button>
    </div>
  );
}
