import { Skull } from "lucide-react";
import Link from "next/link";
import {
  ModuleCard,
  ModuleFooter,
  ModuleHeader,
} from "@/components/today/module-card";
import { Button } from "@/components/ui/button";
import { todayAnchorInTz } from "@/lib/date";
import type { QuitPrediction } from "@/lib/db/schema";
import { parseQuitPredictionContent } from "@/lib/quit/content";
import { dayNumberOn, daysUntilQuit } from "@/lib/quit/lifecycle";

/**
 * The Quit Date card on /today. FEAT-21 put the prediction here; FEAT-22 made
 * it the live countdown ("Day 14 of 23. Chad still says you quit March 14.")
 * and gave the resolved states their moments: past-the-date (concession
 * pending), hit (the "I called it" callback + restart path), and the beaten
 * edge case. Plain server component: all interactivity lives on /quit-date.
 */
export function QuitDateCard({
  prediction,
  timezone,
}: {
  prediction: QuitPrediction | undefined;
  timezone: string | null | undefined;
}) {
  const content = prediction
    ? parseQuitPredictionContent(prediction.content)
    : null;

  if (!(prediction && content)) {
    return (
      <ModuleCard glow="blood">
        <ModuleHeader
          icon={<Skull className="size-4" />}
          title="The Quit Date"
          tone="blood"
        />
        <p className="text-muted-foreground text-sm">
          Every fitness app promises you will succeed. Chad reads your history
          of abandoned plans and names the exact day you quit this one. Then
          you prove him wrong.
        </p>
        <ModuleFooter>
          <Button asChild size="sm">
            <Link href="/quit-date">Take the autopsy</Link>
          </Button>
        </ModuleFooter>
      </ModuleCard>
    );
  }

  const todayAnchor = todayAnchorInTz(timezone);
  const dayNumber = dayNumberOn(
    todayAnchor,
    prediction.quitDate,
    content.dayCount
  );
  const pastDate = daysUntilQuit(todayAnchor, prediction.quitDate) < 0;

  return (
    <ModuleCard glow="blood">
      <ModuleHeader
        icon={<Skull className="size-4" />}
        title="The Quit Date"
        tone="blood"
        viewHref="/quit-date"
        viewLabel="Read the verdict"
      />
      {prediction.status === "hit" ? (
        <>
          <p className="text-muted-foreground text-sm">
            Chad called {content.dateLabel}. Then you went quiet, exactly like
            he said you would.
          </p>
          <p className="mt-1 font-display font-bold text-2xl tracking-tight">
            &ldquo;I called it. Is this really how it ends?&rdquo;
          </p>
          <ModuleFooter>
            <Button asChild size="sm">
              <Link href="/quit-date">Run it back</Link>
            </Button>
          </ModuleFooter>
        </>
      ) : prediction.status === "beaten" ? (
        // Normally a beaten row is instantly superseded by the reissued
        // prediction; this renders only if that follow-up write failed.
        <>
          <p className="text-muted-foreground text-sm">
            You outlived {content.dateLabel}. Chad owes you a harder date.
          </p>
          <ModuleFooter>
            <Button asChild size="sm">
              <Link href="/quit-date">Get the new date</Link>
            </Button>
          </ModuleFooter>
        </>
      ) : pastDate ? (
        <>
          <p className="text-muted-foreground text-sm">
            Chad said Day {content.dayCount}, {content.dateLabel}. That day
            came and went.
          </p>
          <p className="mt-1 font-display font-bold text-3xl tracking-tight">
            Day {dayNumber}. Still here.
          </p>
          <p className="mt-1.5 text-muted-foreground text-sm">
            Keep logging. He concedes on the record and sets a harder date.
          </p>
          <ModuleFooter status="Prove it wasn't a fluke." />
        </>
      ) : (
        <>
          <p className="font-display font-bold text-3xl tracking-tight">
            Day {dayNumber} of {content.dayCount}
          </p>
          <p className="mt-1.5 text-muted-foreground text-sm">
            Chad still says you quit {content.dateLabel}.{" "}
            {content.failureMode}.
          </p>
          <ModuleFooter status="Still here? Keep logging. Prove him wrong." />
        </>
      )}
    </ModuleCard>
  );
}
