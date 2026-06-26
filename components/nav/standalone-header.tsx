"use client";

import {
  Camera,
  CreditCard,
  Dumbbell,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  MenuIcon,
  MessageSquare,
  Refrigerator,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Shared top navigation for the standalone (non-chat) pages — /today,
 * /nutrition, /progress, /account, /help. These pages live outside the chat
 * route group so they don't get the sidebar; without this they're islands you
 * can only leave by bouncing through the chat. The bar gives every standalone
 * page the same wordmark + cross-nav, with the current section highlighted.
 *
 * Desktop renders every item in a wrapping row (never a horizontal scrollbar,
 * regardless of how narrow the host page's max-width is). Mobile collapses the
 * links into a hamburger sheet so they're never pushed off-screen.
 */
const LINKS: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { href: "/today", label: "Dashboard", icon: LayoutDashboard },
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/workouts", label: "Workouts", icon: Dumbbell },
  { href: "/nutrition", label: "Nutrition", icon: Camera },
  { href: "/meal-plan", label: "Meal Plan", icon: UtensilsCrossed },
  { href: "/kitchen", label: "Kitchen", icon: Refrigerator },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/account", label: "Account", icon: CreditCard },
  { href: "/help", label: "Help", icon: HelpCircle },
];

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

  const isActive = (href: string) =>
    active ? active === href : pathname === href;

  return (
    <nav className="mb-8 flex items-center justify-between gap-4 border-border border-b pb-3 sm:items-start">
      <Wordmark />

      {/* Desktop / tablet: every link in a wrapping row — no scrollbar ever. */}
      <div className="hidden flex-1 flex-wrap items-center justify-end gap-x-0.5 gap-y-1 sm:flex">
        {LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 font-medium text-sm transition-colors",
                isActive(link.href)
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
              href={link.href}
              key={link.href}
            >
              <Icon className="size-4" />
              <span>{link.label}</span>
            </Link>
          );
        })}
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
          <div className="flex flex-col gap-1 p-3">
            {LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <SheetClose asChild key={link.href}>
                  <Link
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 font-medium text-base transition-colors",
                      isActive(link.href)
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    )}
                    href={link.href}
                  >
                    <Icon className="size-5" />
                    <span>{link.label}</span>
                  </Link>
                </SheetClose>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
