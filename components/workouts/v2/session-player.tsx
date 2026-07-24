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
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { saveWorkout } from "@/app/workouts/actions";
import { Input } from "@/components/ui/input";
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
import { primeStartCues, StartCountdown } from "./start-countdown";
import { persistSessionCleared, useWorkouts } from "./store";
import type { PRKind, SessionExercise, SessionSet } from "./types";
import {
  REST_OPTIONS,
  RPE_OPTIONS,
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
  const { updateSet, setSetCompleted, setSetType, setSetRpe, removeSet } =
    useWorkouts();
  const [menuOpen, setMenuOpen] = useState(false);
  const [rpeOpen, setRpeOpen] = useState(false);
  const meta = SET_TYPE_META[set.type];
  const timed = wex.kind === "timed";

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
            Hit area stays 32×52. */}
        <button
          aria-label={`Set ${index + 1} options: change set type, add RPE, or remove it`}
          className="flex h-[52px] w-8 cursor-pointer items-center justify-center rounded-lg transition hover:bg-muted/60"
          onClick={() => setMenuOpen(true)}
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

        {/* The done checkbox: EMPTY until logged (the Strong/Hevy standard;
            a pre-drawn muted check read as "already done"). The check glyph
            exists only in the checked state. Always pressable either way. */}
        <button
          aria-label={
            set.completed
              ? `Set ${index + 1} of ${wex.name} is logged. Select to un-log it.`
              : `Log set ${index + 1} of ${wex.name} as done`
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

      <ActionSheet
        actions={[
          ...typeActions,
          {
            label:
              set.rpe == null
                ? "Add effort rating (RPE)"
                : `Effort: RPE ${set.rpe}`,
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
              <div className="font-semibold text-[12px] text-muted-foreground">
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
    uncompleteAllSets,
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
      onSelect: () =>
        router.push(`/workouts/exercises/${exerciseSlug(wex.name)}`),
    },
    ...(wex.sets.some((s) => !s.completed)
      ? [
          {
            label: "Mark all sets done for this exercise",
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
    ...(doneCount > 0
      ? [
          {
            label: "Unmark all sets for this exercise",
            hint: "Clears the done check on every set, your logged numbers stay",
            icon: <Undo2 aria-hidden className="size-[18px]" />,
            onSelect: () => uncompleteAllSets(wex.id),
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
    {
      label: "Remove exercise",
      hint: "Removes it and its sets from this workout",
      danger: true,
      icon: <Trash2 aria-hidden className="size-[18px]" />,
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
          <button
            aria-label={`More options for ${wex.name}`}
            className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
            onClick={() => setMenuOpen(true)}
            type="button"
          >
            <MoreHorizontal aria-hidden className="size-5" />
          </button>
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
            placeholder="Add a note for this exercise"
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

/** Parse the Finish dialog's duration fields into clamped seconds (0 to 24h). */
function draftDurationSeconds(draft: { min: string; sec: string }): number {
  const min = Number.parseInt(draft.min, 10);
  const sec = Number.parseInt(draft.sec, 10);
  const total =
    (Number.isNaN(min) ? 0 : min) * 60 + (Number.isNaN(sec) ? 0 : sec);
  return Math.min(Math.max(total, 0), 86_400);
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
    uncompleteAllSets,
    renameSession,
    setSessionNotes,
    timerPlay,
    timerPause,
    timerReset,
    timerStartCountdown,
    timerFinishCountdown,
    timerCancelCountdown,
    clearSession,
    discardSession,
    reorderSessionExercise,
  } = useWorkouts();
  const router = useRouter();
  const now = useNowTick();

  // Reorder = one drag (owner S5 #2). Mouse drags after 4px of travel so a
  // plain click still clicks; touch lifts after a long-press (250ms) so
  // scrolling never starts a drag; keyboard gets the full pick-up/move/drop
  // path (WCAG 2.5.7, the Move up/down menu items are gone).
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
    return i === -1 ? "" : `, position ${i + 1} of ${session?.exercises.length}`;
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
  const [finishing, setFinishing] = useState(false);
  const [alsoUpdateTemplate, setAlsoUpdateTemplate] = useState(false);
  const [completeRemaining, setCompleteRemaining] = useState(false);
  // The finish save runs inside a transition: React requires server
  // functions called from event handlers to run in one (S2 logged the
  // useActionState warning against S1's plain-async version), and the
  // pending flag then also holds the dialog busy until the complete page's
  // navigation commits.
  const [saving, startFinishTransition] = useTransition();
  const [discarding, setDiscarding] = useState(false);
  const [prToast, setPrToast] = useState<string | null>(null);
  // Duration shown in the Finish dialog, frozen when the dialog opens so what
  // the member reads is exactly what gets saved. Editable: people who get
  // interrupted mid-workout shouldn't be forced to log a wrongly-timed session.
  const [durationDraft, setDurationDraft] = useState({ min: "", sec: "" });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Finish-flash fix: the session is cleared on UNMOUNT (after the complete
  // page's navigation commits), never before router.push, so the player can't
  // re-render into its "No workout is running" branch while the complete page
  // is still server-rendering. The dispatch is deferred to a microtask: fired
  // synchronously from the cleanup it lands MID-commit and re-renders the
  // outgoing player with a null session (the flash this fix exists to kill);
  // a microtask runs after the commit but before the browser paints, so the
  // mini bar can't flash on the complete page either.
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

  function handleFinishConfirmed() {
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
    // The corrected duration also corrects the calorie estimate: duration is
    // an input to the saved workout's energy computation.
    const durationSeconds = draftDurationSeconds(durationDraft);
    const payload = serializeSession(sessionForSave, durationSeconds);
    if (!payload) {
      toast.error(
        "Nothing is checked off yet. Check off your sets, or turn on “Mark all unchecked sets as done”."
      );
      return;
    }
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
        toast.error(result.error ?? "Couldn't save that workout. Try again.");
        return;
      }
      // The transition keeps the dialog in its busy state until the complete
      // page's navigation commits and unmounts this player; the unmount cleanup
      // clears the session. Clearing here would flash "No workout is running"
      // for the seconds the complete page takes to server-render. The persisted
      // copy is wiped NOW, so even a navigation that degrades to a full page
      // load can never rehydrate the saved workout as a zombie session.
      clearOnUnmount.current = true;
      persistSessionCleared();
      router.push(`/workouts/history/${result.id}?new=1`);
      router.refresh();
    });
  }

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
            onClick={() => {
              setAlsoUpdateTemplate(false);
              // ALWAYS opt-in (flaws RUN-72): sets the member never checked
              // are never marked done by default. With nothing checked and
              // the box unticked, save is refused with a corrective toast.
              setCompleteRemaining(false);
              // Freeze the timed duration into the editable draft: the value
              // the dialog shows is the value that saves, even if the clock
              // keeps running behind the scrim.
              setDurationDraft({
                min: String(Math.floor(elapsed / 60)),
                sec: String(elapsed % 60),
              });
              setFinishing(true);
            }}
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
        <p className="mt-2 text-center text-[12px] text-muted-foreground/80 sm:text-left">
          Deletes this workout without saving. Your saved workouts and history
          are untouched.
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
        confirmLabel="Finish and save"
        onCancel={() => setFinishing(false)}
        onConfirm={handleFinishConfirmed}
        open={finishing}
        title="Finish workout?"
      >
        <div className="mt-4">
          {/* One compact row: the finish dialog must keep its primary action
              inside a 320x568 viewport (the RUN-70 fit gate). */}
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-muted-foreground text-sm">
              Duration
            </span>
            <div className="flex items-center gap-1.5">
              <Input
                aria-label="Duration, minutes"
                className="w-14 rounded-xl bg-background text-center font-bold font-mono tabular-nums"
                inputMode="numeric"
                onChange={(e) =>
                  setDurationDraft((d) => ({
                    ...d,
                    min: e.target.value.replace(/\D/g, "").slice(0, 4),
                  }))
                }
                onFocus={(e) => e.target.select()}
                size="lg"
                type="text"
                value={durationDraft.min}
              />
              <span className="font-semibold text-muted-foreground text-sm">
                min
              </span>
              <Input
                aria-label="Duration, seconds"
                className="w-14 rounded-xl bg-background text-center font-bold font-mono tabular-nums"
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
                size="lg"
                type="text"
                value={durationDraft.sec}
              />
              <span className="font-semibold text-muted-foreground text-sm">
                sec
              </span>
            </div>
          </div>
          <p className="mt-1 text-muted-foreground text-xs">
            Timed automatically. Adjust it if the timer ran while you were
            interrupted.
          </p>
        </div>
        <label className="mt-4 block">
          <span className="mb-1.5 block font-semibold text-[13px] text-muted-foreground">
            Workout notes (optional, saved with this workout)
          </span>
          <textarea
            className="min-h-[64px] w-full rounded-xl border border-input bg-background px-3 py-2.5 text-[14.5px] text-foreground placeholder:text-muted-foreground/60 focus:border-blood/60 focus:outline-none"
            maxLength={2000}
            onChange={(e) => setSessionNotes(e.target.value)}
            placeholder="Add a note about how this workout went"
            value={session.notes}
          />
        </label>
        {uncheckedSets > 0 && (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3.5">
            <input
              checked={completeRemaining}
              className="mt-0.5 size-5 accent-[var(--go)]"
              onChange={(e) => setCompleteRemaining(e.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block font-semibold text-[14px] text-foreground">
                Mark all {uncheckedSets} unchecked{" "}
                {uncheckedSets === 1 ? "set" : "sets"} as done
              </span>
              <span className="mt-0.5 block text-[12.5px] text-muted-foreground leading-relaxed">
                Did the work but didn't check off every set? This saves every
                remaining set with the weights and reps already shown.
              </span>
            </span>
          </label>
        )}
        {structureChanged && sourceTemplate && (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3.5">
            <input
              checked={alsoUpdateTemplate}
              className="mt-0.5 size-5 accent-[var(--go)]"
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
            ? `The ${doneSets} ${doneSets === 1 ? "set" : "sets"} you logged in this workout will be permanently deleted.`
            : "This workout will be deleted. Nothing has been logged yet."
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
        title="Discard this workout?"
      />
    </>
  );
}
