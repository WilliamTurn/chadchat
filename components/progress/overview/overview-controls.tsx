"use client";

/**
 * The Progress overview's header controls (FIX-32): the page-level range
 * control (writes ?range and re-renders the server sections; deep links and
 * back/forward restore per FIX-03) and the quick-add menu (doc 03: present
 * but secondary, links to each domain's OWN logger, one source of logger
 * destinations = LOG_ACTIONS).
 */

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LOG_ACTIONS } from "@/lib/nav-links";
import { cn } from "@/lib/utils";
import {
  OVERVIEW_RANGES,
  type OverviewRangeKey,
} from "@/components/progress/overview/range";

export function OverviewRangeControl({
  active,
}: {
  active: OverviewRangeKey;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5">
      {OVERVIEW_RANGES.map((r) => (
        <Button
          className={cn(
            "min-h-11 rounded-md px-2.5 font-medium text-xs sm:min-h-7",
            active === r.key
              ? "bg-card text-foreground shadow-sm hover:bg-card"
              : "text-muted-foreground hover:text-foreground"
          )}
          key={r.key}
          onClick={() =>
            router.replace(
              r.key === "1m" ? pathname : `${pathname}?range=${r.key}`,
              { scroll: false }
            )
          }
          size="sm"
          type="button"
          variant="ghost"
        >
          {r.label}
        </Button>
      ))}
    </div>
  );
}

export function QuickAddMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="min-h-11 sm:min-h-9" size="sm" variant="outline">
          <Plus aria-hidden className="size-4" />
          Log
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {LOG_ACTIONS.map((a) => (
          <DropdownMenuItem asChild key={a.href}>
            <Link className="min-h-11 cursor-pointer" href={a.href}>
              <a.icon aria-hidden className="size-4 text-muted-foreground" />
              {a.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
