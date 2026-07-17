"use client";

// Client sections of the Workouts home: the workout-in-progress resume card,
// the "My Workouts" template list (start / edit / delete), Chad's training
// plan days (startable the same way), and the empty freestyle start.

import {
  ChevronRight,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { removeTemplate, syncPlanDays } from "@/app/workouts/actions";
import {
  type PlanScheduleSession,
  sessionToPlanDay,
} from "@/lib/plans/schedule";
import type { TemplateExercise } from "@/lib/validation/workout-templates";
import type { LastExerciseLog, WeightUnit } from "@/lib/workouts/stats";
import {
  type CustomExerciseData,
  findInCatalog,
  mergeCatalog,
} from "./catalog";
import { ConfirmDialog } from "./confirm";
import { formatDay, sessionEngaged } from "./format";
import {
  emptySession,
  sessionFromPlanDay,
  sessionFromTemplate,
} from "./session-factory";
import { useWorkouts } from "./store";
import { Eyebrow, Pill, WButton, WCard } from "./ui";

export type TemplateData = {
  id: string;
  name: string;
  exercises: TemplateExercise[];
  lastPerformedAt: number | null;
};

const INTRO_KEY = "chad-workouts-intro-dismissed";

export function IntroCard() {
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(INTRO_KEY) === "1");
    } catch {
      // Storage unavailable, keep the card hidden rather than flashing it.
    }
  }, []);
  if (dismissed) {
    return null;
  }
  const steps = [
    {
      title: "Build a workout",
      body: "A workout is your plan: which exercises, how many sets, what reps.",
    },
    {
      title: "Start it at the gym",
      body: "Press Start, then check off each set as you finish it. Your last numbers are already filled in.",
    },
    {
      title: "It saves to your history",
      body: "When you press Finish, the session is logged with your records and progress, and Chad sees it.",
    },
  ];
  return (
    <WCard className="relative mb-6 overflow-hidden p-5">
      <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-blood/[0.07] blur-2xl" />
      <button
        aria-label="Dismiss this explainer"
        className="absolute top-2.5 right-2.5 flex size-11 cursor-pointer items-center justify-center rounded-xl text-muted-foreground/70 transition hover:bg-muted/60 hover:text-foreground"
        onClick={() => {
          try {
            localStorage.setItem(INTRO_KEY, "1");
          } catch {
            // Fine, it just reappears next visit.
          }
          setDismissed(true);
        }}
        type="button"
      >
        <X aria-hidden className="size-5" />
      </button>
      <Eyebrow>How this works</Eyebrow>
      {/* Steps go three-across on desktop (LAY-1); explicit grid-cols-1 +
          min-w-0 children so nothing sizes to max-content on phones. */}
      <ol className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {steps.map((step, i) => (
          <li className="flex min-w-0 gap-3.5" key={step.title}>
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-blood-dim font-bold font-mono text-[13px] text-blood">
              {i + 1}
            </span>
            <div>
              <div className="font-bold text-[15px] text-foreground">
                {step.title}
              </div>
              <p className="mt-0.5 text-[13.5px] text-muted-foreground leading-relaxed">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </WCard>
  );
}

export function ResumeCard() {
  const { session, ready } = useWorkouts();
  if (!(ready && session)) {
    return null;
  }
  return (
    <Link className="mb-6 block" href="/workouts/session">
      <WCard className="border-[var(--go)]/40 p-5 transition hover:brightness-110">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-[var(--go)] text-[var(--bg)]">
            <Play aria-hidden className="size-6 fill-current" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-[12px] text-[var(--go)] uppercase tracking-wider">
              Workout in progress
            </div>
            <div className="truncate font-bold text-[17px] text-foreground">
              {session.name}
            </div>
          </div>
          <ChevronRight aria-hidden className="size-5 shrink-0 text-[var(--go)]" />
        </div>
      </WCard>
    </Link>
  );
}

function TemplateCard({
  template,
  lastSets,
  unit,
}: {
  template: TemplateData;
  lastSets: Record<string, LastExerciseLog>;
  unit: WeightUnit;
}) {
  const { session, startSession, ready } = useWorkouts();
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const busy = sessionEngaged(session);

  const names = template.exercises.map((e) => e.name);
  const preview = names.slice(0, 3).join(" · ");
  const more = names.length - 3;
  // formatDay reads the wall clock, skip it until mounted (`ready`) so
  // prerendering never touches Date.now().
  const lastDone =
    ready && template.lastPerformedAt
      ? formatDay(template.lastPerformedAt)
      : null;
  const lastDoneLabel =
    lastDone === "Today" || lastDone === "Yesterday"
      ? lastDone.toLowerCase()
      : lastDone;

  return (
    // h-full + flex-col so cards fill their grid row and the Start button
    // bottoms out at a consistent line across the row (LAY-1 card grid).
    <WCard className="flex h-full min-w-0 flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-bold text-[18px] text-foreground">
            {template.name}
          </h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {template.exercises.length}{" "}
            {template.exercises.length === 1 ? "exercise" : "exercises"}
            {lastDoneLabel && ` · Last done ${lastDoneLabel}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            aria-label={`Edit the ${template.name} workout`}
            className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
            onClick={() => router.push(`/workouts/${template.id}/edit`)}
            type="button"
          >
            <Pencil aria-hidden className="size-[18px]" />
          </button>
          <button
            aria-label={`Delete the ${template.name} workout`}
            className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition hover:bg-blood/10 hover:text-blood"
            onClick={() => setConfirmingDelete(true)}
            type="button"
          >
            <Trash2 aria-hidden className="size-[18px]" />
          </button>
        </div>
      </div>

      {names.length > 0 && (
        <p className="mt-2.5 line-clamp-1 text-[13.5px] text-muted-foreground/80">
          {preview}
          {more > 0 && ` + ${more} more`}
        </p>
      )}

      <div className="mt-auto pt-4">
        <WButton
          className="w-full"
          disabled={busy}
          onClick={() => {
            startSession(sessionFromTemplate(template, lastSets, unit));
            router.push("/workouts/session");
          }}
          size="lg"
          variant="primary"
        >
          <Play aria-hidden className="size-5 fill-current" />
          {busy
            ? "Finish your current workout first"
            : `Start ${template.name}`}
        </WButton>
      </div>

      <ConfirmDialog
        body="The workout (your plan) will be deleted. Sessions you already logged with it stay in your history."
        busy={deleting}
        confirmLabel="Delete workout"
        destructive
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={async () => {
          setDeleting(true);
          const result = await removeTemplate(template.id);
          setDeleting(false);
          setConfirmingDelete(false);
          if (!result.ok) {
            toast.error(result.error ?? "Couldn't delete that workout.");
            return;
          }
          router.refresh();
        }}
        open={confirmingDelete}
        title={`Delete "${template.name}"?`}
      />
    </WCard>
  );
}

export function MyWorkoutsSection({
  templates,
  lastSets,
  unit,
}: {
  templates: TemplateData[];
  lastSets: Record<string, LastExerciseLog>;
  unit: WeightUnit;
}) {
  const router = useRouter();
  return (
    <section aria-labelledby="my-workouts-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2
            className="font-black font-display text-[17px] text-foreground uppercase tracking-wide"
            id="my-workouts-heading"
          >
            My Workouts
          </h2>
          <p className="text-[12.5px] text-muted-foreground/80">
            Reusable workout plans you build once and run any gym day
          </p>
        </div>
        <WButton onClick={() => router.push("/workouts/new")} size="sm">
          <Plus aria-hidden className="size-4" />
          New workout
        </WButton>
      </div>

      {templates.length === 0 ? (
        <WCard className="p-8 text-center">
          <p className="font-bold text-[16px] text-foreground">
            Workouts you build will appear here
          </p>
          <p className="mx-auto mt-1.5 max-w-[320px] text-[13.5px] text-muted-foreground leading-relaxed">
            A workout is your plan: the exercises, sets, and reps you intend
            to do. Build it once, then start it every time you train.
          </p>
          <WButton
            className="mt-5"
            onClick={() => router.push("/workouts/new")}
            size="lg"
            variant="primary"
          >
            <Plus aria-hidden className="size-5" />
            Build your first workout
          </WButton>
        </WCard>
      ) : (
        /* Multi-column workout-card grid on desktop (LAY-1); explicit
           grid-cols-1 so the implicit column never sizes to max-content.
           Columns start at lg, not md: at 768 the sidebar leaves ~512px of
           content and half-width cards wrap the Start button + clip text. */
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              lastSets={lastSets}
              template={template}
              unit={unit}
            />
          ))}
          {/* Dashed ghost tile (the Linear/Notion pattern) so a short row
              never strands empty grid columns on desktop. */}
          <button
            className="hidden min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-border border-dashed text-muted-foreground transition hover:border-input hover:bg-muted/30 hover:text-foreground lg:flex"
            onClick={() => router.push("/workouts/new")}
            type="button"
          >
            <Plus aria-hidden className="size-6" />
            <span className="font-semibold text-[15px]">New workout</span>
          </button>
        </div>
      )}
    </section>
  );
}

export function ChadPlanSection({
  planId,
  planTitle,
  sessions,
  customExercises,
  lastSets,
  unit,
}: {
  planId: string;
  planTitle: string;
  /** The resolved plan schedule (FIX-28); null = text-only plan, show the
   * one-tap extraction. Session ids ride along so saving the workout records
   * a completion event against the prescribed session. */
  sessions: PlanScheduleSession[] | null;
  customExercises: CustomExerciseData[];
  lastSets: Record<string, LastExerciseLog>;
  unit: WeightUnit;
}) {
  const { session, startSession } = useWorkouts();
  const router = useRouter();
  const [syncing, startSync] = useTransition();
  const busy = sessionEngaged(session);
  const catalog = mergeCatalog(customExercises);

  function startDay(planSessionRow: PlanScheduleSession) {
    const day = sessionToPlanDay(planSessionRow);
    const sessionFromDay = sessionFromPlanDay(
      day,
      (name) => {
        const found = findInCatalog(catalog, name);
        return {
          muscleGroup: found?.muscleGroup ?? null,
          equipment: found?.equipment ?? null,
          kind: found?.kind ?? null,
        };
      },
      lastSets,
      unit,
      planSessionRow.id
        ? {
            planId,
            planSessionId: planSessionRow.id,
            sessionName: planSessionRow.name,
          }
        : null
    );
    startSession(sessionFromDay);
    router.push("/workouts/session");
  }

  return (
    <section aria-labelledby="chad-plan-heading" className="mt-8">
      <div className="mb-3">
        <h2
          className="flex items-center gap-2 font-black font-display text-[17px] text-foreground uppercase tracking-wide"
          id="chad-plan-heading"
        >
          <Sparkles aria-hidden className="size-4 text-muted-foreground" />
          Chad&apos;s Training Plan
        </h2>
        <p className="text-[12.5px] text-muted-foreground/80">
          {planTitle}, written by Chad. Start any day to run it.
        </p>
      </div>

      {sessions ? (
        /* Plan days go multi-column on desktop, same card grid as My
           Workouts (LAY-1); explicit grid-cols-1 + min-w-0 cards. Columns
           start at lg (768 content is too narrow beside the sidebar). */
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {sessions.map((day) => (
            <WCard className="flex h-full min-w-0 flex-col p-5" key={day.name}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-[16.5px] text-foreground">
                    {day.name}
                  </h3>
                  <p className="mt-0.5 line-clamp-1 text-[13px] text-muted-foreground">
                    {day.exercises.map((e) => e.name).join(" · ")}
                  </p>
                </div>
                <Pill className="shrink-0" tone="neutral">
                  {day.exercises.length}{" "}
                  {day.exercises.length === 1 ? "exercise" : "exercises"}
                </Pill>
              </div>
              <div className="mt-auto pt-4">
                <WButton
                  className="w-full"
                  disabled={busy}
                  onClick={() => startDay(day)}
                  size="lg"
                >
                  <Play aria-hidden className="size-5" />
                  {busy
                    ? "Finish your current workout first"
                    : `Start ${day.name}`}
                </WButton>
              </div>
            </WCard>
          ))}
        </div>
      ) : (
        <WCard className="p-6 text-center">
          <p className="font-bold text-[15px] text-foreground">
            Make this plan startable
          </p>
          <p className="mx-auto mt-1 max-w-[340px] text-[13.5px] text-muted-foreground leading-relaxed">
            Chad wrote this plan as text. One tap turns it into day-by-day
            workouts you can start and log here.
          </p>
          <WButton
            className="mt-4"
            loading={syncing}
            onClick={() =>
              startSync(async () => {
                const result = await syncPlanDays(planId);
                if (!result.ok) {
                  toast.error(result.error);
                  return;
                }
                router.refresh();
              })
            }
            variant="primary"
          >
            Prepare the plan
          </WButton>
        </WCard>
      )}
      <p className="mt-2 text-[12px] text-muted-foreground/80">
        Ask Chad in{" "}
        <Link className="underline hover:text-foreground" href="/">
          chat
        </Link>{" "}
        to write or change your training plan. It shows up here automatically.
      </p>
    </section>
  );
}

export function StartEmptySection({ unit }: { unit: WeightUnit }) {
  const { session, startSession } = useWorkouts();
  const router = useRouter();
  const busy = sessionEngaged(session);
  return (
    <section aria-labelledby="freestyle-heading" className="mt-8">
      {/* One panel, text beside the action on desktop: a bare heading +
          lone button reads as a dead band on the wide frame (LAY-1). */}
      <WCard className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            className="font-black font-display text-[17px] text-foreground uppercase tracking-wide"
            id="freestyle-heading"
          >
            No plan today?
          </h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground/80">
            Start with a blank workout and add exercises as you go.
          </p>
        </div>
        <WButton
          className="w-full shrink-0 sm:w-auto"
          disabled={busy}
          onClick={() => {
            startSession(emptySession(unit));
            router.push("/workouts/session");
          }}
          size="lg"
        >
          <Play aria-hidden className="size-5" />
          {busy
            ? "Finish your current workout first"
            : "Start an empty workout"}
        </WButton>
      </WCard>
    </section>
  );
}
