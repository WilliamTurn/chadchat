"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { type ComponentProps, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Password field with a show/hide toggle — the standard pro pattern (mirrors
 * the reference: masked dots + an eye button on the right). It's a thin wrapper
 * over our own <Input> so it inherits the app's field styling exactly, rather
 * than being hand-rolled from a bare <input>. Used on every password field
 * (sign in, sign up, confirm, reset).
 */
export function PasswordInput({
  className,
  ...props
}: Omit<ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        className={cn("pr-10", className)}
        type={visible ? "text" : "password"}
        {...props}
      />
      <button
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-4xl text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
        onClick={() => setVisible((v) => !v)}
        // Keep the toggle out of the tab order so keyboard users flow
        // straight from the field to the next control.
        tabIndex={-1}
        type="button"
      >
        {visible ? (
          <EyeOffIcon className="size-4" />
        ) : (
          <EyeIcon className="size-4" />
        )}
      </button>
    </div>
  );
}
