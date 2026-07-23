"use client";

// Bottom action sheet: labeled actions only, no bare icons, no hidden
// gestures. Used for per-exercise and per-set menus in the player.

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface SheetAction {
  label: string;
  /** Optional second line explaining exactly what this does. */
  hint?: string;
  icon?: ReactNode;
  danger?: boolean;
  selected?: boolean;
  onSelect: () => void;
}

export function ActionSheet({
  open,
  title,
  subtitle,
  actions,
  onClose,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  actions: SheetAction[];
  onClose: () => void;
  /** Optional custom content below the actions (e.g. plate math). */
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
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
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  // Portaled to <body>: the app shell's <main> carries a transform, which
  // makes it the containing block for position:fixed. Rendered inline, this
  // sheet would anchor to the DOCUMENT bottom (off-viewport on scrolled
  // pages, the WKT-9 bug) instead of the viewport bottom.
  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: scrim click-away is a pointer-only convenience; keyboard and AT users dismiss via the sheet's own controls.
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        aria-label={title}
        className="w-full max-w-[520px] animate-in rounded-t-3xl border border-input border-b-0 bg-popover px-4 pt-4 shadow-[0_-24px_64px_rgba(0,0,0,0.5)] duration-300 slide-in-from-bottom-6"
        role="menu"
        style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
      >
        <div className="mb-3 flex items-start justify-between gap-3 px-1">
          <div className="min-w-0">
            <h2 className="truncate font-bold text-[16.5px] text-foreground">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>
          <button
            aria-label="Close menu"
            className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
            onClick={onClose}
            type="button"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="flex max-h-[60dvh] flex-col gap-0.5 overflow-y-auto">
          {actions.map((action) => (
            <button
              className={`flex min-h-[52px] w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                action.danger
                  ? "text-blood hover:bg-blood/10"
                  : action.selected
                    ? "bg-[var(--go)]/12 text-foreground"
                    : "text-foreground hover:bg-muted/60"
              }`}
              key={action.label}
              onClick={() => {
                action.onSelect();
                onClose();
              }}
              role="menuitem"
              type="button"
            >
              {action.icon && (
                <span className="shrink-0 opacity-80">{action.icon}</span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-[15px]">
                  {action.label}
                </span>
                {action.hint && (
                  <span
                    className={`block text-[12.5px] ${
                      action.danger ? "text-blood/70" : "text-muted-foreground"
                    }`}
                  >
                    {action.hint}
                  </span>
                )}
              </span>
              {action.selected && (
                <span className="shrink-0 font-bold text-[12px] text-[var(--go)] uppercase tracking-wide">
                  Current
                </span>
              )}
            </button>
          ))}
        </div>
        {footer}
      </div>
    </div>,
    document.body
  );
}
