"use client";

import { Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { LoaderIcon } from "@/components/chat/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared submit button for the auth screens (login / register / forgot / reset).
 *
 * Two upgrades over a plain <Button> (ACC-5):
 *  - a subtle hover-lift so the primary action feels alive, and
 *  - on a successful submit, the label gives way to a checkmark that springs in
 *    (a "pop") for the brief moment before the page redirects — so success
 *    registers visually instead of the form just sitting on a spinner.
 *
 * Pass `isSuccessful` only on screens that have a real success state before the
 * redirect (login, register, reset). Forgot-password swaps to a confirmation
 * view, so it just uses the pending spinner.
 */
export function AuthSubmitButton({
  isPending,
  isSuccessful = false,
  children,
}: {
  isPending: boolean;
  isSuccessful?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      className="relative overflow-hidden transition-transform hover:-translate-y-0.5"
      disabled={isPending || isSuccessful}
      type="submit"
    >
      {/* The label fades the instant we flip to the success check. */}
      <span
        className={cn(
          "flex items-center transition-opacity duration-150",
          isSuccessful && "opacity-0"
        )}
      >
        {children}
      </span>

      {isPending && !isSuccessful && (
        <span className="absolute right-4 animate-spin">
          <LoaderIcon />
        </span>
      )}

      <AnimatePresence>
        {isSuccessful && (
          <motion.span
            animate={{ scale: 1, opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center"
            initial={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
          >
            <Check className="size-4" strokeWidth={3} />
          </motion.span>
        )}
      </AnimatePresence>
    </Button>
  );
}
