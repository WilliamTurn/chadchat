"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

/**
 * MOBILE BOTTOM SHEET (FIX-17, P2-D overlay platform), on vaul.
 *
 * Contract (standards/motion-interaction.md, overlay decision tree): the
 * phone surface for short forms and quick actions. Behaviors this file
 * guarantees for every sheet, so no consumer re-implements them:
 *   - 20px top radius (`rounded-t-sheet` token), drag handle, AND a visible
 *     close button (swipe alone is not a discoverable dismissal).
 *   - Safe-area bottom padding; the footer is sticky so the primary action
 *     stays reachable while the body scrolls.
 *   - No input auto-focused on open (owner law: nothing starts uninvited;
 *     the keyboard would cover the sheet). Focus lands on the sheet itself;
 *     escape and the focus trap come from the underlying dialog primitive.
 */

function Drawer({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />
}

function DrawerPortal({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Portal>) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Close>) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />
}

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/80 supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}

function DrawerContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const contentRef = React.useRef<HTMLDivElement>(null)
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        ref={contentRef}
        tabIndex={-1}
        // Never auto-focus a field on open (owner law; the keyboard would
        // cover the sheet). Focus the sheet itself so the trap starts inside.
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          contentRef.current?.focus()
        }}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-overlay flex-col rounded-t-sheet bg-background ring-1 ring-foreground/5 outline-none",
          className
        )}
        {...props}
      >
        {/* Drag handle: the visual cue that this sheet swipes down to dismiss. */}
        <div
          aria-hidden
          className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted"
        />
        {showCloseButton && (
          <DrawerClose asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="absolute top-2 right-2 z-10 min-h-11 min-w-11"
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </Button>
          </DrawerClose>
        )}
        <div className="flex flex-col gap-5 overflow-y-auto px-5 pt-5 pb-safe text-sm [&:has([data-slot=drawer-footer])]:pb-0">
          {children}
        </div>
      </DrawerPrimitive.Content>
    </DrawerPortal>
  )
}

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn("flex flex-col gap-2 pr-10", className)}
      {...props}
    />
  )
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      // Sticky primary action (motion-interaction overlay tree): pinned to
      // the visible bottom while the body scrolls, carrying the safe-area
      // padding itself so content never sits under the home indicator.
      className={cn(
        "sticky bottom-0 z-10 -mx-5 mt-1 flex flex-col gap-2 border-t border-border bg-background px-5 pt-3 pb-safe",
        className
      )}
      {...props}
    />
  )
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn("text-base leading-none font-medium", className)}
      {...props}
    />
  )
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  )
}

export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerOverlay,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
}
