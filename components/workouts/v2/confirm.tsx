"use client";

// Small confirmation dialog. Popups in this feature are ONLY for
// confirmations; every real feature gets a full page.

import { useEffect, type ReactNode } from "react";
import { WButton } from "./ui";

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Disables both buttons while the confirm action is in flight. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Optional extra content between body and buttons (e.g. a checkbox row). */
  children?: ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) {
          onCancel();
        }
      }}
      role="presentation"
    >
      <div
        aria-label={title}
        aria-modal="true"
        className="w-full max-w-[400px] rounded-2xl border border-input bg-popover p-5 shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
        role="alertdialog"
      >
        <h2 className="font-bold text-[18px] text-foreground">{title}</h2>
        {body && (
          <p className="mt-2 text-[14.5px] text-muted-foreground leading-relaxed">
            {body}
          </p>
        )}
        {children}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <WButton disabled={busy} onClick={onCancel} variant="ghost">
            {cancelLabel}
          </WButton>
          <WButton
            loading={busy}
            onClick={onConfirm}
            variant={destructive ? "danger" : "primary"}
          >
            {confirmLabel}
          </WButton>
        </div>
      </div>
    </div>
  );
}
