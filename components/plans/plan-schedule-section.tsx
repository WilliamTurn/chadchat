import { Dumbbell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCalendarDayMs } from "@/lib/date";
import type { WeekAdherence } from "@/lib/plans/adherence";
import type { PlanScheduleView } from "@/lib/plans/schedule";
import type { CompletionEvent, UpNextVerdict } from "@/lib/plans/up-next";
import { formatPlanTarget } from "@/lib/validation/plan-days";

/**
 * The structured schedule on the plan detail page (FIX-28): the SAME
 * resolved schedule that powers /workouts session selection and adherence,
 * rendered read-only with per-session completion pairing and the
 * deterministic Up next verdict. Server component; renders nothing for
 * document-only plans (DEC-06: the raw document below is the full render,
 * nothing is blocked).
 */
export function PlanScheduleSection({
  view,
  completions,
  upNext,
  adherence,
}: {
  view: PlanScheduleView;
  completions: CompletionEvent[];
  upNext: UpNextVerdict | null;
  adherence: WeekAdherence | null;
}) {
  if (view.kind === "document") {
    return null;
  }
  const sessions = view.schedule.sessions;
  if (sessions.length === 0) {
    return null;
  }

  const lastBySession = new Map<string, number>();
  for (const c of completions) {
    const prev = lastBySession.get(c.planSessionId);
    if (prev === undefined || c.completedDayMs > prev) {
      lastBySession.set(c.planSessionId, c.completedDayMs);
    }
  }

  return (
    <section
      aria-labelledby="plan-schedule-heading"
      className="rounded-2xl border border-border bg-card p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          className="font-display font-semibold text-xl leading-tight"
          id="plan-schedule-heading"
        >
          Weekly schedule
        </h2>
        {adherence && adherence.plannedPerWeek > 0 && (
          <p className="text-muted-foreground text-sm">
            {adherence.completedThisWeek} of {adherence.plannedPerWeek}{" "}
            sessions done this week
          </p>
        )}
      </div>
      <p className="mt-1 text-muted-foreground text-sm">
        Start any session from the Workouts page; it logs against this plan.
      </p>

      <ol className="mt-5 flex flex-col gap-3">
        {sessions.map((session) => {
          const last =
            session.id !== null ? lastBySession.get(session.id) : undefined;
          const isNext =
            upNext !== null && upNext.session.position === session.position;
          return (
            <li
              className="rounded-xl border border-border bg-background/40 p-4"
              key={session.position}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Dumbbell aria-hidden className="size-4 text-blood" />
                <h3 className="font-medium text-sm">{session.name}</h3>
                {isNext && <Badge>Up next</Badge>}
                <span className="ml-auto text-muted-foreground text-xs">
                  {last !== undefined
                    ? `Last done ${formatCalendarDayMs(last)}`
                    : "Not done yet"}
                </span>
              </div>
              <ul className="mt-2 flex flex-col gap-1">
                {session.exercises.map((ex) => (
                  <li
                    className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
                    key={`${session.position}-${ex.name}`}
                  >
                    <span>{ex.name}</span>
                    <span className="text-muted-foreground">
                      {formatPlanTarget({
                        name: ex.name,
                        sets: ex.sets,
                        reps: ex.reps,
                        weight: ex.weight,
                        unit: ex.unit,
                        note: ex.note,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
