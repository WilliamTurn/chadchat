"use client";

import { useState, useTransition } from "react";

import { resendVerificationEmail } from "@/app/(auth)/actions";
import { toast } from "./toast";

export function VerifyEmailBanner() {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

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

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-border/50 border-b bg-muted/40 px-4 py-2 text-center text-[13px] text-muted-foreground">
      <span>Verify your email to secure your account.</span>
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
    </div>
  );
}
