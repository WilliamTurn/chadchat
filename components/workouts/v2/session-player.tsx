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
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCheck,
  ChevronLeft,
  Gauge,
  GripVertical,
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
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
import { RestTimerPicker, RpePicker } from "./pickers";
import { detectPRs } from "./session-factory";
import { ActionMenu, type SheetAction } from "./sheet";
import { primeStartCues, StartCountdown } from "./start-countdown";
import { useWorkouts } from "./store";
import type { PRKind, SessionExercise, SessionSet } from "./types";
import {
  formatRestSeconds,
  SET_TYPE_META,
  START_COUNTDOWN_SECONDS,
} from "./types";
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
    const n =
      kind === "weight" ? Number.parseFloat(raw) : Number.parseInt(raw, 10);
    if (Number.isNaN(n) || n < 0) {
      return null;
    }
    return kind === "weight" ? Math.min(n, 2000) : Math.min(n, 999);
  }

  return (
    <input
      aria-label={ariaLabel}
      // The literal 16px is deliberate: it is the iOS no-zoom floor, and
      // rem-based sizes inflate to 17px under the phone root boost, which
      // clips a 222.5 weight in the 50px column at 320px.
      className={`h-[52px] w-full min-w-0 rounded-xl border bg-background text-center font-bold font-mono text-[16px] text-foreground tabular-nums placeholder:text-muted-foreground/50 focus:outline-none sm:text-lg ${
        highlight
          ? "border-input focus:border-blood/70"
          : "border-border focus:border-blood/60"
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

/**
 * The set-row column template (S5 rework). Sized so the worst realistic
 * "Last time" value (222.5×12) renders in full at a 320px viewport with the
 * boxed inputs kept: the min widths below add up to the space left inside
 * page gutter + card padding + row padding at 320, and every flexible column
 * carries a floor so nothing can ever be squeezed into an ellipsis.
 */
function gridCols(timed: boolean): string {
  return timed
    ? "grid-cols-[32px_minmax(64px,1.2fr)_minmax(50px,1fr)_44px]"
    : "grid-cols-[32px_minmax(64px,1.1fr)_minmax(50px,1fr)_minmax(34px,0.7fr)_44px]";
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
  const {
    updateSet,
    setSetCompleted,
    setSetType,
    setSetRpe,
    removeSet,
    restoreSet,
  } = useWorkouts();
  const [menuOpen, setMenuOpen] = useState(false);
  const [rpeOpen, setRpeOpen] = useState(false);
  const meta = SET_TYPE_META[set.type];
  const timed = wex.kind === "timed";
  // Focus home for the RPE picker (flow audit F-5): back to the set-number
  // trigger on close, never <body> (canon 01 §89).
  const setTriggerRef = useRef<HTMLButtonElement>(null);

  // The set's SPOKEN identity matches its VISIBLE one (mobile audit; WCAG
  // 2.5.3 Label in Name): the cell shows "W" for warm-ups and the working
  // count for the rest, so "set {array index}" drifted off by one the moment
  // a warm-up existed and "Remove set 2" named a different row than the one
  // selected.
  const setName =
    set.type === "warmup" ? "warm-up set" : `set ${workingIndex}`;
  const setTitle =
    set.type === "warmup"
      ? `Warm-up set · ${wex.name}`
      : `Set ${workingIndex} · ${wex.name}`;

  // Undo toast: the set menu's destructive row gets exactly one safety net
  // (frequent, single item, so undo beats a confirm; CLAUDE.md destructive
  // rule). Restore puts the row back at its old position. 8s window: an
  // action-carrying toast needs reachable time (canon 01 §130, 03 §38).
  function handleRemoveSet() {
    const snapshot = { ...set };
    const at = wex.sets.findIndex((s) => s.id === set.id);
    removeSet(wex.id, set.id);
    toast(
      `${set.type === "warmup" ? "Warm-up set" : `Set ${workingIndex}`} of ${wex.name} removed.`,
      {
        action: {
          label: "Undo",
          onClick: () => restoreSet(wex.id, snapshot, at),
        },
        duration: 8000,
      }
    );
  }

  function handleCheck() {
    if (set.completed) {
      setSetCompleted(wex.id, set.id, false);
    } else {
      const prs = detectPRs(prBaseline, wex, set, unit);
      // The toast fires once per set per session: prAnnounced survives an
      // unmark, so re-checking the same record can't celebrate it twice.
      if (prs.length > 0 && !set.prAnnounced) {
        const what = prs.includes("heaviest-weight")
          ? `heaviest ${wex.name} yet: ${formatWeight(set.weight ?? 0)} ${unit}`
          : `strongest ${wex.name} set yet: ${formatWeight(set.weight ?? 0)} ${unit} × ${set.reps}`;
        onPR(`New record. ${what}`);
      }
      setSetCompleted(wex.id, set.id, true, prs);
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
        className={`relative grid items-center gap-x-1 rounded-xl px-1.5 py-1.5 transition-colors ${gridCols(timed)} ${
          set.completed ? "bg-emerald-500/10" : isNext ? "bg-muted/40" : ""
        }`}
      >
        {/* "You are here" marker: neutral foreground, not green (S5 green
            audit; white = you-are-here matches the nav's active signal). */}
        {isNext && !set.completed && (
          <span
            aria-hidden
            className="-left-2.5 absolute top-1/2 h-8 w-1 -translate-y-1/2 rounded-full bg-foreground/70"
          />
        )}

        {/* Set number = a real button that opens the set menu. Plain figure
            (the Hevy/Strong cell), not a boxed control: the box read as an
            input and its 44px width starved the Last-time column at 320px.
            Hit area stays 32×52. The menu anchors here on desktop and rises
            as a sheet on phones (S6 #1). */}
        <ActionMenu
          actions={[
            ...typeActions,
            {
              label:
                set.rpe == null
                  ? "Add effort rating (RPE)…"
                  : `Effort rating: RPE ${set.rpe}…`,
              hint: "How hard the set felt, 6 (easy) to 10 (max effort).",
              icon: <Gauge aria-hidden className="size-4.5" />,
              onSelect: () => setRpeOpen(true),
            },
            {
              label:
                set.type === "warmup"
                  ? "Remove warm-up set"
                  : `Remove set ${workingIndex}`,
              hint: "Takes this row out of this workout. Your other sets stay.",
              danger: true,
              dividerBefore: true,
              icon: <Trash2 aria-hidden className="size-4.5" />,
              onSelect: handleRemoveSet,
            },
          ]}
          intro={
            wex.equipment === "barbell" && set.weight && unit === "lb" ? (
              // Flat reference text, no box (composition audit F-1: an inert
              // block passes none of comp 01 §4's earning tests), above the
              // rows so the destructive row stays last (comp 08 #18).
              <div className="mb-2 px-3">
                <div className="font-semibold text-muted-foreground text-xs">
                  Plate math for {formatWeight(set.weight)} lb
                </div>
                <div className="mt-0.5 font-mono text-foreground text-sm">
                  {plateMath(set.weight)}
                </div>
              </div>
            ) : undefined
          }
          // The set number is a leading-edge trigger: the desktop menu hangs
          // toward its own row (placement audit F-4).
          align="start"
          onOpenChange={setMenuOpen}
          open={menuOpen}
          subtitle="Change the set type, rate the effort, or remove it."
          title={setTitle}
          trigger={
            <button
              aria-label={`Options for ${setName} of ${wex.name}`}
              className="flex h-[52px] w-8 cursor-pointer items-center justify-center rounded-lg transition hover:bg-muted/60"
              onClick={() => setMenuOpen(true)}
              ref={setTriggerRef}
              type="button"
            >
              {meta.tag ? (
                <span
                  className={`font-bold font-mono text-[16px] ${meta.tagClass}`}
                >
                  {meta.tag}
                </span>
              ) : (
                <span className="font-bold font-mono text-[16px] text-muted-foreground">
                  {workingIndex}
                </span>
              )}
            </button>
          }
        />

        {/* Last time: tap to copy into this row */}
        {previous ? (
          <button
            aria-label={
              timed
                ? `Last time: ${previous.reps ?? 0} seconds. Select to use that.`
                : `Last time: ${formatWeight(previous.weight ?? 0)} ${unit} for ${previous.reps} reps. Select to use those numbers.`
            }
            className="h-[52px] cursor-pointer whitespace-nowrap rounded-xl px-0.5 text-center font-mono text-[12.5px] text-muted-foreground/80 tabular-nums transition hover:bg-muted/50 hover:text-muted-foreground disabled:pointer-events-none"
            disabled={set.completed}
            onClick={() => {
              if (!timed) {
                updateSet(wex.id, set.id, "weight", previous.weight);
              }
              updateSet(wex.id, set.id, "reps", previous.reps);
            }}
            type="button"
          >
            {/* Tight ×: the whole value must show at 320px, never an ellipsis
                (owner order S5 #7). */}
            {timed
              ? `${previous.reps ?? 0}s`
              : `${previous.weight != null ? formatWeight(previous.weight) : "-"}×${previous.reps ?? "-"}`}
          </button>
        ) : (
          <span
            aria-hidden
            className="text-center text-[13px] text-muted-foreground/50"
          >
            -
          </span>
        )}

        {!timed && (
          <NumberField
            ariaLabel={`Weight in ${unit} for ${setName} of ${wex.name}`}
            highlight={isNext}
            kind="weight"
            onCommit={(v) => updateSet(wex.id, set.id, "weight", v)}
            value={set.weight}
          />
        )}
        <NumberField
          ariaLabel={
            timed
              ? `Seconds for ${setName} of ${wex.name}`
              : `Reps for ${setName} of ${wex.name}`
          }
          highlight={isNext}
          kind="reps"
          onCommit={(v) => updateSet(wex.id, set.id, "reps", v)}
          value={set.reps}
        />

        {/* The done checkbox: EMPTY until logged (the Strong/Hevy standard;
            a pre-drawn muted check read as "already done"). The check glyph
            exists only in the checked state. Always pressable either way. */}
        <button
          aria-label={
            set.completed
              ? `${set.type === "warmup" ? "Warm-up set" : `Set ${workingIndex}`} of ${wex.name} is logged. Select to un-log it.`
              : `Log ${setName} of ${wex.name} as done`
          }
          aria-pressed={set.completed}
          className={`flex h-[52px] w-11 cursor-pointer items-center justify-center rounded-xl border-2 transition-all active:scale-95 ${
            set.completed
              ? "border-emerald-500 bg-emerald-500 text-white"
              : `bg-background hover:border-foreground/40 ${
                  isNext ? "border-foreground/50" : "border-input"
                }`
          }`}
          onClick={handleCheck}
          type="button"
        >
          {set.completed && (
            <Check aria-hidden className="size-6" strokeWidth={3} />
          )}
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
          <span className="-bottom-1 absolute left-[38px] rounded-full bg-muted px-1.5 py-px font-semibold text-[10px] text-muted-foreground">
            RPE {set.rpe}
          </span>
        )}
      </div>

      <RpePicker
        current={set.rpe}
        exerciseName={wex.name}
        onOpenChange={setRpeOpen}
        onSelect={(rpe) => setSetRpe(wex.id, set.id, rpe)}
        open={rpeOpen}
        returnFocusTo={setTriggerRef}
        setLabel={setName}
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
    uncompleteAllSets,
    removeSessionExercise,
    moveSessionExercise,
    setExerciseRest,
    setExerciseNote,
  } = useWorkouts();
  const router = useRouter();
  const noteFieldId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState(wex.note ?? "");
  // Typed note text survives Escape and scrim dismissal (flow audit F-1;
  // canon 01 §22, the house useOverlayDraft contract): the draft is only
  // re-seeded from the store while it is untouched, and a successful save
  // marks it clean again.
  const noteDraftDirty = useRef(false);
  // Screen-reader receipt for the act-in-place Move rows (canon 03 §137).
  const [moveAnnouncement, setMoveAnnouncement] = useState("");
  // Focus home for the pickers (flow audit F-5): they open from a menu row
  // that unmounts with the menu, so on close they hand focus back to the
  // card's ⋯ trigger instead of dropping it on <body> (canon 01 §89).
  const menuTriggerRef = useRef<HTMLButtonElement>(null);

  const previous = useMemo(
    () =>
      (lastSets[wex.name.trim().toLowerCase()]?.sets ?? []).filter(
        (s) => s.weight != null || s.reps != null
      ),
    [lastSets, wex.name]
  );

  // Drag-to-reorder (S5): the whole card is the sortable item, but only the
  // handle activates a drag, so the card's inputs and buttons never fight the
  // gesture and scrolling stays free (canon 01 §129). With one exercise there
  // is nothing to reorder, so the handle disappears entirely.
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: wex.id, disabled: count < 2 });

  const doneCount = wex.sets.filter((s) => s.completed).length;
  const remainingCount = wex.sets.length - doneCount;
  const allDone = wex.sets.length > 0 && doneCount === wex.sets.length;
  const restLabel =
    wex.restSeconds === 0 ? "off" : formatRestSeconds(wex.restSeconds);
  const timed = wex.kind === "timed";

  // Warm-ups keep their own numbering; working/drop/failure share one count.
  let workingCounter = 0;

  // Act-in-place move (owner ruling 2026-07-24): the menu STAYS OPEN so the
  // member selects repeatedly; the hint predicts the exact landing position
  // and the live region announces the settled result (canon 03 §137).
  function moveExercise(direction: -1 | 1) {
    const to = index + 1 + direction;
    moveSessionExercise(wex.id, direction);
    setMoveAnnouncement(`${wex.name} moved to position ${to} of ${count}.`);
  }

  function goToPicker() {
    router.push(`/workouts/exercises/pick?target=replace&wex=${wex.id}`);
  }

  const menuActions: SheetAction[] = [
    // Move rows sit at the top as their own group, the whole width of the
    // menu away from the destructive row (comp 08 §18/§19: a destructive
    // item never sits directly under a repeatedly-pressed control).
    ...(count > 1
      ? [
          {
            label: "Move up",
            hint:
              index === 0
                ? "Already first in this workout."
                : `Moves to position ${index} of ${count}.`,
            disabled: index === 0,
            keepOpen: true,
            icon: <ArrowUp aria-hidden className="size-4.5" />,
            onSelect: () => moveExercise(-1),
          } satisfies SheetAction,
          {
            label: "Move down",
            hint:
              index === count - 1
                ? "Already last in this workout."
                : `Moves to position ${index + 2} of ${count}.`,
            disabled: index === count - 1,
            keepOpen: true,
            icon: <ArrowDown aria-hidden className="size-4.5" />,
            onSelect: () => moveExercise(1),
          } satisfies SheetAction,
        ]
      : []),
    {
      label: "Exercise details",
      hint: "How to do it, your records, and your past sets.",
      dividerBefore: count > 1,
      navigates: true,
      icon: <Info aria-hidden className="size-4.5" />,
      // from=workout: the details page's back control returns HERE, not to
      // the exercise library (owner order S6 #6).
      onSelect: () =>
        router.push(
          `/workouts/exercises/${exerciseSlug(wex.name)}?from=workout`
        ),
    },
    ...(remainingCount > 0
      ? [
          {
            label:
              remainingCount === 1
                ? "Mark 1 remaining set done"
                : `Mark ${remainingCount} remaining sets done`,
            hint: "Checks off the rest of this exercise using the numbers shown.",
            icon: <CheckCheck aria-hidden className="size-4.5" />,
            onSelect: () =>
              completeAllSets(
                collectRemainingPRs([wex], prBaseline, unit),
                wex.id
              ),
          } satisfies SheetAction,
        ]
      : []),
    ...(doneCount > 0
      ? [
          {
            label:
              doneCount === 1 ? "Unmark 1 set" : `Unmark all ${doneCount} sets`,
            hint: "Clears the done check on this exercise. Your logged numbers stay.",
            icon: <Undo2 aria-hidden className="size-4.5" />,
            onSelect: () => uncompleteAllSets(wex.id),
          } satisfies SheetAction,
        ]
      : []),
    {
      label: "Add warm-up set",
      hint: "Lighter prep set above your working sets. Not counted in totals or records.",
      icon: <Plus aria-hidden className="size-4.5" />,
      onSelect: () => addSet(wex.id, "warmup"),
    },
    {
      label: wex.note ? "Edit exercise note…" : "Add exercise note…",
      hint: "Saved with this exercise in today's workout.",
      icon: <StickyNote aria-hidden className="size-4.5" />,
      onSelect: () => {
        if (!noteDraftDirty.current) {
          setNoteDraft(wex.note ?? "");
        }
        setEditingNote(true);
      },
    },
    {
      label: `Rest timer: ${restLabel}…`,
      hint: "Counts down after you check off each set.",
      icon: <Timer aria-hidden className="size-4.5" />,
      onSelect: () => setRestOpen(true),
    },
    {
      // The chevron carries "leaves this screen" (comp 08 #40); the ellipsis
      // stays for overlay-openers only, so one glyph means one thing.
      label: "Replace exercise",
      navigates: true,
      hint:
        doneCount === 0
          ? "Choose a different exercise for this spot in your workout."
          : doneCount === 1
            ? "Choose a different exercise for this spot. The set you logged here is removed."
            : `Choose a different exercise for this spot. The ${doneCount} sets you logged here are removed.`,
      icon: <Repeat aria-hidden className="size-4.5" />,
      // Logged sets do NOT survive a replace (store: replace-session-exercise
      // keeps only position and rest), so with sets logged this is
      // destructive and gets its one safety net, a confirm.
      onSelect: () =>
        doneCount > 0 ? setConfirmingReplace(true) : goToPicker(),
    },
    {
      label: "Remove exercise",
      hint: "Takes it and its sets out of this workout.",
      danger: true,
      dividerBefore: true,
      icon: <Trash2 aria-hidden className="size-4.5" />,
      onSelect: () => setConfirmingRemove(true),
    },
  ];

  return (
    <WCard
      className={`min-w-0 p-4 transition-opacity ${allDone ? "opacity-75" : ""} ${
        isDragging ? "relative z-10 shadow-2xl ring-1 ring-foreground/25" : ""
      }`}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          {/* Position in the workout: sequence must be obvious at a glance
              (owner order S5 #1), and it re-numbers live after a drag. */}
          <span
            aria-hidden
            className="mt-0.5 font-bold font-mono text-base text-muted-foreground tabular-nums leading-6"
          >
            {index + 1}
          </span>
          <span className="sr-only">
            Exercise {index + 1} of {count}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-bold text-[17px] text-foreground">
                {wex.name}
              </h3>
              {/* All-done marker: a quiet check, not a green disc (S5 green
                audit: on this page only a checked set reads green). */}
              {allDone && (
                <Check
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                  strokeWidth={3}
                />
              )}
            </div>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {weightMeaning(wex.equipment, wex.kind, unit)} · Rest timer{" "}
              {restLabel}
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
        </div>
        {/* gap-2 keeps the two 44px hit areas from touching (canon 01 §112:
            adjacent targets need spacing; a reorder reach must not open the
            menu). */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Drag handle (S5 #2): the one drag surface, so the card's inputs
              never fight the gesture. Keyboard path: space lifts, arrows
              move, space drops (the dnd keyboard sensor). Hidden when there
              is nothing to reorder. touch-action:none is required for the
              long-press lift to win over scrolling. */}
          {count > 1 && (
            <WButton
              {...attributes}
              {...listeners}
              aria-label={`Reorder ${wex.name}, position ${index + 1} of ${count}. Press space to pick up, use arrow keys to move, press space again to drop.`}
              className="size-11 cursor-grab px-0 text-muted-foreground active:cursor-grabbing"
              ref={setActivatorNodeRef}
              size="sm"
              style={{ touchAction: "none" }}
              variant="ghost"
            >
              <GripVertical aria-hidden className="size-5" />
            </WButton>
          )}
          <ActionMenu
            actions={menuActions}
            liveMessage={moveAnnouncement}
            onOpenChange={setMenuOpen}
            open={menuOpen}
            subtitle={`Exercise ${index + 1} of ${count} in this workout`}
            title={wex.name}
            trigger={
              <button
                aria-label={`Options for ${wex.name}`}
                className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                onClick={() => setMenuOpen(true)}
                ref={menuTriggerRef}
                type="button"
              >
                <MoreHorizontal aria-hidden className="size-5" />
              </button>
            }
          />
        </div>
      </div>

      {/* Column headers. Sentence case (Q-DS-4 sweep): tracked uppercase
          "LAST TIME" cannot fit the column's 64px floor at 320px. */}
      <div
        className={`mt-3 grid gap-x-1 px-1.5 text-center font-semibold text-[12px] text-muted-foreground/80 ${gridCols(timed)}`}
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

      {/* Pickers & dialogs (each opens AFTER the menu closed; overlays never
          stack). */}
      <RestTimerPicker
        onOpenChange={setRestOpen}
        onSave={(seconds) => setExerciseRest(wex.id, seconds)}
        open={restOpen}
        returnFocusTo={menuTriggerRef}
        wex={wex}
      />
      {editingNote && (
        <ConfirmDialog
          confirmLabel="Save note"
          onCancel={() => setEditingNote(false)}
          onConfirm={() => {
            setExerciseNote(wex.id, noteDraft);
            noteDraftDirty.current = false;
            setEditingNote(false);
          }}
          open
          title={`Note for ${wex.name}`}
        >
          {/* mt-5: the title-to-form boundary must outrank the intra-form
              gaps (composition audit minor; comp 04 §5). resize-none: the
              member must not be able to break the dialog's height budget. */}
          <label
            className="mt-5 block font-semibold text-foreground text-sm"
            htmlFor={noteFieldId}
          >
            Your note
          </label>
          <textarea
            aria-describedby={`${noteFieldId}-count`}
            className="mt-1.5 min-h-20 w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground/60 focus:border-blood/60 focus:outline-none"
            id={noteFieldId}
            maxLength={1000}
            onChange={(e) => {
              noteDraftDirty.current = true;
              setNoteDraft(e.target.value);
            }}
            placeholder="Felt heavy, drop to 185 next time."
            value={noteDraft}
          />
          {/* Counter slot (S6 #4, comp 03 §26/§33: after the input, on a real
              limit). Space is reserved so nothing jumps; the count appears
              from 900 characters (the goal-form precedent) so it is not
              permanent noise. */}
          {/* Advisory, not an error (flow audit F-10): the note saves fine. */}
          <div className="mt-1 flex min-h-5 items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs" role="status">
              {/* No "saved" claim before Save is pressed (copy audit F-2). */}
              {noteDraft.length >= 1000 ? "1,000 character limit reached." : ""}
            </span>
            {noteDraft.length >= 900 && (
              <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                {noteDraft.length}/1000
              </span>
            )}
          </div>
          <span className="sr-only" id={`${noteFieldId}-count`}>
            Note length: {noteDraft.length} of 1000 characters.
          </span>
        </ConfirmDialog>
      )}
      <ConfirmDialog
        body={
          doneCount > 0
            ? `The ${doneCount} ${doneCount === 1 ? "set" : "sets"} you logged for it will be removed too. Your saved workout plan is not changed.`
            : "Your saved workout plan is not changed."
        }
        confirmLabel="Remove exercise"
        destructive
        onCancel={() => setConfirmingRemove(false)}
        onConfirm={() => {
          removeSessionExercise(wex.id);
          setConfirmingRemove(false);
        }}
        open={confirmingRemove}
        title={`Remove ${wex.name} from this workout?`}
      />
      {/* Replace with logged sets = destructive (the store's replace keeps
          only position and rest); the confirm is its one safety net. */}
      <ConfirmDialog
        body={
          doneCount === 1
            ? "The set you logged for it will be removed. The new exercise starts with empty sets in the same spot, with the same rest timer."
            : `The ${doneCount} sets you logged for it will be removed. The new exercise starts with empty sets in the same spot, with the same rest timer.`
        }
        confirmLabel="Replace exercise"
        destructive
        onCancel={() => setConfirmingReplace(false)}
        onConfirm={() => {
          setConfirmingReplace(false);
          goToPicker();
        }}
        open={confirmingReplace}
        title={`Replace ${wex.name}?`}
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
}: {
  lastSets: Record<string, LastExerciseLog>;
  prBaseline: Record<string, PrBaseline>;
}) {
  const {
    session,
    ready,
    completeAllSets,
    uncompleteAllSets,
    renameSession,
    timerPlay,
    timerPause,
    timerReset,
    timerStartCountdown,
    timerFinishCountdown,
    timerCancelCountdown,
    discardSession,
    reorderSessionExercise,
  } = useWorkouts();
  const router = useRouter();
  const now = useNowTick();

  // Reorder = one drag (owner S5 #2). Mouse drags after 4px of travel so a
  // plain click still clicks; touch lifts after a long-press (250ms) so
  // scrolling never starts a drag; keyboard gets the full pick-up/move/drop
  // path. The menu's Move up/down rows (restored by S6 as a quiet secondary
  // path) cover WCAG 2.5.7's single-pointer non-drag alternative.
  const dragSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleReorderEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!(session && over) || active.id === over.id) {
      return;
    }
    const to = session.exercises.findIndex((x) => x.id === over.id);
    if (to !== -1) {
      reorderSessionExercise(String(active.id), to);
    }
  }

  // Screen-reader narration for the reorder drag, in product language: the
  // dnd library's defaults read out internal ids ("Draggable item wex-1..."),
  // which is member-facing jargon (flow audit F-3).
  const exerciseName = (id: unknown) =>
    session?.exercises.find((x) => x.id === id)?.name ?? "the exercise";
  const exercisePosition = (id: unknown) => {
    const i = session?.exercises.findIndex((x) => x.id === id) ?? -1;
    return i === -1
      ? ""
      : `, position ${i + 1} of ${session?.exercises.length}`;
  };
  const dragAccessibility = {
    screenReaderInstructions: {
      draggable:
        "To reorder, press space to pick up the exercise, use the arrow keys to move it, and press space again to drop it. Press escape to cancel.",
    },
    announcements: {
      onDragStart: ({ active }: { active: { id: unknown } }) =>
        `Picked up ${exerciseName(active.id)}${exercisePosition(active.id)}.`,
      onDragOver: ({
        active,
        over,
      }: {
        active: { id: unknown };
        over: { id: unknown } | null;
      }) =>
        over
          ? `${exerciseName(active.id)} is over${exercisePosition(over.id)}.`
          : `${exerciseName(active.id)} is not over a drop position.`,
      onDragEnd: ({
        active,
        over,
      }: {
        active: { id: unknown };
        over: { id: unknown } | null;
      }) =>
        over
          ? `${exerciseName(active.id)} dropped${exercisePosition(over.id)}.`
          : `${exerciseName(active.id)} dropped, order unchanged.`,
      onDragCancel: ({ active }: { active: { id: unknown } }) =>
        `Reorder cancelled. ${exerciseName(active.id)} returned to its position.`,
    },
  };

  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [discarding, setDiscarding] = useState(false);
  const [prToast, setPrToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Start countdown (S4). `begunFlash` keeps the overlay up for the brief
  // "Go" moment after the clock has already started. Leaving the player
  // mid-countdown abandons it (back to pre-start on return): together with
  // the hydrate strip in the store, a countdown can never outlive the Play
  // press that opened it, so nothing ever auto-starts.
  const [begunFlash, setBegunFlash] = useState(false);
  const begunTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // When the overlay closes, focus lands on the transport control the Play
  // press turned into (Pause), per the overlay focus-return contract.
  const playPauseRef = useRef<HTMLButtonElement>(null);
  const countingRef = useRef(false);
  countingRef.current = Boolean(session?.timer.countdownEndsAt);
  const cancelCountdownRef = useRef(timerCancelCountdown);
  cancelCountdownRef.current = timerCancelCountdown;
  useEffect(
    () => () => {
      if (begunTimer.current) {
        clearTimeout(begunTimer.current);
      }
      if (countingRef.current) {
        cancelCountdownRef.current();
      }
    },
    []
  );

  function handleCountdownBegin() {
    timerFinishCountdown();
    setBegunFlash(true);
    begunTimer.current = setTimeout(() => {
      setBegunFlash(false);
      playPauseRef.current?.focus();
    }, 750);
  }

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
  const volume = session ? sessionVolumeLb(session.exercises, session.unit) : 0;
  const exercisesDone = session
    ? session.exercises.filter(
        (ex) => ex.sets.length > 0 && ex.sets.every((s) => s.completed)
      ).length
    : 0;
  const uncheckedSets = totalSets - doneSets;

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
      // biome-ignore lint/a11y/useSemanticElements: role="status" is the standard live-region idiom; swapping to <output> changes element semantics and default display for zero AT gain.
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

  return (
    <>
      {/* Sticky session header */}
      <div className="-mx-4 sticky top-0 z-30 mb-4 border-border border-b bg-background/95 px-4 pt-2 pb-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        {/* Utility row: navigation left, the commit action right (the
            Hevy/Strong top-bar contract). Shrink discipline (flaws RUN-68):
            the back label is the only flexible item, so the Finish button
            can never be pushed past the viewport edge. */}
        <div className="flex items-center justify-between gap-2">
          <button
            aria-label="Back to Workouts"
            className="-ml-1.5 inline-flex min-h-[44px] min-w-0 shrink cursor-pointer items-center gap-1 rounded-lg px-1.5 font-semibold text-[13.5px] text-muted-foreground transition hover:text-foreground"
            onClick={() => router.push("/workouts")}
            type="button"
          >
            <ChevronLeft aria-hidden className="size-4" />
            <span className="max-[359px]:hidden">Workouts</span>
            <span className="min-[360px]:hidden">Back</span>
          </button>

          <WButton
            className="min-h-[44px] shrink-0 px-4"
            disabled={totalSets === 0}
            // The finish step is its own page (composition canon 04 §11/§12:
            // the old confirm dialog outgrew its container), same mid-flow
            // route grammar as the exercise picker.
            onClick={() => router.push("/workouts/active/finish")}
            size="sm"
            variant="secondary"
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
              <WButton
                className="min-h-[44px]"
                size="sm"
                type="submit"
                variant="secondary"
              >
                Save
              </WButton>
            </form>
          ) : (
            <button
              aria-label={`Workout name: ${session.name}. Select to rename.`}
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
          {/* The session timer: clock digits + transport controls composed
              as ONE instrument in its own designated row (stopwatch
              grammar). Explicit Play / Pause / Reset; nothing auto-starts;
              the FIRST Play press runs the start countdown. */}
          <div className="mt-1.5 flex min-h-11 items-center gap-2.5">
            <span
              aria-label={`Workout time: ${formatClock(elapsed)}${
                session.timer.running
                  ? ", running"
                  : timerStarted
                    ? ", paused"
                    : ", not started"
              }`}
              className={`font-mono font-semibold text-2xl tabular-nums leading-none ${
                session.timer.running
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
              role="timer"
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
              className={`flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition ${
                session.timer.running
                  ? "bg-muted/70 text-foreground hover:bg-muted"
                  : "bg-foreground text-background hover:opacity-90"
              }`}
              onClick={() => {
                if (session.timer.running) {
                  timerPause();
                } else if (timerStarted) {
                  timerPlay();
                } else {
                  // The Play gesture authorizes the countdown's audio.
                  primeStartCues();
                  timerStartCountdown();
                }
              }}
              ref={playPauseRef}
              type="button"
            >
              {session.timer.running ? (
                <Pause aria-hidden className="size-5 fill-current" />
              ) : (
                <Play aria-hidden className="size-5 fill-current" />
              )}
            </button>
            {timerStarted ? (
              <button
                aria-label="Reset the workout timer to zero"
                className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
                onClick={timerReset}
                type="button"
              >
                <RotateCcw aria-hidden className="size-5" />
              </button>
            ) : (
              <p className="min-w-0 text-muted-foreground text-sm">
                Press play to begin
              </p>
            )}
            {timerStarted && !session.timer.running && (
              <span className="text-muted-foreground text-sm">Paused</span>
            )}
          </div>
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
                  className="h-full rounded-full bg-foreground transition-all duration-300"
                  style={{
                    width: `${totalSets ? (doneSets / totalSets) * 100 : 0}%`,
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Session-wide bulk check-off (owner order s181: not only inside the
          per-exercise menu), with its inverse beside it once anything is
          checked (owner S5). Unmark clears only the done checks; numbers
          stay, and PR toasts never re-fire on a later re-check. */}
      {(uncheckedSets > 0 || doneSets > 0) && (
        <div className="mb-3 flex flex-wrap justify-end gap-2">
          {doneSets > 0 && (
            <WButton
              aria-label="Unmark every set in this workout"
              className="min-h-11 gap-1.5"
              onClick={() => uncompleteAllSets()}
              size="sm"
              variant="ghost"
            >
              <Undo2 aria-hidden className="size-4" />
              Unmark all sets
            </WButton>
          )}
          {uncheckedSets > 0 && (
            <WButton
              aria-label="Mark every set in this workout as done"
              className="min-h-11 gap-1.5"
              onClick={() =>
                completeAllSets(
                  collectRemainingPRs(
                    session.exercises,
                    prBaseline,
                    session.unit
                  )
                )
              }
              size="sm"
            >
              <CheckCheck aria-hidden className="size-4" />
              Mark all sets done
            </WButton>
          )}
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
            onClick={() =>
              router.push("/workouts/exercises/pick?target=session")
            }
            size="lg"
            variant="primary"
          >
            <Plus aria-hidden className="size-5" />
            Add your first exercise
          </WButton>
        </WCard>
      ) : (
        /* Two-across on desktop (LAY-1), kept for S5: the number badges make
           the row-major reading order explicit. items-start so a card only
           grows with its own sets; grid-cols-1 + min-w-0 so the implicit
           column never sizes to max-content on phones. The whole list is one
           sortable context: dragging a card re-slots it live, at any
           distance, in one gesture. */
        <DndContext
          accessibility={dragAccessibility}
          collisionDetection={closestCenter}
          onDragEnd={handleReorderEnd}
          sensors={dragSensors}
        >
          <SortableContext
            items={session.exercises.map((x) => x.id)}
            strategy={rectSortingStrategy}
          >
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
          </SortableContext>
        </DndContext>
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
        {/* One verb for one action (copy audit F-6): a live workout is
            discarded; "delete" stays reserved for saved records. */}
        <p className="mt-2 text-center text-[12px] text-muted-foreground/80 sm:text-left">
          Discards this workout without saving. Your saved workouts and
          history are untouched.
        </p>
      </div>

      {/* PR toast */}
      {prToast && (
        // biome-ignore lint/a11y/useSemanticElements: role="status" is the standard live-region idiom; swapping to <output> changes element semantics and default display for zero AT gain.
        <div
          className="fixed top-4 left-1/2 z-[85] flex w-[calc(100%-32px)] max-w-[420px] -translate-x-1/2 animate-in items-center gap-2.5 rounded-2xl border border-amber-400/40 bg-popover px-4 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.5)] duration-300 zoom-in-95"
          role="status"
        >
          <Trophy
            aria-hidden
            className="size-5 shrink-0 text-amber-500 dark:text-amber-300"
          />
          <span className="font-semibold text-[14.5px] text-foreground">
            {prToast}
          </span>
        </div>
      )}

      {/* Start countdown (S4): the moment between the first Play press and
          the clock's first second, held briefly for the "Go" flash. */}
      {(Boolean(session.timer.countdownEndsAt) || begunFlash) && (
        <StartCountdown
          endsAt={session.timer.countdownEndsAt ?? 0}
          onBegin={handleCountdownBegin}
          onCancel={timerCancelCountdown}
          phase={session.timer.countdownEndsAt ? "counting" : "begun"}
          totalMs={START_COUNTDOWN_SECONDS * 1000}
        />
      )}

      {/* Discard confirm: same title shape and consequence sentence as the
          mini bar's discard (copy audit F-5; canon 04 §132: one action, one
          dialog everywhere). */}
      <ConfirmDialog
        body={
          doneSets > 0
            ? `The ${doneSets} ${doneSets === 1 ? "set" : "sets"} you logged will not be saved.`
            : "Its timer will be cleared. Nothing has been saved yet."
        }
        confirmLabel="Discard workout"
        destructive
        onCancel={() => setDiscarding(false)}
        onConfirm={() => {
          discardSession();
          setDiscarding(false);
          router.push("/workouts");
        }}
        open={discarding}
        title={`Discard "${session.name}"?`}
      />
    </>
  );
}
