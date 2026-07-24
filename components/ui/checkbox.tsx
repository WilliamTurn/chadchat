"use client";

import { Check } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

/** The one checkbox (composition canon 04 #21, 03 #7): a form option that
 *  applies when the surface saves. Checked fill is the go/save hue (owner
 *  color rule 2026-07-19), focus ring matches ui/input.tsx so every control
 *  on a form shares one focus treatment (composition canon 03 #48). The
 *  after: pseudo grows the hit area to 44x44 (target-size law) while the
 *  visual box stays 20px, same technique as ui/switch.tsx. */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md border border-input bg-input/30 transition-colors outline-none after:absolute after:-inset-3 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-checked:border-[var(--go)] aria-checked:bg-[var(--go)] aria-checked:text-[var(--bg)] aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <Check aria-hidden className="size-3.5" strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
