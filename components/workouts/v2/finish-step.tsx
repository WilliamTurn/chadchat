"use client";

// The FINISH STEP: the live workout's commit surface, a full page at
// /workouts/active/finish. The old finish confirm dialog carried five input
// controls; composition canon 04 §11(b)/§12 makes that a finish STEP, not a
// confirmation, and owner law s168 sends data entry to a dedicated page
// (the platform ships no full-screen modal). Anatomy is the canon 04 §1
// contract: title, supporting summary, form groups, then the commitment
// pinned at the bottom (placement canon 08 §2/§8). The centered narrow
// column is the comp-canon 02 #44 centered-composition form (this screen is
// one focused task, like the celebration that follows it).

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { saveWorkout } from "@/app/workouts/actions";
import { Checkbox } from "@/components/ui/checkbox";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { TemplateExercise } from "@/lib/validation/workout-templates";
import { timerElapsedSeconds } from "./docks";
import {
  draftDurationSeconds,
  formatVolume,
  sessionCompletedSets,
  sessionVolumeLb,
} from "./format";
import { WorkoutPageHeader } from "./page-header";
import { serializeSession } from "./session-factory";
import { persistSessionCleared, useWorkouts } from "./store";
import type { ActiveSession } from "./types";
import { WButton } from "./ui";

type Template = { id: string; name: string; exercises: TemplateExercise[] };

export function FinishStep({ templates }: { templates: Template[] }) {
  const { session, ready } = useWorkouts();

  if (!ready) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: role="status" is the standard live-region idiom; swapping to <output> changes element semantics and default display for zero AT gain.
      <div className="py-24 text-center text-muted-foreground" role="status">
        Loading…
      </div>
    );
  }

  if (
    !session ||
    session.exercises.reduce((a, ex) => a + ex.sets.length, 0) === 0
  ) {
    // Direct-URL guard, same words as the player's own empty branch so the
    // two surfaces read as one system (copy canon 04 §132). A session with
    // no set rows has nothing to finish (the player disables Finish for it);
    // zero CHECKED sets still opens the form, because "Mark all unchecked
    // sets as done" and the refusal slot live here (RUN-72).
    return (
      <div className="py-24 text-center">
        <p className="font-bold text-foreground text-lg">
          No workout is running
        </p>
        <p className="mx-auto mt-1.5 max-w-xs text-muted-foreground text-sm">
          Start one of your workouts, or begin an empty one.
        </p>
        <Link className="mt-5 inline-block" href="/workouts">
          <WButton variant="primary">Go to Workouts</WButton>
        </Link>
      </div>
    );
  }

  return <FinishForm session={session} templates={templates} />;
}

/** Mounted only once the hydrated session exists, so the duration draft can
 *  freeze in its initializer: what the member reads is exactly what saves,
 *  even while the clock keeps running behind this page. */
