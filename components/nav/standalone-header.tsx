"use client";

import {
  ChevronDown,
  CreditCard,
  Dumbbell,
  Loader2,
  LogOut,
  MenuIcon,
  Moon,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSignOut } from "@/hooks/use-sign-out";
import { headerLinks } from "@/lib/nav-links";
import { cn } from "@/lib/utils";

/**
 * The app's top bar for the standalone (non-chat) pages: a compact, sticky,
 * full-bleed strip flush with the top of the content area (the GitHub/Stripe
 * shell pattern), rendered once by `PageShell`, never by pages themselves.
 *
 * Desktop/tablet (md+): current section name on the left (section links live
 * in the left nav panel, LAY-2), account menu on the right. Phones (<md,
 * where the sidebar doesn't render): wordmark on the left, hamburger sheet
 * with the full link set on the right.
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
 * bounces authenticated users to /today) was stranded with no way out.
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
          className="h-9 shrink-0 gap-1 rounded-full px-1.5"
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
      className="flex shrink-0 items-center gap-2"
      href="/today"
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
  const section = headerLinks.find((link) => link.href === current) ?? null;
  const SectionIcon = section?.icon;

  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const { setTheme, resolvedTheme } = useTheme();
  const { handleSignOut, signingOut } = useSignOut();

  const isActive = (href: string) => (active ? active === href : path === href);

  // Mobile-sheet entrance: links slide in one after another when the sheet
  // opens (reduced-motion → instant). Variants live on the wrapper so they
  // replay every open.
  const sheetList = {
    hidden: {},
    show: {
      transition: {
        delayChildren: reduce ? 0 : 0.04,
        staggerChildren: reduce ? 0 : 0.05,
      },
    },
  };
  const sheetItem = reduce
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : { hidden: { opacity: 0, x: 12 }, show: { opacity: 1, x: 0 } };

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

      <div className="ml-auto flex items-center gap-2">
        <div className="hidden md:block">
          <AccountMenu />
        </div>

        {/* Phones: hamburger → full-height sheet with the same links, stacked. */}
        <Sheet onOpenChange={setOpen} open={open}>
          <SheetTrigger asChild className="md:hidden">
            <Button
              aria-label="Open menu"
              className="shrink-0"
              size="icon"
              variant="outline"
            >
              <MenuIcon className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent className="w-72 p-0" side="right">
            <div className="flex items-center gap-2 border-border border-b px-5 py-4">
              <span className="flex size-7 items-center justify-center rounded-lg bg-muted/60 ring-1 ring-border/50">
                <Dumbbell className="text-blood" size={14} strokeWidth={2.5} />
              </span>
              <SheetTitle className="font-display font-bold text-[15px] tracking-[0.14em]">
                CHAD
              </SheetTitle>
            </div>
            {/* min-h-0 + flex-1 + overflow-y-auto: the link list is taller than
                short phone viewports (13 links + pricing + theme + sign-out), so
                it must scroll inside the sheet or the bottom entries are
                unreachable (NAV-37). */}
            <motion.div
              animate="show"
              className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3"
              initial="hidden"
              variants={sheetList}
            >
              {headerLinks.map((link) => {
                const Icon = link.icon;
                const activeLink = isActive(link.href);
                return (
                  <motion.div key={link.href} variants={sheetItem}>
                    <SheetClose asChild>
                      <Link
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-3 font-medium text-base transition-colors",
                          activeLink
                            ? "bg-accent text-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        )}
                        href={link.href}
                      >
                        <Icon
                          className={cn("size-5", activeLink && "text-blood")}
                        />
                        <span>{link.label}</span>
                      </Link>
                    </SheetClose>
                  </motion.div>
                );
              })}
              <motion.div variants={sheetItem}>
                <SheetClose asChild>
                  <Link
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 font-medium text-base transition-colors",
                      isActive("/pricing")
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                    href="/pricing"
                  >
                    <Sparkles
                      className={cn(
                        "size-5",
                        isActive("/pricing") && "text-blood"
                      )}
                    />
                    <span>Plans &amp; pricing</span>
                  </Link>
                </SheetClose>
              </motion.div>
              <motion.div
                className="my-1 border-border border-t"
                variants={sheetItem}
              />
              <motion.button
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-left font-medium text-base text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
                onClick={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
                type="button"
                variants={sheetItem}
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="size-5" />
                ) : (
                  <Moon className="size-5" />
                )}
                <span>{`Toggle ${resolvedTheme === "dark" ? "light" : "dark"} mode`}</span>
              </motion.button>
              {/* The sheet stays open so the pending state is visible until
                  the sign-out redirect unloads the page (DS-15). */}
              <motion.button
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-left font-medium text-base text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground disabled:opacity-60"
                disabled={signingOut}
                onClick={() => handleSignOut("/")}
                type="button"
                variants={sheetItem}
              >
                {signingOut ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <LogOut className="size-5" />
                )}
                <span>{signingOut ? "Signing out..." : "Sign out"}</span>
              </motion.button>
            </motion.div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}
