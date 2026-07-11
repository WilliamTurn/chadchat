"use client";

// THE WORKOUT PLAYER, the live session screen.
//
// Design rules (from the category research + owner orders):
//  · One scrollable list; logging never leaves this screen.
//  · Set row = # | Last time | weight | reps | ✓. Values prefilled from your
//    history, so an unchanged set is exactly one tap.
//  · The checkmark saves the set and starts the rest countdown, one gesture.
//    Tap again to un-check (mis-taps happen with sweaty thumbs).
//  · The Done check NEVER requires reps first, press it whenever you want.
//  · NOTHING auto-starts. The session clock has an explicit Play button,
//    plus Pause and Reset. The rest timer starts only when YOU check a set.
//  · Clear, labeled navigation on every screen, you can always get back.

import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCheck,
  ChevronLeft,
  Gauge,
  Info,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Repeat,
  RotateCcw,
  StickyNote,
  Timer,
  Trash2,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { saveWorkout } from "@/app/workouts/actions";
import type { TemplateExercise } from "@/lib/validation/workout-templates";
import type { LastExerciseLog, PrBaseline } from "@/lib/workouts/stats";
import { exerciseSlug } from "./catalog";
import { ConfirmDialog } from "./confirm";
import { timerElapsedSeconds, useNowTick } from "./docks";
import {
  formatClock,
  formatVolume,
  formatWeight,
  plateMath,
  sessionCompletedSets,
  sessionVolumeLb,
  weightMeaning,
} from "./format";
import { detectPRs, serializeSession } from "./session-factory";
import { ActionSheet, type SheetAction } from "./sheet";
import { useWorkouts } from "./store";
import type { PRKind, SessionExercise, SessionSet } from "./types";
import { REST_OPTIONS, RPE_OPTIONS, SET_TYPE_META } from "./types";
import { WButton, WCard } from "./ui";

// ---------------------------------------------------------------------------
// Number input (weight / reps / seconds)
// ---------------------------------------------------------------------------

function NumberField({
  value,
  onCommit,
  kind,
  ariaLabel,
  highlight,
}: {
  value: number | null;
  onCommit: (v: number | null) => void;
  kind: "weight" | "reps";
  ariaLabel: string;
  highlight: boolean;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));
  const focused = useRef(false);

  // Reflect outside changes (prefill, tap-previous) unless mid-edit.
  useEffect(() => {
    if (!focused.current) {
      setText(value === null ? "" : String(value));
    }
  }, [value]);

  function parse(raw: string): number | null {
    const n = kind === "weight" ? Number.parseFloat(raw) : Number.parseInt(raw, 10);
    if (Number.isNaN(n) || n < 0) {
      return null;
    }
    return kind === "weight" ? Math.min(n, 2000) : Math.min(n, 999);
  }

  return (
    <input
      aria-label={ariaLabel}
      className={`h-[52px] w-full min-w-0 rounded-xl border bg-background text-center font-bold font-mono text-[18px] text-foreground tabular-nums placeholder:text-muted-foreground/50 focus:outline-none ${
        highlight ? "border-input focus:border-blood/70" : "border-border focus:border-blood/60"
      }`}
      inputMode={kind === "weight" ? "decimal" : "numeric"}
      onBlur={() => {
        focused.current = false;
        const parsed = text === "" ? null : parse(text);
        onCommit(parsed);
        setText(parsed === null ? "" : String(parsed));
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.]/g, "");
        setText(raw);
        onCommit(raw === "" ? null : parse(raw));
      }}
      onFocus={(e) => {
        focused.current = true;
        e.target.select();
      }}
      placeholder="-"
      type="text"
      value={text}
    />
  );
}

/** PRs for every not-yet-completed set, keyed by set id — feeds the bulk
 *  check-off so records still get their trophy when sets land all at once. */
