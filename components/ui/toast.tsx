"use client";

import { toast } from "sonner";

/**
 * FEEDBACK TOAST PRIMITIVES (FIX-38, P2-E). One toast grammar over sonner so
 * loggers stop hand-assembling durations, actions, and receipt phrasing.
 * Sonner announces toasts to screen readers (aria-live region) and the
 * existing per-layout <Toaster position="top-center" richColors /> mounts
 * stay the render surface.
 *
 * Three shapes, per the motion-interaction contract:
 *   toastReceipt  - success receipt for a meaningful write, with the concrete
 *                   result: "Added 20 oz. 64 oz remaining today."
 *   toastUndo     - optimistic quick-add confirmation carrying the Undo
 *                   action; persists 6s (destructive confirm-or-undo law
 *                   requires at least 5).
 *   toastError    - failure that never blames and never loses input:
 *                   "We couldn't save your sleep entry. Your values are
 *                   still here. Try again."
 */

/** At least 5s by owner law; 6s gives a comfortable reach for the action. */
const UNDO_DURATION_MS = 6000;

export function toastReceipt(message: string) {
  return toast.success(message);
}

export function toastUndo(
  message: string,
  {
    onUndo,
    onUndoFailed,
  }: {
    onUndo: () =>
      | Promise<{ ok: boolean; error?: string | null } | void>
      | { ok: boolean; error?: string | null }
      | void;
    /** Shown if onUndo resolves { ok: false }; defaults to a generic retry line. */
    onUndoFailed?: (error: string | null | undefined) => void;
  }
) {
  return toast.success(message, {
    duration: UNDO_DURATION_MS,
    action: {
      label: "Undo",
      onClick: async () => {
        const result = await onUndo();
        if (result && !result.ok) {
          if (onUndoFailed) {
            onUndoFailed(result.error);
          } else {
            toastError(result.error ?? "We couldn't undo that. Try again.");
          }
        }
      },
    },
  });
}

export function toastError(message: string) {
  return toast.error(message);
}
