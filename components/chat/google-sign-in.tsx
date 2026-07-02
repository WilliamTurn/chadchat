"use client";

import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";

import { signInWithGoogle } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";

// Official Google "G" mark (multicolor). Inlined so the button needs no asset.
function GoogleIcon() {
  return (
    <svg aria-hidden="true" height="16" viewBox="0 0 18 18" width="16">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}

function GoogleButton() {
  // useFormStatus reflects the parent <form>'s pending state during the
  // redirect to Google, so the button can disable itself immediately.
  const { pending } = useFormStatus();

  return (
    <Button
      className="w-full gap-2.5"
      disabled={pending}
      type="submit"
      variant="outline"
    >
      <GoogleIcon />
      Continue with Google
    </Button>
  );
}

/** "Continue with Google" button plus an "or" divider, shared by login/register. */
export function GoogleSignIn() {
  // Carry the paywall's original destination (e.g. /pricing?plan=pro from the
  // landing funnel, ACC-20) through the OAuth round-trip; the action validates.
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirectUrl");

  return (
    <div className="flex flex-col gap-4">
      <form action={signInWithGoogle.bind(null, redirectUrl)}>
        <GoogleButton />
      </form>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border/50" />
        <span className="text-xs text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border/50" />
      </div>
    </div>
  );
}
