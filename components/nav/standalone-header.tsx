"use client";

import {
  ChevronDown,
  CreditCard,
  Dumbbell,
  Loader2,
  LogOut,
  Moon,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSignOut } from "@/hooks/use-sign-out";
import { headerLinks, isRouteActive } from "@/lib/nav-links";

/**
 * The app's top bar for the standalone (non-chat) pages: a compact, sticky,
 * full-bleed strip flush with the top of the content area (the GitHub/Stripe
 * shell pattern), rendered once by `PageShell`, never by pages themselves.
 *
 * Desktop/tablet (md+): current section name on the left (section links live
 * in the left nav panel, LAY-2), account menu on the right. Phones (<md,
 * where the sidebar doesn't render): wordmark on the left, account menu on
 * the right. DEC-08 (owner, 2026-07-13): the phone hamburger sheet is GONE;
 * the bottom nav's More tab is the single overflow path for destinations, and
 * the account menu (visible at every width) keeps pricing, account, theme,
 * and sign-out reachable, so no destination is lost.
 */

function emailToHue(email: string): number {
  let hash = 0;
  for (const char of email) {
    hash = char.charCodeAt(0) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

/**
 * Account avatar + dropdown for the standalone pages. The chat view has the
 * sidebar user menu for this; the dashboard pages had no sign-out anywhere, so
 * a logged-in member who landed here (e.g. via the landing "Log in" link, which
 * bounces authenticated users to /home) was stranded with no way out.
 */
function AccountMenu() {
  const { data } = useSession();
  const { setTheme, resolvedTheme } = useTheme();
  const { handleSignOut, signingOut } = useSignOut();
  const email = data?.user?.email ?? "";
  const hue = emailToHue(email);
  // The member's initial inside the avatar circle (the Google-style letter
  // avatar): a bare colored dot reads as decoration, not as "your account".
  const avatar = (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-full font-semibold text-[11px] text-white ring-1 ring-border/60"
      style={{
        background: `linear-gradient(135deg, oklch(0.35 0.08 ${hue}), oklch(0.25 0.05 ${hue + 40}))`,
      }}
    >
      {email ? (
        email[0].toUpperCase()
      ) : (
        <UserRound className="size-3.5" strokeWidth={2.5} />
      )}
    </span>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Account menu"
          // min-h/w 44px at phone widths (FIX-19); visually the same 36px
          // pill at sm+ where pointer targets may be smaller.
          className="h-11 min-w-11 shrink-0 gap-1 rounded-full px-1.5 sm:h-9 sm:min-w-0"
          title="Account menu"
          variant="ghost"
        >
          {avatar}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {email ? (
          <>
            <DropdownMenuLabel className="truncate font-normal text-muted-foreground text-xs">
              {email}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem asChild>
          <Link className="cursor-pointer" href="/pricing">
            <Sparkles className="size-4" />
            Plans &amp; pricing
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link className="cursor-pointer" href="/account">
            <CreditCard className="size-4" />
            Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="size-4" />
          ) : (
            <Moon className="size-4" />
          )}
          {`Toggle ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          disabled={signingOut}
          onSelect={(event) => {
            // Keep the menu open so the pending state is visible until the
            // sign-out redirect unloads the page (DS-15).
            event.preventDefault();
            handleSignOut("/");
          }}
        >
          {signingOut ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <LogOut className="size-4" />
          )}
          {signingOut ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Wordmark() {
  return (
    <Link
      aria-label="Chad dashboard"
      className="flex min-h-11 shrink-0 items-center gap-2"
      href="/home"
    >
      <span className="flex size-7 items-center justify-center rounded-lg bg-muted/60 ring-1 ring-border/50">
        <Dumbbell className="text-blood" size={14} strokeWidth={2.5} />
      </span>
      <span className="font-display font-bold text-[15px] tracking-[0.14em]">
        CHAD
      </span>
    </Link>
  );
}

export function StandaloneHeader({ active }: { active?: string }) {
  // Current path, read after mount (the Cache Components precedent: a
  // usePathname call here sits outside the pages' Suspense boundaries).
  // Only a fallback for pages that don't pass `active`.
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => {
    setPath(window.location.pathname);
  }, []);
  const current = active ?? path;
  // Subroutes resolve to their section (FIX-20 selected state): /workouts/
  // history still shows "Workouts" in the bar. Exact match wins over prefix
  // so "/" (Chat) can never shadow another section.
  const section =
    headerLinks.find((link) => link.href === current) ??
    headerLinks.find(
      (link) => link.href !== "/" && isRouteActive(current, link.href)
    ) ??
    null;
  const SectionIcon = section?.icon;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-border border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:px-6">
      {/* Phones: the sidebar doesn't render, so the brand lives here. */}
      <div className="md:hidden">
        <Wordmark />
      </div>

      {/* Desktop/tablet: the current section, so the bar always says where
          you are (the brand is in the sidebar). */}
      {section && SectionIcon && (
        <div className="hidden min-w-0 items-center gap-2 md:flex">
          <SectionIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate font-medium text-sm">{section.label}</span>
        </div>
      )}

      {/* Every width (DEC-08): the account menu is the one header control.
          Destinations live in the left nav panel (md+) or the bottom nav's
          More tab (phones). */}
      <div className="ml-auto flex items-center gap-2">
        <AccountMenu />
      </div>
    </header>
  );
}
