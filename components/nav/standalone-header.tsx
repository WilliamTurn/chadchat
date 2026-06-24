"use client";

import {
  Camera,
  CreditCard,
  Dumbbell,
  HelpCircle,
  LayoutDashboard,
  LineChart,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Shared top navigation for the standalone (non-chat) pages — /today,
 * /nutrition, /progress, /account, /help. These pages live outside the chat
 * route group so they don't get the sidebar; without this they're islands you
 * can only leave by bouncing through the chat. The bar gives every standalone
 * page the same wordmark + cross-nav, with the current section highlighted.
 */
const LINKS: { href: string; label: string; icon: typeof LayoutDashboard }[] = [
  { href: "/today", label: "Dashboard", icon: LayoutDashboard },
  { href: "/", label: "Chat", icon: MessageSquare },
  { href: "/nutrition", label: "Nutrition", icon: Camera },
  { href: "/progress", label: "Progress", icon: LineChart },
  { href: "/account", label: "Account", icon: CreditCard },
  { href: "/help", label: "Help", icon: HelpCircle },
];

export function StandaloneHeader({ active }: { active?: string }) {
  const pathname = usePathname();

  return (
    <nav className="mb-8 flex items-center gap-4 border-border border-b pb-3">
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

      <div className="-mr-1 flex flex-1 items-center gap-1 overflow-x-auto">
        {LINKS.map((link) => {
          const isActive = active
            ? active === link.href
            : pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium text-sm transition-colors",
                isActive
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
    </nav>
  );
}
