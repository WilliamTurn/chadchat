"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

/**
 * Sign out from the pricing page. Without an escape hatch a logged-in member
 * with no active plan is stranded on /pricing (every app route redirects back
 * here), so this lets them log out / switch accounts. Returns to /login.
 */
export function LogoutButton() {
  return (
    <Button
      onClick={() => signOut({ redirectTo: "/login" })}
      size="sm"
      type="button"
      variant="ghost"
    >
      Log out
    </Button>
  );
}
