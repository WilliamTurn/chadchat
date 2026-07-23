"use client";

// Small confirmation dialog. Popups in this feature are ONLY for
// confirmations; every real feature gets a full page.

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { WButton } from "./ui";

/** Everything inside the panel a keyboard can land on. */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // The key handler reads these through refs so the focus effect below can
  // depend on `open` ALONE. Callers pass inline closures for onCancel and
  // flip `busy` mid-flight; if either were a dependency, every parent render
  // would tear down and re-run the effect, and its cleanup would yank focus
  // back to the trigger while the dialog was still open.
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  // Focus contract (canon 01 §89/§93, added by S0c after the flow audit found
  // this dialog took no focus at all): opening moves focus INSIDE, onto the
  // SAFE action; Tab cycles within the panel instead of walking the live page
  // behind the scrim; closing returns focus to whatever opened it. Without
  // this a keyboard or screen-reader member was never placed in the dialog
  // and could tab straight through the scrim into the page underneath.
  useEffect(() => {
    if (!open) {
      return;
    }
    const returnTo = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Busy-guarded like the scrim and both buttons: Escape mid-delete used
        // to hide an in-flight destructive request behind a closed dialog,
        // leaving no pending state anywhere and a dead retry.
        if (!busyRef.current) {
          onCancelRef.current();
        }
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) {
        return;
      }
      const items = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)
      );
      if (items.length === 0) {
        return;
      }
      const first = items[0];
      const last = items.at(-1) ?? first;
      const active = document.activeElement;
      if (!panelRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    // Scroll-lock while open, so the page can't scroll away underneath.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      returnTo?.focus?.();
    };
  }, [open]);

  if (!open) {
    return null;
  }

  // Portaled to <body>: the app shell's <main> carries a transform, which
  // makes it the containing block for position:fixed. Rendered inline, this
  // overlay would anchor to the DOCUMENT (opening off-viewport on scrolled
  // pages) and its z-index would be trapped below the floating docks.
  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: scrim click-away is a pointer-only convenience; keyboard and AT users dismiss via the dialog's own buttons.
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
        ref={panelRef}
        role="alertdialog"
      >
        <h2 className="font-bold text-[18px] text-foreground">{title}</h2>
        {body && (
          <p className="mt-2 text-[14.5px] text-muted-foreground leading-relaxed">
            {body}
          </p>
        )}
        {children}
        {/* data-slot names this the alert dialog's action row, the same way
            the shared ui/alert-dialog does, so the shared dialog-conventions
            contract (ux-contracts test 1) can gate this primitive too. Order
            is Cancel then confirm: stacked on phones the column-reverse puts
            the confirm on top; side-by-side it sits to the right. */}
        <div
          className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
          data-slot="alert-dialog-footer"
        >
          {/* The SAFE action takes initial focus, so a stray Enter never
              fires the destructive one (canon 01 §132). */}
          <WButton
            disabled={busy}
            onClick={onCancel}
            ref={cancelRef}
            variant="ghost"
          >
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
