"use client";

import { RoastComposer } from "@/components/share/roast-composer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * The "share this roast" dialog (FEAT-24). Controlled by the caller (chat
 * message actions, weekly-report actions) so each surface renders its own
 * trigger. Everything inside is the shared RoastComposer.
 */
export function RoastShareDialog({
  initialText,
  open,
  onOpenChange,
}: {
  initialText: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this roast</DialogTitle>
          <DialogDescription>
            Turn Chad&apos;s words into a card you can post. Only what you see
            here goes on it.
          </DialogDescription>
        </DialogHeader>
        {/* Remount per open so a reopened dialog starts from the message
            again instead of a stale edit. */}
        {open && <RoastComposer initialText={initialText} />}
      </DialogContent>
    </Dialog>
  );
}
