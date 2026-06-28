"use client";

import { X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { resendVerificationEmail } from "@/app/(auth)/actions";
import { toast } from "./toast";

// Persist the dismissal so the soft nudge doesn't reappear on every navigation.
const DISMISS_KEY = "chad:verify-email-dismissed";

/**
 * Slim, branded, dismissible "verify your email" nudge (CHT-5).
 *
 * Was a full-width centered nag bar sitting in premium real estate with no way
 * to close it. Now a thin blood-accented row the user can dismiss (persisted to
 * localStorage); the soft verification policy means we never block them, so a
 * one-click dismiss is the right affordance.
 */
export function VerifyEmailBanner() {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") {
        setDismissed(true);
      }
    } catch {
      // localStorage unavailable (private mode) — just keep showing the nudge.
    }
  }, []);

  const onDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Best-effort persistence; dismissing for this session is still fine.
    }
  };

  const onResend = () => {
    startTransition(async () => {
      const result = await resendVerificationEmail();
      if (result.status === "success") {
        setSent(true);
        toast({
          type: "success",
          description: "Verification email sent. Check your inbox.",
        });
      } else if (result.status === "already_verified") {
        setSent(true);
      } else {
        toast({
          type: "error",
          description: "Couldn't send the email. Please try again.",
        });
      }
    });
  };

  if (dismissed) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 border-blood/15 border-b bg-blood/[0.06] px-4 py-1.5 text-[13px]">
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-blood" />
      <span className="text-muted-foreground">
        Verify your email to secure your account.
      </span>
      {sent ? (
        <span className="font-medium text-foreground">Email sent.</span>
      ) : (
        <button
          className="font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-50"
          disabled={isPending}
          onClick={onResend}
          type="button"
        >
          {isPending ? "Sending…" : "Resend link"}
        </button>
      )}
      <button
        aria-label="Dismiss"
        className="-mr-1 ml-auto shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-blood/10 hover:text-foreground"
        onClick={onDismiss}
        type="button"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
