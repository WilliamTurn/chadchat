"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSignOut } from "@/hooks/use-sign-out";

/**
 * Sign out from the pricing page. Without an escape hatch a logged-in member
 * with no active plan is stranded on /pricing (every app route redirects back
 * here), so this lets them log out / switch accounts. Returns to /login.
 */
export function LogoutButton() {
  const { handleSignOut, signingOut } = useSignOut();

  return (
    <Button
      disabled={signingOut}
      onClick={() => handleSignOut("/login")}
      size="sm"
      type="button"
      variant="ghost"
    >
      {signingOut && <Loader2 className="size-4 animate-spin" />}
      {signingOut ? "Logging out..." : "Log out"}
    </Button>
  );
}
