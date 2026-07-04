"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";

/** /nutrition?day=... for a past day; bare /nutrition for today. */
function dayHref(dayISO: string, todayISO: string): string {
  return dayISO === todayISO ? "/nutrition" : `/nutrition?day=${dayISO}`;
}

/**
 * The diary's day switcher (BT1-3): previous/next arrows plus a date picker,
 * the MFP/MacroFactor paging pattern. Navigation is URL-driven so a day view
 * is linkable and the back button walks back through days.
 */
export function DayNav({
  dayISO,
  todayISO,
  prevISO,
  nextISO,
}: {
  dayISO: string;
  todayISO: string;
  prevISO: string;
  // Null when viewing today (there is no tomorrow to page to).
  nextISO: string | null;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-1">
      <Button
        aria-label="Previous day"
        asChild
        className="size-8 text-muted-foreground"
        size="icon"
        variant="ghost"
      >
        <Link href={dayHref(prevISO, todayISO)}>
          <ChevronLeft className="size-4" />
        </Link>
      </Button>
      <DatePicker
        className="h-8 w-auto"
        max={todayISO}
        onChange={(next) => {
          if (next && next !== dayISO) {
            router.push(dayHref(next, todayISO));
          }
        }}
        value={dayISO}
      />
      <Button
        aria-label="Next day"
        asChild={nextISO != null}
        className="size-8 text-muted-foreground"
        disabled={nextISO == null}
        size="icon"
        variant="ghost"
      >
        {nextISO ? (
          <Link href={dayHref(nextISO, todayISO)}>
            <ChevronRight className="size-4" />
          </Link>
        ) : (
          <ChevronRight className="size-4" />
        )}
      </Button>
      {nextISO != null && (
        <Button asChild className="h-8" size="sm" variant="outline">
          <Link href="/nutrition">Today</Link>
        </Button>
      )}
    </div>
  );
}
