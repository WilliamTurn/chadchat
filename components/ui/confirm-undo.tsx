"use client";

import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import { useOverlayDepthGuard } from "@/components/ui/adaptive-dialog";
import { findBannedCopy } from "@/lib/contracts/copy";

/**
 * CONFIRM-OR-UNDO PLATFORM (FIX-17, P2-D). Owner law s185: every destructive
 * action either confirms with the NAMED object and its consequence, or
 * provides an immediate Undo. One-tap unrecoverable deletes are banned
 * everywhere, including history rows.
 *
 * The CONFIRM half of the law lives here: ConfirmActionDialog, the s177
 * goals-delete pattern as a component. The title names the exact object
 * ("Delete the Jul 6 weigh-in of 205.8 lb?"), the description states the
 * consequence, the confirm button is a verb+object, and an async onConfirm
 * gets a pending state for free.
 *
 * The UNDO half is P2-E's `toastUndo` in components/ui/toast.tsx (adopted
 * here per the contracts law: never re-declare). Quick optimistic adds call
 * toastUndo with the concrete receipt; it persists at least 5s and sonner
 * announces it to screen readers.
 *
 * Destructive actions never appear on dashboard panels (panels.ts); these
 * flows belong on detail pages and history rows.
 */

function warnBannedConfirmCopy(context: string, text: string) {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  for (const v of findBannedCopy(text)) {
    console.error(
      `ConfirmActionDialog ${context} "${text}" violates copy contract [${v.ruleId}]: ${v.reason}`
    );
  }
}

export type ConfirmActionDialogProps = {
  /** Optional trigger element (rendered asChild). Controlled use may omit
   *  it and drive `open`/`onOpenChange` instead. */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** MUST name the exact object: "Delete the Jul 6 weigh-in of 205.8 lb?" */
  title: string;
  /** The consequence, stated plainly: "This will update your weight trend." */
  consequence: string;
  /** Verb + object: "Delete weigh-in". Never a bare "Yes" or "OK". */
  confirmLabel: string;
  cancelLabel?: string;
  /** Destructive styling by default; pass false for non-destructive
   *  confirmations (leaving an unsaved flow, ending a session). */
  destructive?: boolean;
  /** May return a promise; the dialog shows a pending state until it
   *  settles and stays open on rejection so the member can retry. */
  onConfirm: () => void | Promise<void>;
};

function ConfirmActionDialog({
  trigger,
  open,
  onOpenChange,
  title,
  consequence,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
}: ConfirmActionDialogProps) {
  useOverlayDepthGuard("ConfirmActionDialog");
  const [pending, setPending] = React.useState(false);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const isOpen = open ?? uncontrolledOpen;
  const setOpen = (next: boolean) => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  if (process.env.NODE_ENV !== "production") {
    warnBannedConfirmCopy("title", title);
    warnBannedConfirmCopy("consequence", consequence);
    warnBannedConfirmCopy("confirmLabel", confirmLabel);
  }

  const handleConfirm = async (e: React.MouseEvent) => {
    // Keep the dialog open ourselves so async work gets a pending state and
    // failures do not silently dismiss.
    e.preventDefault();
    try {
      setPending(true);
      await onConfirm();
      setOpen(false);
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog onOpenChange={setOpen} open={isOpen}>
      {trigger && <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {/* 44px targets at phone widths are a shipping gate (accessibility
              law s185); the compact height returns with a pointer. */}
          <AlertDialogCancel className="min-h-11 sm:min-h-9" disabled={pending}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            className="min-h-11 sm:min-h-9"
            disabled={pending}
            onClick={handleConfirm}
            variant={destructive ? "destructive" : "default"}
          >
            {pending && <Spinner />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { ConfirmActionDialog };