function FinishForm({
  session,
  templates,
}: {
  session: ActiveSession;
  templates: Template[];
}) {
  const { setSessionNotes, clearSession } = useWorkouts();
  const router = useRouter();

  const [durationDraft, setDurationDraft] = useState(() => {
    const elapsed = timerElapsedSeconds(session.timer, Date.now());
    return { min: String(Math.floor(elapsed / 60)), sec: String(elapsed % 60) };
  });
  // ALWAYS opt-in (flaws RUN-72): sets the member never checked are never
  // marked done by default.
  const [completeRemaining, setCompleteRemaining] = useState(false);
  const [alsoUpdateTemplate, setAlsoUpdateTemplate] = useState(false);
  // The refusal message renders in the reserved slot beside the pinned
  // action (owner decision 2026-07-23: reserve-space error slots, nothing
  // ever jumps; comp-canon 03 #29).
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, startFinishTransition] = useTransition();

  // The pinned bar is portaled to <body> (the shell's <main> carries a
  // transform that would re-anchor position:fixed), so it must mirror the
  // content area's box itself: on desktop <main> sits beside the collapsible
  // nav panel, and a full-viewport bar would center its button on a
  // different axis than the form column above it (placement canon 08 #47:
  // same-kind elements share one edge EXACTLY). Measured live so the
  // collapse animation keeps them glued.
  const [barBox, setBarBox] = useState<{ left: number; width: number } | null>(
    null
  );
  useLayoutEffect(() => {
    const main = document.querySelector("main");
    if (!main) {
      return;
    }
    const update = () => {
      const r = main.getBoundingClientRect();
      setBarBox({ left: r.left, width: r.width });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(main);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  // Same finish-flash fix as the player carried: the session is cleared on
  // UNMOUNT (after the celebration's navigation commits), deferred to a
  // microtask so the outgoing page never re-renders into its guard branch.
  const clearOnUnmount = useRef(false);
  const clearSessionRef = useRef(clearSession);
  clearSessionRef.current = clearSession;
  useLayoutEffect(
    () => () => {
      if (clearOnUnmount.current) {
        queueMicrotask(() => clearSessionRef.current());
      }
    },
    []
  );

  const doneSets = sessionCompletedSets(session.exercises);
  const totalSets = session.exercises.reduce((a, ex) => a + ex.sets.length, 0);
  const uncheckedSets = totalSets - doneSets;
  const volume = sessionVolumeLb(session.exercises, session.unit);

  // Did today's structure drift from the source template? (Hevy's rule:
  // only structural changes prompt; weights/reps never do.)
  const sourceTemplate = session.templateId
    ? (templates.find((t) => t.id === session.templateId) ?? null)
    : null;
  const structureChanged = (() => {
    if (!sourceTemplate) {
      return false;
    }
    const planned = sourceTemplate.exercises.map((e) =>
      e.name.trim().toLowerCase()
    );
    const actual = session.exercises
      .filter((ex) => ex.sets.some((s) => s.completed))
      .map((ex) => ex.name.trim().toLowerCase());
    if (planned.join("|") !== actual.join("|")) {
      return true;
    }
    for (const ex of session.exercises) {
      const planEx = sourceTemplate.exercises.find(
        (e) => e.name.trim().toLowerCase() === ex.name.trim().toLowerCase()
      );
      if (!planEx) {
        continue;
      }
      const workingDone = ex.sets.filter(
        (s) => s.completed && s.type !== "warmup"
      ).length;
      if (workingDone > 0 && workingDone !== planEx.targetSets) {
        return true;
      }
    }
    return false;
  })();

  // Summary with the consequence stated up front (canon 04 §6: title plus
  // first line is the whole decision). Strings: member-copy-writer W1.
  const summary =
    `You logged ${doneSets} ${doneSets === 1 ? "set" : "sets"}` +
    (volume > 0 ? ` and moved ${formatVolume(volume)} lb total` : "") +
    "." +
    (uncheckedSets > 0
      ? completeRemaining
        ? // "too" asserts "in addition to what you logged"; with zero logged
          // sets that addition is false, so the word goes (copy audit F-3).
          ` Your ${uncheckedSets} unchecked ${uncheckedSets === 1 ? "set" : "sets"} will be marked done and saved${doneSets > 0 ? " too" : ""}.`
        : ` ${uncheckedSets} unchecked ${uncheckedSets === 1 ? "set" : "sets"} won't be saved.`
      : "");

  function handleFinish() {
    if (saving) {
      return;
    }
    // "Mark all unchecked sets as done" (owner s181): applied to a local
    // copy so the payload is built from the completed state.
    const sessionForSave = completeRemaining
      ? {
          ...session,
          exercises: session.exercises.map((ex) => ({
            ...ex,
            sets: ex.sets.map((set) =>
              set.completed ? set : { ...set, completed: true }
            ),
          })),
        }
      : session;
    // The corrected duration also corrects the calorie estimate: duration is
    // an input to the saved workout's energy computation.
    const payload = serializeSession(
      sessionForSave,
      draftDurationSeconds(durationDraft)
    );
    if (!payload) {
      setSaveError(
        "Nothing is checked off yet. Go back to your workout to check off sets, or select the option to mark all unchecked sets as done."
      );
      return;
    }
    setSaveError(null);
    startFinishTransition(async () => {
      // Also rewrite the source template to match today's session, if asked.
      if (alsoUpdateTemplate && sourceTemplate) {
        const { saveTemplate } = await import("@/app/workouts/actions");
        await saveTemplate({
          id: sourceTemplate.id,
          name: sourceTemplate.name,
          exercises: sessionForSave.exercises
            .filter((ex) => ex.sets.some((s) => s.completed))
            .map((ex) => {
              const existing = sourceTemplate.exercises.find(
                (e) =>
                  e.name.trim().toLowerCase() === ex.name.trim().toLowerCase()
              );
              const workingSets = ex.sets.filter(
                (s) => s.completed && s.type !== "warmup"
              ).length;
              return {
                name: ex.name,
                muscleGroup: ex.muscleGroup,
                kind: ex.kind,
                equipment: ex.equipment,
                targetSets: Math.max(workingSets, 1),
                repRangeMin: existing?.repRangeMin ?? 8,
                repRangeMax: existing?.repRangeMax ?? 12,
                restSeconds: ex.restSeconds,
                note: existing?.note ?? null,
              };
            }),
        });
      }
      const result = await saveWorkout(
        payload,
        session.templateId ?? undefined,
        session.planRef ?? undefined
      );
      if (!result.ok || !result.id) {
        toast.error(
          result.error ??
            "Chad couldn't save your workout. Your entries are still here. Try again."
        );
        return;
      }
      // The transition holds the button busy until the celebration commits
      // and unmounts this page; the unmount cleanup clears the session. The
      // persisted copy is wiped NOW, so even a navigation that degrades to a
      // full page load can never rehydrate the saved workout as a zombie.
      clearOnUnmount.current = true;
      persistSessionCleared();
      router.push(`/workouts/history/${result.id}?new=1`);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-lg pb-40">
      <WorkoutPageHeader
        back={{ href: "/workouts/active", label: "your workout" }}
        subtitle={summary}
        title="Finish workout"
      />

      {/* Duration: one answer split across two parts, so one group label
          with the units affixed to their fields (comp-canon 03 #16-#19).
          The row is designed at 320px first: 96 + 8 + 80 = 184px of a
          272px content box (03 #18). */}
      <fieldset>
        <legend className="font-medium text-foreground text-sm leading-none">
          Duration
        </legend>
        <p className="mt-1.5 text-muted-foreground text-sm" id="duration-hint">
          Set from the workout timer, so adjust it only if it is wrong.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <InputGroup className="w-24" size="lg">
            <InputGroupInput
              aria-describedby="duration-hint"
              aria-label="Duration in minutes"
              className="tabular-nums"
              inputMode="numeric"
              onChange={(e) =>
                setDurationDraft((d) => ({
                  ...d,
                  min: e.target.value.replace(/\D/g, "").slice(0, 4),
                }))
              }
              onFocus={(e) => e.target.select()}
              type="text"
              value={durationDraft.min}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>min</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          <InputGroup className="w-20" size="lg">
            <InputGroupInput
              aria-describedby="duration-hint"
              aria-label="Duration in seconds"
              className="tabular-nums"
              inputMode="numeric"
              onBlur={(e) => {
                // Seconds settle into 0-59 on blur; whole-value clamping
                // (24h cap) happens in draftDurationSeconds on save.
                const n = Number.parseInt(e.target.value, 10);
                setDurationDraft((d) => ({
                  ...d,
                  sec: Number.isNaN(n) ? "0" : String(Math.min(n, 59)),
                }));
              }}
              onChange={(e) =>
                setDurationDraft((d) => ({
                  ...d,
                  sec: e.target.value.replace(/\D/g, "").slice(0, 2),
                }))
              }
              onFocus={(e) => e.target.select()}
              type="text"
              value={durationDraft.sec}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText>sec</InputGroupText>
            </InputGroupAddon>
          </InputGroup>
        </div>
      </fieldset>

      <div className="mt-5">
        <Label htmlFor="finish-notes">
          Workout notes{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          className="mt-1.5"
          id="finish-notes"
          maxLength={2000}
          onChange={(e) => setSessionNotes(e.target.value)}
          placeholder="Felt strong, upped the weight"
          value={session.notes}
        />
      </div>

      {/* Options are plain rows on the page surface: control, label, one
          caption, full-width target, no enclosing box (comp-canon 04 §21;
          03 #7: control left, label right, aligned to line one). */}
      {(uncheckedSets > 0 || (structureChanged && sourceTemplate)) && (
        <div className="mt-5">
          {uncheckedSets > 0 && (
            <label
              className="flex cursor-pointer items-start gap-3 py-2"
              htmlFor="finish-mark-all"
            >
              <Checkbox
                checked={completeRemaining}
                id="finish-mark-all"
                onCheckedChange={(v) => {
                  setCompleteRemaining(v === true);
                  setSaveError(null);
                }}
              />
              <span className="min-w-0">
                <span className="block font-semibold text-foreground text-sm leading-5">
                  {uncheckedSets === 1
                    ? "Mark the 1 unchecked set as done"
                    : `Mark all ${uncheckedSets} unchecked sets as done`}
                </span>
                <span className="mt-0.5 block text-muted-foreground text-sm">
                  Saves each set with the weight and reps shown.
                </span>
              </span>
            </label>
          )}
          {structureChanged && sourceTemplate && (
            <label
              className="flex cursor-pointer items-start gap-3 py-2"
              htmlFor="finish-update-template"
            >
              <Checkbox
                checked={alsoUpdateTemplate}
                id="finish-update-template"
                onCheckedChange={(v) => setAlsoUpdateTemplate(v === true)}
              />
              <span className="min-w-0">
                <span className="block font-semibold text-foreground text-sm leading-5">
                  Also update &ldquo;{sourceTemplate.name}&rdquo;
                </span>
                <span className="mt-0.5 block text-muted-foreground text-sm">
                  Updates this plan to match what you did today.
                </span>
              </span>
            </label>
          )}
        </div>
      )}

      {/* Commitment zone, pinned (owner decision 2026-07-23: pinned actions;
          canon 04 §24: the action never scrolls out of reach). Portaled to
          <body>: the shell's <main> carries a transform that would otherwise
          anchor this "fixed" bar to the document floor. Renders post-mount
          only (FinishForm mounts after the store hydrates). The error line
          is a permanently reserved slot so the button never moves. */}
      {createPortal(
        <div
          className="fixed bottom-0 z-50 border-border border-t bg-background/95 px-4 py-3 backdrop-blur-xl"
          style={{
            left: barBox?.left ?? 0,
            width: barBox?.width ?? "100%",
            paddingBottom: "calc(12px + env(safe-area-inset-bottom))",
          }}
        >
          <div className="mx-auto w-full max-w-lg">
            <p
              aria-live="polite"
              className="mb-1.5 min-h-5 text-blood text-sm leading-5"
            >
              {saveError}
            </p>
            <WButton
              className="w-full"
              loading={saving}
              onClick={handleFinish}
              size="lg"
              variant="primary"
            >
              Finish and save
            </WButton>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
