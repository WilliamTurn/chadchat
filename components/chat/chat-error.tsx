"use client";

import { RotateCcw, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Persistent, in-thread error banner with a Retry button (FEAT-5).
 *
 * Streaming/network errors used to dead-end in a disappearing toast, leaving the
 * user stuck with no obvious way forward. This sits at the bottom of the message
 * list until the user retries the turn or dismisses it.
 */
export function ChatError({
  message,
  onRetry,
  onDismiss,
}: {
  message: string;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  return (
    <div
      className="flex w-full items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/[0.06] px-4 py-3"
      role="alert"
    >
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground text-sm">
          Chad couldn&apos;t finish that
        </p>
        <p className="mt-0.5 text-muted-foreground text-sm">{message}</p>
        <div className="mt-2.5">
          <Button
            className="gap-1.5"
            onClick={onRetry}
            size="sm"
            type="button"
            variant="outline"
          >
            <RotateCcw className="size-3.5" />
            Retry
          </Button>
        </div>
      </div>
      <button
        aria-label="Dismiss"
        className="-mr-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-foreground"
        onClick={onDismiss}
        type="button"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