function collectRemainingPRs(
  exercises: SessionExercise[],
  prBaseline: Record<string, PrBaseline>,
  unit: "lb" | "kg"
): Record<string, PRKind[]> {
  const map: Record<string, PRKind[]> = {};
  for (const ex of exercises) {
    for (const set of ex.sets) {
      if (!set.completed) {
        const prs = detectPRs(prBaseline, ex, set, unit);
        if (prs.length > 0) {
          map[set.id] = prs;
        }
      }
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// One set row
// ---------------------------------------------------------------------------

function gridCols(timed: boolean): string {
  return timed
    ? "grid-cols-[44px_minmax(0,1.2fr)_minmax(0,1fr)_56px]"
    : "grid-cols-[44px_minmax(0,0.95fr)_minmax(0,1.15fr)_minmax(0,0.9fr)_56px]";
}

function SetRow({
  wex,
  set,
  index,
  workingIndex,
  previous,
  unit,
  isNext,
  prBaseline,
  onPR,
}: {
  wex: SessionExercise;
  set: SessionSet;
  index: number;
  workingIndex: number;
  previous: { weight: number | null; reps: number | null } | undefined;
  unit: "lb" | "kg";
  isNext: boolean;
  prBaseline: Record<string, PrBaseline>;
  onPR: (message: string) => void;
}) {
  const { updateSet, setSetCompleted, setSetType, setSetRpe, removeSet } =
    useWorkouts();
  const [menuOpen, setMenuOpen] = useState(false);
  const [rpeOpen, setRpeOpen] = useState(false);
  const meta = SET_TYPE_META[set.type];
  const timed = wex.kind === "timed";

  function handleCheck() {
    if (!set.completed) {
      const prs = detectPRs(prBaseline, wex, set, unit);
      if (prs.length > 0) {
        const what = prs.includes("heaviest-weight")
          ? `heaviest ${wex.name} yet: ${formatWeight(set.weight ?? 0)} ${unit}`
          : `strongest ${wex.name} set yet: ${formatWeight(set.weight ?? 0)} ${unit} × ${set.reps}`;
        onPR(`New record. ${what}`);
      }
      setSetCompleted(wex.id, set.id, true, prs);
    } else {
      setSetCompleted(wex.id, set.id, false);
    }
  }

  const typeActions: SheetAction[] = (
    ["working", "warmup", "dropset", "failure"] as const
  ).map((t) => ({
    label: SET_TYPE_META[t].name,
    hint: SET_TYPE_META[t].hint,
    selected: set.type === t,
    onSelect: () => setSetType(wex.id, set.id, t),
  }));

  return (
    <>
      <div
        className={`relative grid items-center gap-x-1.5 rounded-xl px-1.5 py-1.5 transition-colors ${gridCols(timed)} ${
          set.completed
            ? "bg-emerald-500/10"
            : isNext
              ? "bg-muted/40"
              : ""
        }`}
      >
        {isNext && !set.completed && (
          <span
            aria-hidden
            className="-left-2.5 absolute top-1/2 h-8 w-1 -translate-y-1/2 rounded-full bg-blood"
          />
        )}

        {/* Set number = a real button that opens the set menu */}
        <button
          aria-label={`Set ${index + 1} options: change set type, add RPE, or remove it`}
          className="flex h-[52px] w-[44px] cursor-pointer items-center justify-center rounded-xl border border-border bg-background transition hover:border-input"
          onClick={() => setMenuOpen(true)}
          type="button"
        >
          {meta.tag ? (
            <span className={`font-bold font-mono text-[16px] ${meta.tagClass}`}>
              {meta.tag}
            </span>
          ) : (
            <span className="font-bold font-mono text-[16px] text-muted-foreground">
              {workingIndex}
            </span>
          )}
        </button>

        {/* Last time: tap to copy into this row */}
        {previous ? (
          <button
            aria-label={
              timed
                ? `Last time: ${previous.reps ?? 0} seconds. Tap to use that.`
                : `Last time: ${formatWeight(previous.weight ?? 0)} ${unit} for ${previous.reps} reps. Tap to use those numbers.`
            }
            className="h-[52px] cursor-pointer truncate rounded-xl px-0.5 text-center font-mono text-[13.5px] text-muted-foreground/80 tabular-nums transition hover:bg-muted/50 hover:text-muted-foreground disabled:pointer-events-none"
            disabled={set.completed}
            onClick={() => {
              if (!timed) {
                updateSet(wex.id, set.id, "weight", previous.weight);
              }
              updateSet(wex.id, set.id, "reps", previous.reps);
            }}
            type="button"
          >
            {timed
              ? `${previous.reps ?? 0}s`
              : `${previous.weight != null ? formatWeight(previous.weight) : "-"} × ${previous.reps ?? "-"}`}
          </button>
        ) : (
          <span className="text-center text-[13px] text-muted-foreground/50">. </span>
        )}

        {!timed && (
          <NumberField
            ariaLabel={`Weight in ${unit} for set ${index + 1} of ${wex.name}`}
            highlight={isNext}
            kind="weight"
            onCommit={(v) => updateSet(wex.id, set.id, "weight", v)}
            value={set.weight}
          />
        )}
        <NumberField
          ariaLabel={
            timed
              ? `Seconds for set ${index + 1} of ${wex.name}`
              : `Reps for set ${index + 1} of ${wex.name}`
          }
          highlight={isNext}
          kind="reps"
          onCommit={(v) => updateSet(wex.id, set.id, "reps", v)}
          value={set.reps}
        />

        {/* The big checkmark: always pressable, log the set your way. */}
        <button
          aria-label={
            set.completed
              ? `Set ${index + 1} of ${wex.name} is logged. Tap to un-log it.`
              : `Log set ${index + 1} of ${wex.name} as done`
          }
          className={`flex h-[56px] w-[56px] cursor-pointer items-center justify-center rounded-xl border-2 transition-all active:scale-95 ${
            set.completed
              ? "border-emerald-500 bg-emerald-500 text-white"
              : `bg-background text-muted-foreground hover:text-foreground ${
                  isNext ? "border-blood/70" : "border-input"
                }`
          }`}
          onClick={handleCheck}
          type="button"
        >
          <Check aria-hidden className="size-6" strokeWidth={3} />
        </button>

        {/* PR trophy on the row, persisted */}
        {set.completed && set.prs && set.prs.length > 0 && (
          <span
            className="-right-1 -top-1.5 absolute flex items-center gap-1 rounded-full bg-amber-400 px-1.5 py-0.5 font-black text-[10px] text-black uppercase tracking-wide shadow"
            title="Personal record"
          >
            <Trophy aria-hidden className="size-3" /> PR
          </span>
        )}

        {/* RPE chip, when set */}
        {set.rpe != null && (
          <span className="-bottom-1 absolute left-[50px] rounded-full bg-muted px-1.5 py-px font-semibold text-[10px] text-muted-foreground">
            RPE {set.rpe}
          </span>
        )}
      </div>

      <ActionSheet
        actions={[
          ...typeActions,
          {
            label: set.rpe == null ? "Add effort rating (RPE)" : `Effort: RPE ${set.rpe}`,
            hint: "How hard the set felt, 6 (easy) to 10 (max effort)",
            icon: <Gauge aria-hidden className="size-[18px]" />,
            onSelect: () => setRpeOpen(true),
          },
          {
            label: "Remove this set",
            hint: "Deletes the row from this workout",
            danger: true,
            icon: <Trash2 aria-hidden className="size-[18px]" />,
            onSelect: () => removeSet(wex.id, set.id),
          },
        ]}
        footer={
          wex.equipment === "barbell" && set.weight && unit === "lb" ? (
            <div className="mt-3 rounded-xl bg-background px-3.5 py-3">
              <div className="font-semibold text-[12px] text-muted-foreground uppercase tracking-wide">
                Plate math for {formatWeight(set.weight)} lb
              </div>
              <div className="mt-1 font-mono text-[14px] text-foreground">
                {plateMath(set.weight)}
              </div>
            </div>
          ) : undefined
        }
        onClose={() => setMenuOpen(false)}
        open={menuOpen}
        subtitle="What kind of set is this?"
        title={`Set ${index + 1} · ${wex.name}`}
      />
      <ActionSheet
        actions={RPE_OPTIONS.map((o) => ({
          label: o.label,
          hint: o.hint,
          selected: set.rpe === o.value,
          onSelect: () => setSetRpe(wex.id, set.id, o.value),
        }))}
        onClose={() => setRpeOpen(false)}
        open={rpeOpen}
        subtitle="Rate of perceived exertion, how hard the set felt"
        title={`Effort for set ${index + 1}`}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// One exercise card
// ---------------------------------------------------------------------------

function ExerciseCard({
  wex,
  index,
  count,
  unit,
  nextSetId,
  lastSets,
  prBaseline,
  onPR,
}: {
  wex: SessionExercise;
  index: number;
  count: number;
  unit: "lb" | "kg";
  nextSetId: string | null;
  lastSets: Record<string, LastExerciseLog>;
  prBaseline: Record<string, PrBaseline>;
  onPR: (message: string) => void;
}) {
  const {
    addSet,
    completeAllSets,
    moveSessionExercise,
    removeSessionExercise,
    setExerciseRest,
    setExerciseNote,
  } = useWorkouts();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(wex.note ?? "");

  const previous = useMemo(
    () =>
      (lastSets[wex.name.trim().toLowerCase()]?.sets ?? []).filter(
        (s) => s.weight != null || s.reps != null
      ),
    [lastSets, wex.name]
  );

  const doneCount = wex.sets.filter((s) => s.completed).length;
  const allDone = wex.sets.length > 0 && doneCount === wex.sets.length;
  const restLabel =
    REST_OPTIONS.find((o) => o.seconds === wex.restSeconds)?.label ??
    `${wex.restSeconds}s`;
  const timed = wex.kind === "timed";

  // Warm-ups keep their own numbering; working/drop/failure share one count.
  let workingCounter = 0;

  const menuActions: SheetAction[] = [
    {
      label: "Exercise info & your records",
      hint: "How to do it, your history and best lifts",
      icon: <Info aria-hidden className="size-[18px]" />,
      onSelect: () => router.push(`/workouts/exercises/${exerciseSlug(wex.name)}`),
    },
    ...(wex.sets.some((s) => !s.completed)
      ? [
          {
            label: "Mark all sets done",
            hint: "Checks off every remaining set with the numbers shown",
            icon: <CheckCheck aria-hidden className="size-[18px]" />,
            onSelect: () =>
              completeAllSets(
                collectRemainingPRs([wex], prBaseline, unit),
                wex.id
              ),
          } satisfies SheetAction,
        ]
      : []),
    {
      label: "Add a warm-up set",
      hint: "Goes above your working sets, not counted in totals",
      icon: <Plus aria-hidden className="size-[18px]" />,
      onSelect: () => addSet(wex.id, "warmup"),
    },
    {
      label: wex.note ? "Edit exercise note" : "Add exercise note",
      hint: "A note saved with this exercise in today's log",
      icon: <StickyNote aria-hidden className="size-[18px]" />,
      onSelect: () => {
        setNoteDraft(wex.note ?? "");
        setEditingNote(true);
      },
    },
    {
      label: `Rest timer: ${wex.restSeconds === 0 ? "off" : restLabel}`,
      hint: "How long the countdown runs after each set",
      icon: <Timer aria-hidden className="size-[18px]" />,
      onSelect: () => setRestOpen(true),
    },
    {
      label: "Replace exercise",
      hint: "Swap the movement, keep your place in the workout",
      icon: <Repeat aria-hidden className="size-[18px]" />,
      onSelect: () =>
        router.push(`/workouts/exercises/pick?target=replace&wex=${wex.id}`),
    },
    ...(index > 0
      ? [
          {
            label: "Move up",
            icon: <ArrowUp aria-hidden className="size-[18px]" />,
            onSelect: () => moveSessionExercise(wex.id, -1),
          } satisfies SheetAction,
        ]
      : []),
    ...(index < count - 1
      ? [
          {
            label: "Move down",
            icon: <ArrowDown aria-hidden className="size-[18px]" />,
            onSelect: () => moveSessionExercise(wex.id, 1),
          } satisfies SheetAction,
        ]
      : []),
    {
      label: "Remove exercise",
      hint: "Removes it and its sets from this workout",
      danger: true,
      icon: <Trash2 aria-hidden className="size-[18px]" />,
      onSelect: () => setConfirmingRemove(true),
    },
  ];

  return (
    <WCard className={`min-w-0 p-4 transition-opacity ${allDone ? "opacity-75" : ""}`}>
      {/* Card header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-bold text-[17px] text-foreground">
              {wex.name}
            </h3>
            {allDone && (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check aria-hidden className="size-3.5" strokeWidth={3.5} />
              </span>
            )}
          </div>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            {weightMeaning(wex.equipment, wex.kind, unit)} · Rest{" "}
            {wex.restSeconds === 0 ? "off" : restLabel}
          </p>
          {wex.targetLabel && (
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              <span className="font-semibold text-foreground">Plan:</span>{" "}
              {wex.targetLabel}
            </p>
          )}
          {wex.note && (
            <p className="mt-1 rounded-lg bg-muted/50 px-2 py-1 text-[12.5px] text-muted-foreground">
              {wex.note}
            </p>
          )}
        </div>
        <button
          aria-label={`Options for ${wex.name}`}
          className="flex h-11 shrink-0 cursor-pointer items-center gap-1 rounded-xl px-2.5 text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          onClick={() => setMenuOpen(true)}
          type="button"
        >
          <MoreHorizontal aria-hidden className="size-5" />
          <span className="font-semibold text-[13px]">Options</span>
        </button>
      </div>

      {/* Column headers */}
      <div
        className={`mt-3 grid gap-x-1.5 px-1.5 text-center font-bold text-[12px] text-muted-foreground/80 uppercase tracking-wider ${gridCols(timed)}`}
      >
        <span>Set</span>
        <span>Last time</span>
        {!timed && <span>{wex.kind === "bodyweight" ? `+${unit}` : unit}</span>}
        <span>{timed ? "Seconds" : "Reps"}</span>
        <span>Done</span>
      </div>

      {/* Set rows */}
      <div className="mt-1 flex flex-col gap-1.5">
        {wex.sets.map((set, i) => {
          if (set.type !== "warmup") {
            workingCounter++;
          }
          const prevForRow =
            set.type === "warmup"
              ? undefined
              : previous[Math.min(workingCounter - 1, previous.length - 1)];
          return (
            <SetRow
              index={i}
              isNext={set.id === nextSetId}
              key={set.id}
              onPR={onPR}
              prBaseline={prBaseline}
              previous={prevForRow}
              set={set}
              unit={unit}
              wex={wex}
              workingIndex={workingCounter}
            />
          );
        })}
        {wex.sets.length === 0 && (
          <p className="rounded-xl bg-background px-3 py-4 text-center text-[13.5px] text-muted-foreground/80">
            No sets yet. Add one below.
          </p>
        )}
      </div>

      <button
        className="mt-2 flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-input border-dashed font-semibold text-[14px] text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
        onClick={() => addSet(wex.id, "working")}
        type="button"
      >
        <Plus aria-hidden className="size-4" />
        Add set
      </button>

      {/* Sheets & dialogs */}
      <ActionSheet
        actions={menuActions}
        onClose={() => setMenuOpen(false)}
        open={menuOpen}
        title={wex.name}
      />
      <ActionSheet
        actions={REST_OPTIONS.map((o) => ({
          label: o.label,
          selected: wex.restSeconds === o.seconds,
          onSelect: () => setExerciseRest(wex.id, o.seconds),
        }))}
        onClose={() => setRestOpen(false)}
        open={restOpen}
        subtitle="The countdown starts each time you check off a set"
        title={`Rest after each set of ${wex.name}`}
      />
      {editingNote && (
        <ConfirmDialog
          confirmLabel="Save note"
          onCancel={() => setEditingNote(false)}
          onConfirm={() => {
            setExerciseNote(wex.id, noteDraft);
            setEditingNote(false);
          }}
          open
          title={`Note for ${wex.name}`}
        >
          <textarea
            aria-label={`Note for ${wex.name}`}
            className="mt-3 min-h-[80px] w-full rounded-xl border border-input bg-background px-3 py-2.5 text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:border-blood/60 focus:outline-none"
            maxLength={1000}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="e.g. Felt strong, bump the weight next time"
            value={noteDraft}
          />
        </ConfirmDialog>
      )}
      <ConfirmDialog
        body={
          doneCount > 0
            ? `You already logged ${doneCount} ${doneCount === 1 ? "set" : "sets"} of it in this workout, they'll be removed too.`
            : "It will be removed from this workout only. Your saved workout plan is not changed."
        }
        confirmLabel="Remove exercise"
        destructive
        onCancel={() => setConfirmingRemove(false)}
        onConfirm={() => {
          removeSessionExercise(wex.id);
          setConfirmingRemove(false);
        }}
        open={confirmingRemove}
        title={`Remove ${wex.name}?`}
      />
    </WCard>
  );
}

// ---------------------------------------------------------------------------
// The player
// ---------------------------------------------------------------------------

export function SessionPlayer({
  lastSets,
  prBaseline,
  templates,
}: {
  lastSets: Record<string, LastExerciseLog>;
  prBaseline: Record<string, PrBaseline>;
  templates: { id: string; name: string; exercises: TemplateExercise[] }[];
}) {
  const {
    session,
    ready,
    completeAllSets,
    renameSession,
    setSessionNotes,
    timerPlay,
    timerPause,
    timerReset,
    clearSession,
    discardSession,
  } = useWorkouts();
  const router = useRouter();
  const now = useNowTick();

  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [alsoUpdateTemplate, setAlsoUpdateTemplate] = useState(false);
  const [completeRemaining, setCompleteRemaining] = useState(false);
  const [saving, setSaving] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const [prToast, setPrToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Session-wide "you are here": the first unchecked set in order.
  const nextSetId = useMemo(() => {
    if (!session) {
      return null;
    }
    for (const ex of session.exercises) {
      const s = ex.sets.find((x) => !x.completed);
      if (s) {
        return s.id;
      }
    }
    return null;
  }, [session]);

  const doneSets = session ? sessionCompletedSets(session.exercises) : 0;
  const totalSets = session
    ? session.exercises.reduce((a, ex) => a + ex.sets.length, 0)
    : 0;
  const volume = session
    ? sessionVolumeLb(session.exercises, session.unit)
    : 0;
  const exercisesDone = session
    ? session.exercises.filter(
        (ex) => ex.sets.length > 0 && ex.sets.every((s) => s.completed)
      ).length
    : 0;
  const uncheckedSets = totalSets - doneSets;

  // Did today's structure drift from the source template? (Hevy's rule:
  // only structural changes prompt; weights/reps never do.)
  const sourceTemplate = useMemo(
    () =>
      session?.templateId
        ? (templates.find((t) => t.id === session.templateId) ?? null)
        : null,
    [session?.templateId, templates]
  );
  const structureChanged = useMemo(() => {
    if (!(session && sourceTemplate)) {
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
  }, [session, sourceTemplate]);

  function showPR(message: string) {
    setPrToast(message);
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setPrToast(null), 4000);
  }

  useEffect(
    () => () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    },
    []
  );

  if (!ready) {
    return (
      <div className="py-24 text-center text-muted-foreground" role="status">
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <div className="py-24 text-center">
        <p className="font-bold text-[17px] text-foreground">
          No workout is running
        </p>
        <p className="mx-auto mt-1.5 max-w-[300px] text-[14px] text-muted-foreground">
          Start one of your workouts, or begin an empty one.
        </p>
        <Link className="mt-5 inline-block" href="/workouts">
          <WButton variant="primary">Go to Workouts</WButton>
        </Link>
      </div>
    );
  }

  const elapsed = timerElapsedSeconds(session.timer, now);
  const timerStarted = session.timer.running || elapsed > 0;

  async function handleFinishConfirmed() {
    if (!session || saving) {
      return;
    }
    // "Mark all unchecked sets as done" (owner s181): a lifter who did the
    // work without tapping each checkmark saves everything in one go. Applied
    // to a local copy so the payload is built from the completed state.
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
    const payload = serializeSession(sessionForSave, elapsed);
    if (!payload) {
      toast.error(
        "Nothing is checked off yet. Check your sets, or tick “Mark all unchecked sets as done”."
      );
      return;
    }
    setSaving(true);
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
              (e) => e.name.trim().toLowerCase() === ex.name.trim().toLowerCase()
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
    const result = await saveWorkout(payload, session.templateId ?? undefined);
    setSaving(false);
    if (!result.ok || !result.id) {
      toast.error(result.error ?? "Couldn't save that workout. Try again.");
      return;
    }
    clearSession();
    setFinishing(false);
    router.push(`/workouts/history/${result.id}?new=1`);
    router.refresh();
  }

  return (
    <>
      {/* Sticky session header */}
      <div className="-mx-4 sticky top-0 z-30 mb-4 border-border border-b bg-background/95 px-4 pt-2 pb-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <button
            aria-label="Back to Workouts"
            className="-ml-1.5 inline-flex min-h-[44px] cursor-pointer items-center gap-1 rounded-lg px-1.5 font-semibold text-[13.5px] text-muted-foreground transition hover:text-foreground"
            onClick={() => router.push("/workouts")}
            type="button"
          >
            <ChevronLeft aria-hidden className="size-4" />
            <span className="max-[359px]:hidden">Workouts</span>
            <span className="min-[360px]:hidden">Back</span>
          </button>

          {/* Session clock: explicit Play / Pause / Reset. Never auto-starts. */}
          <div className="flex items-center gap-1">
            <span
              aria-label={`Workout time: ${formatClock(elapsed)}${session.timer.running ? ", running" : ", paused"}`}
              className={`font-mono font-semibold text-[16px] tabular-nums max-[359px]:text-[13px] ${
                session.timer.running ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {formatClock(elapsed)}
            </span>
            <button
              aria-label={
                session.timer.running
                  ? "Pause the workout timer"
                  : timerStarted
                    ? "Resume the workout timer"
                    : "Start the workout timer"
              }
              className={`flex size-11 cursor-pointer items-center justify-center rounded-xl transition ${
                session.timer.running
                  ? "bg-muted/70 text-foreground hover:bg-muted"
                  : "bg-blood text-white hover:brightness-110"
              }`}
              onClick={() => (session.timer.running ? timerPause() : timerPlay())}
              type="button"
            >
              {session.timer.running ? (
                <Pause aria-hidden className="size-5 fill-current" />
              ) : (
                <Play aria-hidden className="size-5 fill-current" />
              )}
            </button>
            <button
              aria-label="Reset the workout timer to zero"
              className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/60 hover:text-foreground disabled:opacity-30"
              disabled={!timerStarted}
              onClick={timerReset}
              type="button"
            >
              <RotateCcw aria-hidden className="size-[18px]" />
            </button>
          </div>

          <WButton
            className="min-h-[44px] px-4"
            disabled={totalSets === 0}
            onClick={() => {
              setAlsoUpdateTemplate(false);
              // Nothing checked yet? Ticking "mark all done" is the only way
              // this save works, so it starts ticked; otherwise opt-in.
              setCompleteRemaining(doneSets === 0);
              setFinishing(true);
            }}
            size="sm"
            variant="primary"
          >
            Finish
          </WButton>
        </div>

        {/* Name + progress */}
        <div className="mt-1.5">
          {renaming ? (
            <form
              className="flex items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                renameSession(nameDraft.trim() || session.name);
                setRenaming(false);
              }}
            >
              <input
                aria-label="Workout name"
                className="h-[44px] w-full rounded-xl border border-input bg-background px-3 font-bold text-[17px] text-foreground focus:border-blood/60 focus:outline-none"
                maxLength={60}
                onChange={(e) => setNameDraft(e.target.value)}
                value={nameDraft}
              />
              <WButton className="min-h-[44px]" size="sm" type="submit" variant="primary">
                Save
              </WButton>
            </form>
          ) : (
            <button
              aria-label={`Workout name: ${session.name}. Tap to rename.`}
              className="group flex min-h-[44px] max-w-full cursor-pointer items-center gap-2 rounded-lg text-left"
              onClick={() => {
                setNameDraft(session.name);
                setRenaming(true);
              }}
              type="button"
            >
              <h1 className="truncate font-black font-display text-[22px] text-foreground uppercase leading-tight tracking-tight">
                {session.name}
              </h1>
              <Pencil
                aria-hidden
                className="size-3.5 shrink-0 text-muted-foreground/70 transition group-hover:text-muted-foreground"
              />
            </button>
          )}
          {!timerStarted && (
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Press the red play button when you begin. The workout timer is
              yours to start, pause, and reset.
            </p>
          )}
          {totalSets > 0 && (
            <>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                {doneSets}/{totalSets} sets · {exercisesDone}/
                {session.exercises.length} exercises done
                {volume > 0 && ` · ${formatVolume(volume)} lb moved`}
              </p>
              <div
                aria-label="Workout progress"
                aria-valuemax={totalSets}
                aria-valuemin={0}
                aria-valuenow={doneSets}
                className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted/60"
                role="progressbar"
              >
                <div
                  className="h-full rounded-full bg-blood transition-all duration-300"
                  style={{
                    width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%`,
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Session-wide bulk check-off, visible at the top (owner order s181:
          not only inside the per-exercise Options menu). One tap marks every
          remaining set of every exercise as done. */}
      {uncheckedSets > 0 && (
        <div className="mb-3 flex justify-end">
          <WButton
            aria-label="Mark every set in this workout as done"
            className="gap-1.5"
            onClick={() =>
              completeAllSets(
                collectRemainingPRs(session.exercises, prBaseline, session.unit)
              )
            }
            size="sm"
          >
            <CheckCheck aria-hidden className="size-4" />
            Mark all sets done
          </WButton>
        </div>
      )}

      {/* Exercise list */}
      {session.exercises.length === 0 ? (
        <WCard className="p-8 text-center">
          <p className="font-bold text-[16px] text-foreground">
            Exercises you add will appear here
          </p>
          <p className="mx-auto mt-1.5 max-w-[300px] text-[13.5px] text-muted-foreground">
            Pick your first exercise, then log each set as you do it.
          </p>
          <WButton
            className="mt-5"
            onClick={() => router.push("/workouts/exercises/pick?target=session")}
            size="lg"
            variant="primary"
          >
            <Plus aria-hidden className="size-5" />
            Add your first exercise
          </WButton>
        </WCard>
      ) : (
        /* Two-across on desktop (LAY-1); items-start so a card only grows
           with its own sets. Explicit grid-cols-1 + min-w-0 cards so the
           implicit column never sizes to max-content on phones. */
        <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
          {session.exercises.map((wex, i) => (
            <ExerciseCard
              count={session.exercises.length}
              index={i}
              key={wex.id}
              lastSets={lastSets}
              nextSetId={nextSetId}
              onPR={showPR}
              prBaseline={prBaseline}
              unit={session.unit}
              wex={wex}
            />
          ))}
        </div>
      )}

      {session.exercises.length > 0 && (
        /* Full-width on phones, left-anchored auto width on desktop (the
           s180 form-button ruling). */
        <WButton
          className="mt-3 w-full sm:w-auto"
          onClick={() => router.push("/workouts/exercises/pick?target=session")}
          size="lg"
        >
          <Plus aria-hidden className="size-5" />
          Add exercise
        </WButton>
      )}

      {/* Discard, clearly separated from Finish */}
      <div className="mt-10 border-border border-t pt-6 pb-24">
        <WButton
          className="w-full sm:w-auto"
          onClick={() => setDiscarding(true)}
          variant="danger"
        >
          <Trash2 aria-hidden className="size-4" />
          Discard workout
        </WButton>
        <p className="mt-2 text-center text-[12px] text-muted-foreground/80 sm:text-left">
          Deletes this session without saving. Your saved workouts and history
          are untouched.
        </p>
      </div>

      {/* PR toast */}
      {prToast && (
        <div
          className="fixed top-4 left-1/2 z-[85] flex w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 animate-in items-center gap-2.5 rounded-2xl border border-amber-400/40 bg-popover px-4 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.5)] duration-300 zoom-in-95"
          role="status"
        >
          <Trophy aria-hidden className="size-5 shrink-0 text-amber-500 dark:text-amber-300" />
          <span className="font-semibold text-[14.5px] text-foreground">
            {prToast}
          </span>
        </div>
      )}

      {/* Finish confirm */}
      <ConfirmDialog
        body={
          `You logged ${doneSets} ${doneSets === 1 ? "set" : "sets"}` +
          (volume > 0 ? ` and moved ${formatVolume(volume)} lb total` : "") +
          "." +
          (uncheckedSets > 0
            ? completeRemaining
              ? ` Your ${uncheckedSets} unchecked ${uncheckedSets === 1 ? "set" : "sets"} will be marked done and saved too.`
              : ` ${uncheckedSets} unchecked ${uncheckedSets === 1 ? "set" : "sets"} won't be saved.`
            : "")
        }
        busy={saving}
        cancelLabel="Keep lifting"
        confirmLabel="Finish and save"
        onCancel={() => setFinishing(false)}
        onConfirm={handleFinishConfirmed}
        open={finishing}
        title="Finish workout?"
      >
        <label className="mt-4 block">
          <span className="mb-1.5 block font-semibold text-[13px] text-muted-foreground">
            Workout notes (optional, saved with this session)
          </span>
          <textarea
            className="min-h-[64px] w-full rounded-xl border border-input bg-background px-3 py-2.5 text-[14.5px] text-foreground placeholder:text-muted-foreground/60 focus:border-blood/60 focus:outline-none"
            maxLength={2000}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="e.g. Slept badly, still hit every set"
            value={session.notes}
          />
        </label>
        {uncheckedSets > 0 && (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3.5">
            <input
              checked={completeRemaining}
              className="mt-0.5 size-5 accent-[#a4161a]"
              onChange={(e) => setCompleteRemaining(e.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block font-semibold text-[14px] text-foreground">
                Mark all {uncheckedSets} unchecked{" "}
                {uncheckedSets === 1 ? "set" : "sets"} as done
              </span>
              <span className="mt-0.5 block text-[12.5px] text-muted-foreground leading-relaxed">
                Did the work but didn't tap every checkmark? This saves every
                remaining set with the weights and reps already shown.
              </span>
            </span>
          </label>
        )}
        {structureChanged && sourceTemplate && (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3.5">
            <input
              checked={alsoUpdateTemplate}
              className="mt-0.5 size-5 accent-[#a4161a]"
              onChange={(e) => setAlsoUpdateTemplate(e.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block font-semibold text-[14px] text-foreground">
                Also update &ldquo;{sourceTemplate.name}&rdquo;
              </span>
              <span className="mt-0.5 block text-[12.5px] text-muted-foreground leading-relaxed">
                Today you changed the plan (different exercises or set counts).
                Check this to make the saved workout match what you actually
                did.
              </span>
            </span>
          </label>
        )}
      </ConfirmDialog>

      {/* Discard confirm */}
      <ConfirmDialog
        body={
          doneSets > 0
            ? `The ${doneSets} ${doneSets === 1 ? "set" : "sets"} you logged in this session will be permanently deleted.`
            : "This session will be deleted. Nothing has been logged yet."
        }
        cancelLabel="Keep lifting"
        confirmLabel="Discard workout"
        destructive
        onCancel={() => setDiscarding(false)}
        onConfirm={() => {
          discardSession();
          setDiscarding(false);
          router.push("/workouts");
        }}
        open={discarding}
        title="Discard this workout?"
      />
    </>
  );
}
