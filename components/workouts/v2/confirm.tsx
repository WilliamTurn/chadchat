"use client";

// Small confirmation dialog. Popups in this feature are ONLY for
// confirmations; every real feature gets a full page.

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
    // Scroll-lock while open, so the page can't scroll away underneath.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  // Portaled to <body>: the app shell's <main> carries a transform, which
  // makes it the containing block for position:fixed. Rendered inline, this
  // overlay would anchor to the DOCUMENT (opening off-viewport on scrolled
  // pages) and its z-index would be trapped below the floating docks.
  return createPortal(
    <div
      // Centered (owner ruling, flaws RUN-29/RUN-49: never pinned to the
      // bottom three-quarters), and the panel caps at the small viewport
      // height with its own scroll, so a tall body or an open software
      // keyboard can never clip it off-screen (flaws RUN-70/RUN-75..77).
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
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
        className="max-h-dialog w-full max-w-[400px] overflow-y-auto overscroll-contain rounded-2xl border border-input bg-popover p-5 shadow-[0_24px_64px_rgba(0,0,0,0.45)]"
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
    </div>,
    document.body
  );
}
