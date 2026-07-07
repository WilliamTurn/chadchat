"use client";

import { Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type {
  ReceiptCardData,
  VerdictCardData,
} from "@/lib/quit/share-cards";

/**
 * The Quit Date share buttons (FEAT-23): render the branded card client-side
 * on a canvas (lib/quit/share-cards.ts) and hand it to the native share sheet
 * where the device has one, otherwise download it. User-initiated only — the
 * app never nags anyone to share.
 */
export function QuitShareActions({
  verdict,
  receipt,
}: {
  verdict: VerdictCardData;
  receipt: ReceiptCardData | null;
}) {
  const [busy, setBusy] = useState<"verdict" | "receipt" | null>(null);

  async function share(kind: "verdict" | "receipt") {
    setBusy(kind);
    try {
      const [cards, canvas] = await Promise.all([
        import("@/lib/quit/share-cards"),
        import("@/lib/share/canvas"),
      ]);
      const blob =
        kind === "receipt" && receipt
          ? await cards.renderReceiptCard(receipt)
          : await cards.renderVerdictCard(verdict);
      const outcome = await canvas.shareOrDownloadPng(
        blob,
        kind === "receipt" ? "chad-quit-date-receipt.png" : "chad-quit-date-verdict.png"
      );
      if (outcome === "downloaded") {
        toast.success("Card saved. Post it wherever people know you.");
      }
    } catch {
      toast.error("Couldn't build the card on this device.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      {receipt && (
        <Button
          disabled={busy !== null}
          onClick={() => share("receipt")}
          size="sm"
        >
          {busy === "receipt" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Share2 className="size-3.5" />
          )}
          Share the receipt
        </Button>
      )}
      <Button
        disabled={busy !== null}
        onClick={() => share("verdict")}
        size="sm"
        variant="outline"
      >
        {busy === "verdict" ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Share2 className="size-3.5" />
        )}
        Share the verdict
      </Button>
    </>
  );
}
