"use client";

// The options-menu primitive (S6 rework): ONE action-list API, two
// presentations, decided once here so every caller inherits it (canon 02
// §17.171: the same task uses the same container pair everywhere).
//
//   · Phones (<768px, the house useIsMobile threshold): a bottom sheet, the
//     mainstream mobile pattern, with a LIGHT scrim (no blur) so the page
//     behind stays legible (owner order S6 #1; menu-weight overlays take the
//     light tier, decision-logged; confirmations keep the dark house scrim).
//   · Desktop: a dropdown menu anchored at the ⋯ trigger (Radix), never a
//     bottom sheet pinned across a 1440px viewport.
//
// Labeled actions only, no bare icons, no hidden gestures. Rows may opt out
// of dismiss-on-select (keepOpen) for act-in-place controls like Move up /
// Move down, which reorder live behind the open menu (owner ruling
// 2026-07-24).

import { ChevronRight, X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";

export interface SheetAction {
  label: string;
  /** Optional second line explaining exactly what this does. Shown at BOTH
   * widths (comp 07 §1: content parity; owner order S6 #2 rewrote these,
   * it did not delete them). */
  hint?: string;
  icon?: ReactNode;
  danger?: boolean;
  selected?: boolean;
  /** Act-in-place row: selecting runs the action and the menu STAYS OPEN
   * (Move up / Move down; the user selects repeatedly without reopening). */
  keepOpen?: boolean;
  /** Disabled with its reason carried in the hint (canon 01 §6: the visible
   * text explains why; never a silent dead control). */
  disabled?: boolean;
  /** Draw a separator above this row: before the destructive group (canon 01
   * §134) and after the act-in-place group (comp 08 §19: a destructive row
   * never sits directly under a repeatedly-pressed control). */
  dividerBefore?: boolean;
  /** This row leaves the current screen: it gets a trailing chevron (comp 08
   * #39/#40: chevron-right = navigates), so leaving rows are distinguishable
   * from act-in-place and overlay-opening rows. */
  navigates?: boolean;
  onSelect: () => void;
}

/** Everything inside the panel a keyboard can land on (same list as the
 * sibling ConfirmDialog, whose focus contract this sheet matches). */
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function MobileSheet({
  open,
  title,
  subtitle,
  actions,
  onClose,
  intro,
  liveMessage,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  actions: SheetAction[];
  onClose: () => void;
  intro?: ReactNode;
  liveMessage?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus contract, matched to the sibling ConfirmDialog (canon 01 §89/§93,
  // WCAG 2.1.2; the pre-S6 sheet had none of this): opening moves focus
  // INSIDE onto the panel (never an action row, so nothing fires from a
  // stray Enter), Tab cycles within, Escape closes, and closing returns
  // focus to the ⋯ trigger that opened it.
  useEffect(() => {
    if (!open) {
      return;
    }
    const returnTo = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCloseRef.current();
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
  // sheet would anchor to the DOCUMENT bottom (off-viewport on scrolled
  // pages, the WKT-9 bug) instead of the viewport bottom.
  return createPortal(
    // biome-ignore lint/a11y/noStaticElementInteractions: scrim click-away is a pointer-only convenience; keyboard and AT users dismiss via the sheet's own controls.
    <div
      // Light scrim, no blur (S6 #1): a menu must not black out the page it
      // acts on; the member keeps their place. Confirmations keep bg-black/70.
      className="fixed inset-0 z-[75] flex items-end justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="presentation"
    >
      <div
        aria-label={title}
        aria-modal="true"
        className="w-full max-w-[520px] animate-in rounded-t-3xl border border-input border-b-0 bg-popover px-4 pt-4 shadow-[0_-24px_64px_rgba(0,0,0,0.5)] outline-none duration-300 slide-in-from-bottom-6"
        ref={panelRef}
        // role=dialog, not menu: a container holding a heading and a close
        // button is not a menu widget (the pre-S6 role="menu" was invalid).
        role="dialog"
        style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
        tabIndex={-1}
      >
        {/* px-3, the rows' inset: the title shares the icon spine instead of
            adding a fourth left edge (composition audit minor; comp 08 #47). */}
        <div className="mb-3 flex items-start justify-between gap-3 px-3">
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
        {/* Reference content sits ABOVE the actions, flat on the surface
            (composition audit F-1; comp 04 §1: title then supporting content
            then actions; 08 #18: the destructive row stays last). */}
        {intro}
        <div className="flex max-h-[60dvh] flex-col gap-0.5 overflow-y-auto">
          {actions.map((action) => (
            <div className="contents" key={action.label}>
              {action.dividerBefore && (
                <div aria-hidden className="my-1 h-px shrink-0 bg-border/70" />
              )}
              <button
                // aria-disabled, not native disabled (flow audit F-4): a Move
                // row that disables at the end of the range must keep the
                // focus it holds, or the keyboard user is dropped to <body>
                // mid-sheet (canon 01 §89). shrink-0: rows in the scrolling
                // flex column must never be compressed into each other when
                // the list exceeds the sheet's max height; it scrolls instead.
                aria-disabled={action.disabled || undefined}
                className={`flex min-h-[52px] w-full shrink-0 cursor-pointer items-start gap-3 rounded-xl px-3 py-3.5 text-left transition ${
                  action.disabled ? "cursor-default opacity-50" : ""
                } ${
                  action.danger
                    ? "text-blood hover:bg-blood/10"
                    : action.selected
                      ? "bg-[var(--go)]/12 text-foreground"
                      : "text-foreground hover:bg-muted/60"
                }`}
                onClick={() => {
                  if (action.disabled) {
                    return;
                  }
                  action.onSelect();
                  if (!action.keepOpen) {
                    onClose();
                  }
                }}
                type="button"
              >
                {/* items-start + a top nudge locks the icon to its LABEL's
                    line, never the centroid of a wrapping hint block
                    (composition audit F-3; comp 08 #44). The empty spacer
                    keeps iconless rows on the shared label edge (F-2; comp
                    08 #47: one spine, indentation never from icon variety). */}
                <span aria-hidden className="mt-px size-4.5 shrink-0 opacity-80">
                  {action.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-[15px]">
                    {action.label}
                  </span>
                  {action.hint && (
                    <span
                      className={`block text-[12.5px] ${
                        action.danger
                          ? "text-blood/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {action.hint}
                    </span>
                  )}
                </span>
                {action.navigates && (
                  <ChevronRight
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  />
                )}
                {action.selected && (
                  <span className="shrink-0 font-bold text-[12px] text-[var(--go)]">
                    Current
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>
        {/* Position feedback for act-in-place rows (canon 03 §137: calm,
            polite, announces the settled result). */}
        <div aria-live="polite" className="sr-only">
          {liveMessage}
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * The responsive options menu. `trigger` is the caller's own button (it keeps
 * its onClick that opens the menu); on desktop it is additionally wrapped as
 * the Radix trigger so the menu anchors to it and focus returns to it on
 * close automatically.
 */
export function ActionMenu({
  trigger,
  title,
  subtitle,
  actions,
  intro,
  open,
  onOpenChange,
  liveMessage,
  align = "end",
}: {
  trigger: ReactNode;
  title: string;
  subtitle?: string;
  actions: SheetAction[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** Optional FLAT reference content between the header and the rows (e.g.
   * plate math). Never a box (comp 01 §4: an inert text block earns no
   * container; 04 #16: content sits directly on the overlay surface), and
   * never below the actions (the destructive row stays last, 08 #18). */
  intro?: ReactNode;
  /** Politely announced to screen readers while open (Move up/down feedback). */
  liveMessage?: string;
  /** Desktop anchoring. "end" for trailing-edge ⋯ triggers; "start" for a
   * leading-edge trigger like the set number, so the menu hangs over its
   * own row instead of the sidebar (placement audit F-4; comp 08 §21). */
  align?: "start" | "end";
}) {
  const isMobile = useIsMobile();
  // The moment the last act-in-place row fired (flow audit F-3): a move
  // reorders the list live, the anchored menu follows its trigger to the
  // card's new slot, and the user's next click lands where the menu WAS.
  // Within a short grace window that stranded click is a mis-aim caused by
  // us moving the control (canon 01 §15), so it must not dismiss the menu.
  const lastKeepOpenAt = useRef(0);

  if (isMobile) {
    return (
      <>
        {trigger}
        <MobileSheet
          actions={actions}
          intro={intro}
          liveMessage={liveMessage}
          onClose={() => onOpenChange(false)}
          open={open}
          subtitle={subtitle}
          title={title}
        />
      </>
    );
  }

  return (
    <DropdownMenu modal onOpenChange={onOpenChange} open={open}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        // w-auto overrides the shared content's trigger-width sizing, which
        // would produce a 44px-wide menu from a 44px kebab trigger. Popover
        // cap ~360px (comp 04 §48); collision handling stays on.
        className="w-auto min-w-64 max-w-80 p-1.5"
        collisionPadding={12}
        onInteractOutside={(e) => {
          if (Date.now() - lastKeepOpenAt.current < 1200) {
            e.preventDefault();
          }
        }}
        sideOffset={6}
      >
        {/* The header keeps information parity with the phone sheet
            (comp 07 §1): same title, same position subtitle. Titles wrap in
            full, never clipped (comp 04 §2). */}
        <div className="px-3 pt-2 pb-1.5">
          <div className="font-bold text-foreground text-sm">{title}</div>
          {subtitle && (
            <div className="mt-0.5 text-muted-foreground text-xs">
              {subtitle}
            </div>
          )}
        </div>
        <DropdownMenuSeparator />
        {intro}
        {actions.map((action) => (
          <div className="contents" key={action.label}>
            {action.dividerBefore && <DropdownMenuSeparator />}
            <DropdownMenuItem
              // aria-disabled, not the Radix disabled prop (flow audit F-4):
              // a Move row that disables at the end of the range keeps its
              // roving focus instead of dropping the keyboard user to <body>.
              aria-disabled={action.disabled || undefined}
              className={`cursor-pointer items-start py-2 ${
                action.disabled ? "cursor-default opacity-50" : ""
              } ${
                action.danger
                  ? "text-blood"
                  : action.selected
                    ? "bg-emerald-500/10"
                    : ""
              }`}
              onSelect={(e) => {
                if (action.disabled) {
                  e.preventDefault();
                  return;
                }
                // keepOpen rows act in place: the menu stays open and roving
                // focus stays on the row, so repeated Enter keeps moving
                // (Radix-documented preventDefault contract).
                if (action.keepOpen) {
                  e.preventDefault();
                  lastKeepOpenAt.current = Date.now();
                }
                action.onSelect();
              }}
              variant={action.danger ? "destructive" : "default"}
            >
              {/* Same spine + chevron grammar as the phone sheet (F-2/F-8). */}
              <span aria-hidden className="mt-0.5 size-4.5 shrink-0 opacity-80">
                {action.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-sm">
                  {action.label}
                </span>
                {action.hint && (
                  <span
                    className={`block text-xs ${
                      action.danger ? "text-blood/70" : "text-muted-foreground"
                    }`}
                  >
                    {action.hint}
                  </span>
                )}
              </span>
              {action.navigates && (
                <ChevronRight
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                />
              )}
              {action.selected && (
                <span className="shrink-0 font-bold text-emerald-600 text-xs dark:text-emerald-400">
                  Current
                </span>
              )}
            </DropdownMenuItem>
          </div>
        ))}
        <div aria-live="polite" className="sr-only">
          {liveMessage}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
