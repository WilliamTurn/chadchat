"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { acceptTerms, declineAndSignOut } from "@/app/legal/actions";
import { Button } from "@/components/ui/button";

/**
 * The consent controls for the /legal interstitial (BLK-4): an unchecked-by-
 * default checkbox and a Continue button that stays disabled until it's
 * ticked. A quiet sign-out link is the honest exit for anyone who declines
 * (it bypasses the checkbox via formAction — declining needs no consent).
 */
export function LegalGateForm() {
  const [checked, setChecked] = useState(false);

  return (
    <form action={acceptTerms} className="mt-6 flex flex-col gap-4">
      <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-muted-foreground leading-snug">
        <input
          checked={checked}
          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
          onChange={(e) => setChecked(e.target.checked)}
          type="checkbox"
        />
        <span>
          I am 18 or older and agree to the Terms of Service and Privacy
          Policy
        </span>
      </label>
      <ContinueButton disabled={!checked} />
      <SignOutLink />
    </form>
  );
}

function ContinueButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button className="w-full" disabled={disabled || pending} type="submit">
      {pending ? "Saving..." : "Continue"}
    </Button>
  );
}

function SignOutLink() {
  const { pending } = useFormStatus();
  return (
    <button
      className="mx-auto text-muted-foreground text-xs underline-offset-4 hover:underline disabled:opacity-50"
      disabled={pending}
      formAction={declineAndSignOut}
      type="submit"
    >
      Sign out instead
    </button>
  );
}
