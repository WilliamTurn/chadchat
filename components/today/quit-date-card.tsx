import { Skull } from "lucide-react";
import Link from "next/link";
import {
  ModuleCard,
  ModuleFooter,
  ModuleHeader,
} from "@/components/today/module-card";
import { Button } from "@/components/ui/button";
import type { QuitPredictionContent } from "@/lib/quit/content";

/**
 * The Quit Date card on /today (FEAT-21). With a standing prediction it shows
 * the date on the record; without one it points at The Autopsy. Plain server
 * component: all interactivity lives on /quit-date. FEAT-22 turns this into
 * the live countdown.
 */
export function QuitDateCard({
  content,
}: {
  content: QuitPredictionContent | null;
}) {
  return (
    <ModuleCard glow="blood">
      <ModuleHeader
        icon={<Skull className="size-4" />}
        title="The Quit Date"
        tone="blood"
        viewHref={content ? "/quit-date" : undefined}
        viewLabel="Read the verdict"
      />
      {content ? (
        <>
          <p className="text-muted-foreground text-sm">
            Chad's prediction is on the record:
          </p>
          <p className="mt-1 font-display font-bold text-3xl tracking-tight">
            {content.dateLabel}
          </p>
          <p className="mt-1.5 text-muted-foreground text-sm">
            Day {content.dayCount}. {content.failureMode}.
          </p>
          <ModuleFooter status="Still here? Keep logging. Prove him wrong." />
        </>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">
            Every fitness app promises you will succeed. Chad reads your
            history of abandoned plans and names the exact day you quit this
            one. Then you prove him wrong.
          </p>
          <ModuleFooter>
            <Button asChild size="sm">
              <Link href="/quit-date">Take the autopsy</Link>
            </Button>
          </ModuleFooter>
        </>
      )}
    </ModuleCard>
  );
}
