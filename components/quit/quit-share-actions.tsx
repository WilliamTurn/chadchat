"use client";

import { Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShareCardDialog } from "@/components/share/share-card-dialog";
import { Button } from "@/components/ui/button";
import type {
  ReceiptCardData,
  VerdictCardData,
} from "@/lib/quit/share-cards";

// The stakes copy — owner wording (s157): sharing exists to make the
// prediction public and raise the cost of quitting.
const EXPLAINER =
  "Share it so your friends and followers know what you're going up against. Raise the stakes by making it public: if Chad is right and you give up, everyone will know you're a weak piece of shit. Prove him wrong and you'll earn respect.";

/**
 * The Quit Test share buttons (FEAT-23, pro-app flow): each opens the share
 * dialog — card preview + X / Facebook / native sheet / copy link / download.
 * The link is the public /q/[id] page, which unfurls into the card on feeds.
 */
export function QuitShareActions({
  verdict,
  receipt,
  predictionId,
}: {
  verdict: VerdictCardData;
  receipt: ReceiptCardData | null;
  predictionId: string | null;
}) {
  const [kind, setKind] = useState<"verdict" | "receipt" | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  // Resolved after mount (window): the app origin serves the public page.
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function renderBlob(which: "verdict" | "receipt"): Promise<Blob> {
    const cards = await import("@/lib/quit/share-cards");
    return which === "receipt" && receipt
      ? cards.renderReceiptCard(receipt)
      : cards.renderVerdictCard(verdict);
  }

  async function openDialog(which: "verdict" | "receipt") {
    setPreview(null);
    setKind(which);
    try {
      const blob = await renderBlob(which);
      setPreview(URL.createObjectURL(blob));
    } catch {
      toast.error("Couldn't build the card preview on this device.");
    }
  }

  function closeDialog(open: boolean) {
    if (!open) {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
      setKind(null);
      setPreview(null);
    }
  }

  const shareUrl =
    origin && predictionId
      ? `${origin}/q/${predictionId}${kind === "receipt" ? "?v=receipt" : ""}`
      : undefined;

  return (
    <>
      {receipt && (
        <Button onClick={() => openDialog("receipt")} size="sm">
          <Share2 className="size-3.5" />
          Share the receipt
        </Button>
      )}
      <Button
        onClick={() => openDialog("verdict")}
        size="sm"
        variant={receipt ? "outline" : "default"}
      >
        <Share2 className="size-3.5" />
        Share the verdict
      </Button>
      <ShareCardDialog
        caption={
          kind === "receipt" && receipt
            ? `Chad gave me ${receipt.givenDays} days. I'm on day ${receipt.currentDay}.`
            : `Chad says I quit on ${verdict.dateLabel}. Watch me prove him wrong.`
        }
        explainer={EXPLAINER}
        filename={
          kind === "receipt"
            ? "chad-quit-test-receipt.png"
            : "chad-quit-test-verdict.png"
        }
        getBlob={() => renderBlob(kind ?? "verdict")}
        onOpenChange={closeDialog}
        open={kind !== null}
        preview={preview}
        shareUrl={shareUrl}
        title={kind === "receipt" ? "Share your receipt" : "Share your verdict"}
      />
    </>
  );
}
