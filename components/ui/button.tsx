import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-input/30 hover:bg-input/50 hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // default + lg heights read the W2 control-height tokens (canon
        // 03 #46: one control-height token per row) so buttons stay
        // locked to inputs/selects in mixed control rows.
        default:
          "h-[var(--control-h)] gap-1.5 px-3 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-6 gap-1 px-2.5 text-xs has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 gap-1 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        // lg is the touch-safe form size (FIX-38): 44px on phones per the
        // target-size law, 40px under a pointer (token drops at 48rem).
        lg: "h-[var(--control-h-lg)] gap-1.5 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-9",
        "icon-xs": "size-6 [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-11 md:size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  loading = false,
  children,
  disabled,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    /**
     * Pending-state contract (FIX-38, rewritten by S0c on the owner ruling of
     * 2026-07-23 to match canon 03 §22): the label STAYS VISIBLE and a spinner
     * joins it inline, the button disables, and aria-busy announces the state.
     * Canon 03 §22: "a button doing async work keeps its label and adds a
     * spinner; it never turns into a bare spinner. Replacing the label removes
     * the context exactly when it matters." The workouts-feature `WButton`
     * (components/workouts/v2/ui.tsx) renders the identical contract, so the
     * app has ONE pending state, not two. Not supported with asChild (Slot
     * requires a single child).
     *
     * Superseded: the original FIX-38 contract hid the label behind
     * `opacity-0` and overlaid a centered spinner. That bought zero layout
     * shift at the cost of telling a sighted member nothing about what was in
     * flight; the canon prices the context higher than the shift.
     */
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  if (asChild) {
    return (
      <Comp
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled}
        {...props}
      >
        {children}
      </Comp>
    )
  }

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {/* Inline, ahead of the label, so the label keeps its pixels and the
          member can still read what is in flight (canon 03 §22). */}
      {loading && <Spinner />}
      {children}
    </Comp>
  )
}

export { Button, buttonVariants }
