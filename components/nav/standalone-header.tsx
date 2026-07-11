"use client";

import {
  CreditCard,
  Dumbbell,
  Loader2,
  LogOut,
  MenuIcon,
  Moon,
  Sparkles,
  Sun,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { useState } from "react";
import { useSignOut } from "@/hooks/use-sign-out";
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
import { SidebarTrigger } from "@/components/ui/sidebar";
import { headerLinks } from "@/lib/nav-links";
import { cn } from "@/lib/utils";

/**
 * Shared top navigation for the standalone (non-chat) pages — /today,
 * /nutrition, /progress, /account, /help. These pages live outside the chat
 * route group so they don't get the sidebar; without this they're islands you
 * can only leave by bouncing through the chat. The bar gives every standalone
 * page the same wordmark + cross-nav, with the current section highlighted.
 *
 * The link set comes from the shared `headerLinks` list (`lib/nav-links.ts`) so
 * it stays in lockstep with the chat sidebar (NAV-3).
 *
 * Desktop renders every item in a wrapping row (never a horizontal scrollbar,
 * regardless of how narrow the host page's max-width is). Mobile collapses the
 * links into a hamburger sheet so they're never pushed off-screen.
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
  const avatar = (
    <span
      className="size-6 shrink-0 rounded-full ring-1 ring-border/50"
      style={{
        background: `linear-gradient(135deg, oklch(0.35 0.08 ${hue}), oklch(0.25 0.05 ${hue + 40}))`,
      }}
    />
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label="Account menu"
          className="size-9 shrink-0 rounded-full p-0"
          size="icon"
          variant="ghost"
        >
          {avatar}
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
          onSelect={() =>
            setTheme(resolvedTheme === "dark" ? "light" : "dark")
          }
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
      aria-label="Chad — dashboard"
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
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const { setTheme, resolvedTheme } = useTheme();
  const { handleSignOut, signingOut } = useSignOut();

  const isActive = (href: string) =>
    active ? active === href : pathname === href;

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
    <nav className="mb-8 flex items-center gap-4 border-border border-b pb-3">
      {/* Left zone: the sidebar collapse toggle (the section links live in the
          left nav panel now, LAY-2) plus the wordmark on phones, where the
          sidebar doesn't render and the brand would otherwise vanish. */}
      <div className="flex flex-1 items-center gap-2">
        <SidebarTrigger className="hidden size-11 sm:inline-flex" />
        <div className="md:hidden">
          <Wordmark />
        </div>
      </div>

      {/* Right zone: account menu (desktop) + hamburger (mobile). */}
      <div className="flex flex-1 items-center justify-end gap-2">
        <div className="hidden sm:block">
          <AccountMenu />
        </div>

        {/* Mobile: hamburger → full-height sheet with the same links, stacked. */}
        <Sheet onOpenChange={setOpen} open={open}>
          <SheetTrigger asChild className="sm:hidden">
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
    </nav>
  );
}
