"use client";

import { signOut } from "next-auth/react";
import { useState } from "react";

/**
 * signOut() is a server round-trip + full redirect with zero built-in
 * feedback, so a click on "Sign out" looked dead for a second or two (DS-15).
 * Every sign-out control uses this to flip into a spinner + "Signing out..."
 * state the moment it's clicked. The state never resets — the redirect
 * unloads the page.
 */
export function useSignOut() {
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = (redirectTo: string) => {
    if (signingOut) {
      return;
    }
    setSigningOut(true);
    signOut({ redirectTo });
  };

  return { handleSignOut, signingOut };
}
