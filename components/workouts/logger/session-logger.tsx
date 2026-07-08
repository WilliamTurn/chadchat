"use client";

import {
  ArrowDown,
  ArrowLeft,
  ArrowLeftRight,
  ArrowUp,
  Check,
  Flame,
  Link2,
  MoreVertical,
  NotebookPen,
  Pause,
  Play,
  Plus,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { editWorkout, saveWorkout } from "@/app/workouts/actions";
import { AskChadButton } from "@/components/chad/ask-chad-button";
import { KpiHelp } from "@/components/dashboard/kpi";
import { useReward } from "@/components/dashboard/reward";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PlateCalculator } from "@/components/workouts/plate-calculator";
import { GROUP_CHIPS, GROUP_RAILS, supersetLabel } from "@/components/workouts/superset";
import { todayLocalISO } from "@/lib/date";
import { cn } from "@/lib/utils";
import { MUSCLE_GROUP_LABELS, type MuscleGroup } from "@/lib/workouts/exercise-library";
import type {
  ExerciseKindData,
  LastExerciseLog,
  PrBaseline,
  SetType,
  WorkoutData,
} from "@/lib/workouts/stats";
import { epley1RM, toLb } from "@/lib/workouts/stats";
import { CustomExercisePanel } from "./custom-exercise-panel";
import { ExercisePickerPanel, type PickedExercise } from "./exercise-picker-panel";
import { FinishSummary, type MuscleSlice, type SummaryPr } from "./finish-summary";
import {
  blankSet,
  clearDraft,
  deriveGroups,
  detectSetPr,
  draftIsMeaningful,
  type EditorExercise,
  type EditorSet,
  formatLastLine,
  fromPlan,
  fromWorkout,
  fromWorkoutAsRepeat,
  ghostAt,
  ghostsFromHistory,
  isNumeric,
  liveSetProgress,
  liveVolumeLb,
  type LoggerMode,
  type PlanPrefill,
  PR_LABEL,
  readDraft,
  SET_TYPE_LABEL,
  SET_TYPE_ORDER,
  type SessionDraft,
  uid,
  warmupRamp,
  writeDraft,
  type CustomExerciseRow,
} from "./model";
import { RestTimerBar, RestTimerCard, useRestTimer } from "./rest-timer";

const todayISO = todayLocalISO;

function mmss(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * The session stopwatch. NEVER starts on its own: opening the logger says
 * nothing about whether the member is mid-workout or logging yesterday's
 * session after the fact (owner order, s171 hotfix). It sits at 0:00 until
 * they tap play; pause/resume at will; elapsed survives via the draft.
 */
function useStopwatch(frozen: boolean): {
  elapsed: number;
  running: boolean;
  toggle: () => void;
  reset: (seconds: number) => void;
} {
  const [baseSeconds, setBaseSeconds] = useState(0);
  const [runningSince, setRunningSince] = useState<number | null>(null);
  const [, setTick] = useState(0);

  const running = runningSince != null && !frozen;

  useEffect(() => {
    if (!running) {
      return;
    }
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const elapsed =
    baseSeconds +
    (runningSince != null
      ? Math.max(0, Math.floor((Date.now() - runningSince) / 1000))
      : 0);

  const toggle = useCallback(() => {
    setRunningSince((since) => {
      if (since == null) {
        return Date.now();
      }
      setBaseSeconds(
        (b) => b + Math.max(0, Math.floor((Date.now() - since) / 1000))
      );
      return null;
    });
  }, []);

  /** Load a saved elapsed value (draft resume), left PAUSED. */
  const reset = useCallback((seconds: number) => {
    setBaseSeconds(Math.max(0, Math.floor(seconds)));
    setRunningSince(null);
  }, []);

  return { elapsed, running, toggle, reset };
}

/** Keep the screen awake during a live session (the Hevy "keep awake"
 *  setting); a phone that sleeps mid-set loses the rest timer. Best-effort:
 *  browsers without the Wake Lock API just skip it. */
function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) {
      return;
    }
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const acquire = async () => {
      try {
        lock = await (
          navigator as Navigator & {
            wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> };
          }
        ).wakeLock.request("screen");
      } catch {
        // Denied (low battery, background tab); not worth surfacing.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && !cancelled) {
        void acquire();
      }
    };
    void acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}

type View =
  | { kind: "log" }
  | { kind: "pick"; replaceUid: string | null }
  | { kind: "custom"; seedName: string; editRow: CustomExerciseRow | null; replaceUid: string | null };

export function SessionLogger({
  mode,
  initial,
  plan,
  lastSets,
  customExercises,
  prBaseline,
  recentVolumes,
}: {
  // "repeat" prefills exercises from `initial` with values ghosted and saves a
  // NEW workout dated today; "plan" lays out a training-plan day (FN-2).
  mode: LoggerMode;
  initial?: WorkoutData;
  plan?: PlanPrefill;
  lastSets: Record<string, LastExerciseLog>;
  customExercises: CustomExerciseRow[];
  /** All-time bests per exercise (lowercased) for live PR detection. */
  prBaseline: Record<string, PrBaseline>;
  /** Recent sessions' volumes (lb), for the summary's vs-average line. */
  recentVolumes: number[];
}) {
  const router = useRouter();
  const reward = useReward();
  const isEdit = mode === "edit";
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<View>({ kind: "log" });
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const timer = useRestTimer();

  function initialTitle(): string {
    if (mode === "plan") {
      return plan?.title ?? "";
    }
    return initial?.title ?? "";
  }
  function initialExercises(): EditorExercise[] {
    if (mode === "plan") {
      return plan ? fromPlan(plan.exercises) : [];
    }
    if (mode === "repeat") {
      return initial ? fromWorkoutAsRepeat(initial) : [];
    }
    return initial ? fromWorkout(initial) : [];
  }

  const [title, setTitle] = useState(initialTitle);
  const [date, setDate] = useState(
    initial && isEdit ? initial.performedAt.slice(0, 10) : todayISO()
  );
  const [durationMin, setDurationMin] = useState(
    initial?.durationSeconds && isEdit
      ? String(Math.round(initial.durationSeconds / 60))
      : ""
  );
  const [notes, setNotes] = useState(isEdit ? (initial?.notes ?? "") : "");
  const [exercises, setExercises] = useState<EditorExercise[]>(initialExercises);
  // Exercises whose notes editor is open even while empty.
  const [notesOpen, setNotesOpen] = useState<Set<string>>(new Set());
  const [resumeOffer, setResumeOffer] = useState<SessionDraft | null>(null);
  const [summary, setSummary] = useState<{
    title: string;
    durationSeconds: number | null;
    volumeLb: number;
    setsDone: number;
    exerciseCount: number;
    prs: SummaryPr[];
    muscles: MuscleSlice[];
    volumeVsAverage: number | null;
    chadPrompt: string;
  } | null>(null);

  const finished = summary != null;
  // The session stopwatch: 0:00 and PAUSED until the member taps play.
  const clock = useStopwatch(finished);
  // Keep the screen awake only while they're actually timing a session.
  useWakeLock(clock.running && !finished);

  // Offer to resume an interrupted session (locked phone, killed tab). Never
  // in edit mode; reopening an old workout isn't an in-progress session.
  useEffect(() => {
    if (isEdit) {
      return;
    }
    const draft = readDraft();
    if (draft && draftIsMeaningful(draft.exercises)) {
      setResumeOffer(draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
  }, []);

  // Autosave the in-progress session (debounced). Cleared on finish/discard.
  // The clock's elapsed value rides along via a ref so a ticking second
  // doesn't rewrite the draft every second.
  const elapsedRef = useRef(0);
  elapsedRef.current = clock.elapsed;
  useEffect(() => {
    if (isEdit || finished) {
      return;
    }
    const t = setTimeout(() => {
      if (draftIsMeaningful(exercises)) {
        writeDraft({
          mode,
          elapsedSeconds: elapsedRef.current,
          title,
          date,
          durationMin,
          notes,
          exercises,
          savedAt: Date.now(),
        });
      }
    }, 400);
    return () => clearTimeout(t);
  }, [isEdit, finished, mode, clock.running, title, date, durationMin, notes, exercises]);

  // Anything the member actually did this visit. Gates the leave-confirmation
  // so backing out of an untouched page never nags (and an untouched edit
  // never warns about "unsaved changes" that don't exist).
  const [touched, setTouched] = useState(false);
  const dirty = touched;

  /** Every user-driven exercise mutation funnels through this. */
  const setExercisesTouched: typeof setExercises = (value) => {
    setTouched(true);
    setExercises(value);
  };

  function resumeDraft(draft: SessionDraft) {
    setTitle(draft.title);
    setDate(draft.date);
    setDurationMin(draft.durationMin);
    setNotes(draft.notes);
    setExercises(draft.exercises);
    // The saved time comes back PAUSED; play resumes it if they're mid-session.
    clock.reset(draft.elapsedSeconds ?? 0);
    setResumeOffer(null);
    setTouched(true);
  }

  // --- exercise/set state transitions (unchanged logic from the dialog era) ---

  function addExercises(picked: PickedExercise[]) {
    setExercisesTouched((prev) => [
      ...prev,
      ...picked.map((p) => {
        const history = lastSets[p.name.trim().toLowerCase()];
        return {
          uid: uid(),
          name: p.name,
          muscleGroup: p.muscleGroup,
          kind: p.kind ?? null,
          ghosts: history ? ghostsFromHistory(history.sets) : undefined,
          linkedWithPrev: false,
          notes: "",
          sets: [blankSet(undefined, isEdit)],
        };
      }),
    ]);
    setView({ kind: "log" });
  }

  /** Swap the exercise, keep the sets: "the bench is taken" one-tap fix. */
  function replaceExercise(exUid: string, picked: PickedExercise) {
    const history = lastSets[picked.name.trim().toLowerCase()];
    setExercisesTouched((prev) =>
      prev.map((ex) =>
        ex.uid === exUid
          ? {
              ...ex,
              name: picked.name,
              muscleGroup: picked.muscleGroup,
              kind: picked.kind ?? null,
              target: null,
              ghosts: history ? ghostsFromHistory(history.sets) : undefined,
            }
          : ex
      )
    );
    setView({ kind: "log" });
  }

  function toggleLink(exUid: string) {
    setExercisesTouched((prev) =>
      prev.map((ex) =>
        ex.uid === exUid ? { ...ex, linkedWithPrev: !ex.linkedWithPrev } : ex
      )
    );
  }

  function updateExercise(exUid: string, patch: Partial<EditorExercise>) {
    setExercisesTouched((prev) =>
      prev.map((ex) => (ex.uid === exUid ? { ...ex, ...patch } : ex))
    );
  }

  function removeExercise(exUid: string) {
    setExercisesTouched((prev) => prev.filter((ex) => ex.uid !== exUid));
  }

  function moveExercise(exUid: string, dir: -1 | 1) {
    setExercisesTouched((prev) => {
      const i = prev.findIndex((ex) => ex.uid === exUid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) {
        return prev;
      }
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function addSet(exUid: string) {
    setExercisesTouched((prev) =>
      prev.map((ex) =>
        ex.uid === exUid
          ? { ...ex, sets: [...ex.sets, blankSet(ex.sets.at(-1), isEdit)] }
          : ex
      )
    );
  }

  function updateSet(exUid: string, setUid: string, patch: Partial<EditorSet>) {
    setExercisesTouched((prev) =>
      prev.map((ex) =>
        ex.uid === exUid
          ? {
              ...ex,
              sets: ex.sets.map((s) =>
                s.uid === setUid ? { ...s, ...patch } : s
              ),
            }
          : ex
      )
    );
  }

  function removeSet(exUid: string, setUid: string) {
    setExercisesTouched((prev) =>
      prev.map((ex) =>
        ex.uid === exUid
          ? { ...ex, sets: ex.sets.filter((s) => s.uid !== setUid) }
          : ex
      )
    );
  }

  // One lb/kg control per exercise (the pro-app pattern); applies to all sets.
  function setUnit(exUid: string, unit: "lb" | "kg") {
    setExercisesTouched((prev) =>
      prev.map((ex) =>
        ex.uid === exUid
          ? { ...ex, sets: ex.sets.map((s) => ({ ...s, unit })) }
          : ex
      )
    );
  }

  /** Insert the percentage warm-up ladder above an exercise's working sets,
   *  from its first typed (or ghosted) working weight. */
  function addWarmupRamp(exUid: string) {
    setExercisesTouched((prev) =>
      prev.map((ex) => {
        if (ex.uid !== exUid) {
          return ex;
        }
        const firstWorking = ex.sets.find((s) => s.setType === "working");
        const unit = firstWorking?.unit ?? "lb";
        const typed = firstWorking?.weight.trim();
        const ghost = ghostAt(ex, ex.sets.indexOf(firstWorking ?? ex.sets[0]) ?? 0);
        const weightStr = typed || (ghost && isNumeric(ghost.weight) ? ghost.weight : "");
        if (!weightStr) {
          toast.error(
            "Type your working weight first. The warm-up ramp is calculated from it."
          );
          return ex;
        }
        const steps = warmupRamp(Number(weightStr), unit);
        if (steps.length === 0) {
          toast.error("That weight is at or below the empty bar, so no warm-up ramp is needed.");
          return ex;
        }
        const warmups: EditorSet[] = steps.map((st) => ({
          uid: uid(),
          weight: String(st.weight),
          reps: String(st.reps),
          unit,
          rpe: "",
          setType: "warmup",
          completed: false,
        }));
        return { ...ex, sets: [...warmups, ...ex.sets] };
      })
    );
  }

  function toggleNotes(exUid: string) {
    setNotesOpen((prev) => {
      const next = new Set(prev);
      if (next.has(exUid)) {
        next.delete(exUid);
      } else {
        next.add(exUid);
      }
      return next;
    });
  }

  /** Checking a set: adopt its ghost numbers, and kick the rest timer. */
  const onCheckSet = useCallback(
    (exUid: string, s: EditorSet, ghost: { weight: string; reps: string } | null, kind: ExerciseKindData) => {
      const patch: Partial<EditorSet> = { completed: !s.completed };
      if (!s.completed && ghost) {
        if (kind !== "timed" && !s.weight.trim() && isNumeric(ghost.weight)) {
          patch.weight = ghost.weight;
        }
        if (!s.reps.trim() && isNumeric(ghost.reps)) {
          patch.reps = ghost.reps;
        }
      }
      updateSet(exUid, s.uid, patch);
      if (!s.completed && !isEdit && timer.autoStart) {
        timer.start();
      }
    },
    [isEdit, timer]
  );

  // --- live stats + finish ---

  const volumeNow = liveVolumeLb(exercises);
  const setsNow = liveSetProgress(exercises);

  function midSessionPrompt(): string {
    const lines = exercises.map((ex) => {
      const done = ex.sets
        .filter((s) => s.completed && (s.weight.trim() || s.reps.trim()))
        .map((s) =>
          ex.kind === "timed"
            ? `${s.reps}s`
            : `${s.weight.trim() || "BW"}${s.weight.trim() ? ` ${s.unit}` : ""} x ${s.reps.trim() || "?"}`
        )
        .join(", ");
      const last = lastSets[ex.name.trim().toLowerCase()];
      const lastLine = last ? ` (last time: ${formatLastLine(last, ex.kind ?? "weighted")})` : "";
      return `${ex.name}: ${done || "not started"}${lastLine}`;
    });
    return `I'm mid-workout right now (${title.trim() || "unnamed session"}${clock.elapsed > 0 ? `, ${mmss(clock.elapsed)} in` : ""}). Here's where I am: ${lines.join("; ")}. Tell me exactly what to aim for on my remaining sets: weights, reps, and whether to push or hold back.`;
  }

  function submit() {
    if (!title.trim()) {
      toast.error("Name this workout.");
      return;
    }

    // Superset groups come from the linked-with-above chains, resolved BEFORE
    // untouched sets are dropped so a group survives a skipped middle exercise.
    const groupByUid = new Map<string, number | null>();
    deriveGroups(exercises).forEach((g, i) => {
      groupByUid.set(exercises[i].uid, g);
    });

    // Live sessions lay the whole plan out up front; whatever was never
    // touched (unchecked sets with nothing typed) is dropped on save (Hevy's
    // "discard empty sets"), so skipping an exercise logs nothing phantom.
    // And a set the member TYPED numbers into counts as performed even if
    // they never tapped the check: retro-logging by typing alone loses
    // nothing. Edit mode saves exactly what's shown.
    let toSave = exercises;
    if (!isEdit) {
      toSave = exercises
        .map((ex) => ({
          ...ex,
          sets: ex.sets
            .filter(
              (s) =>
                s.completed || s.weight.trim() || s.reps.trim() || s.rpe.trim()
            )
            .map((s) =>
              !s.completed && (s.weight.trim() || s.reps.trim())
                ? { ...s, completed: true }
                : s
            ),
        }))
        .filter((ex) => ex.sets.length > 0);
      if (toSave.length === 0) {
        toast.error("Check off or fill in at least one set first.");
        return;
      }
    }

    if (toSave.length === 0) {
      toast.error("Add at least one exercise.");
      return;
    }
    for (const ex of toSave) {
      if (ex.sets.length === 0) {
        toast.error(`Add a set to ${ex.name}.`);
        return;
      }
    }
    if (!isEdit && !toSave.some((ex) => ex.sets.some((s) => s.completed))) {
      toast.error("Check off at least one completed set before finishing.");
      return;
    }

    // Duration: an explicit minutes override wins; else the live session
    // clock; else nothing (edit mode with the field cleared).
    let durationSeconds: number | null = null;
    if (durationMin.trim()) {
      const n = Number(durationMin);
      if (Number.isNaN(n) || n < 0) {
        toast.error("Duration must be a number of minutes.");
        return;
      }
      durationSeconds = Math.round(n * 60);
    } else if (!isEdit && clock.elapsed > 0) {
      durationSeconds = Math.min(86_400, clock.elapsed);
    }

    const payload = {
      title: title.trim(),
      performedAt: date,
      durationSeconds,
      notes: notes.trim() || null,
      exercises: toSave.map((ex) => ({
        name: ex.name.trim(),
        muscleGroup: ex.muscleGroup,
        kind: ex.kind,
        supersetGroup: groupByUid.get(ex.uid) ?? null,
        notes: ex.notes.trim() || null,
        sets: ex.sets.map((s) => ({
          weight: s.weight.trim() ? Number(s.weight) : null,
          reps: s.reps.trim() ? Number(s.reps) : null,
          unit: s.unit,
          rpe: s.rpe.trim() ? Number(s.rpe) : null,
          setType: s.setType,
          completed: s.completed,
        })),
      })),
    };

    for (const ex of payload.exercises) {
      for (const s of ex.sets) {
        if (
          (s.weight != null && Number.isNaN(s.weight)) ||
          (s.reps != null && Number.isNaN(s.reps)) ||
          (s.rpe != null && Number.isNaN(s.rpe))
        ) {
          toast.error("Check the numbers: something isn't a valid value.");
          return;
        }
      }
    }

    startTransition(async () => {
      const result =
        isEdit && initial
          ? await editWorkout({ id: initial.id, ...payload })
          : await saveWorkout(payload);
      if (!result.ok) {
        toast.error(result.error ?? "Couldn't save that workout.");
        return;
      }
      router.refresh();
      if (isEdit) {
        toast.success("Workout updated.");
        router.push("/workouts");
        return;
      }
      clearDraft();
      reward.celebrate("Workout logged.");
      setSummary(buildSummary(payload, prBaseline, recentVolumes));
    });
  }

  function onBack() {
    if (finished) {
      router.push("/workouts");
      return;
    }
    if (dirty) {
      setConfirmingDiscard(true);
      return;
    }
    // Leaving an untouched page never deletes a stored draft: the member may
    // have opened the logger, ignored the resume banner, and backed out.
    router.push("/workouts");
  }

  // --- render ---

  if (summary) {
    return <FinishSummary {...summary} />;
  }

  if (view.kind === "pick") {
    const replaceEx = view.replaceUid
      ? exercises.find((ex) => ex.uid === view.replaceUid)
      : null;
    return (
      <ExercisePickerPanel
        customExercises={customExercises}
        lastSets={lastSets}
        onAdd={(picked) => {
          if (view.replaceUid && picked[0]) {
            replaceExercise(view.replaceUid, picked[0]);
          } else {
            addExercises(picked);
          }
        }}
        onBack={() => setView({ kind: "log" })}
        onCreateCustom={(seedName) =>
          setView({ kind: "custom", seedName, editRow: null, replaceUid: view.replaceUid })
        }
        onEditCustom={(row) =>
          setView({ kind: "custom", seedName: "", editRow: row, replaceUid: view.replaceUid })
        }
        replaceTarget={replaceEx?.name ?? null}
      />
    );
  }

  if (view.kind === "custom") {
    return (
      <CustomExercisePanel
        defaultName={view.seedName}
        initial={view.editRow}
        onBack={() => setView({ kind: "pick", replaceUid: view.replaceUid })}
        onSaved={(saved) => {
          // Creating from the picker means "I want to log this now".
          if (view.editRow == null) {
            const picked = {
              name: saved.name,
              muscleGroup: saved.muscleGroup,
              kind: saved.kind,
            };
            if (view.replaceUid) {
              replaceExercise(view.replaceUid, picked);
            } else {
              addExercises([picked]);
            }
          } else {
            setView({ kind: "pick", replaceUid: view.replaceUid });
          }
        }}
      />
    );
  }

  const groups = deriveGroups(exercises);

  return (
    <div className="flex flex-col gap-5">
      {/* Sticky session bar: always-visible back, live clock + volume, and
          the finish action, however deep the page scrolls. */}
      <div className="sticky top-0 z-30 -mx-4 border-border border-b bg-background/95 px-4 py-2.5 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <Button
            className="gap-1.5"
            onClick={onBack}
            size="sm"
            type="button"
            variant="ghost"
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Workouts</span>
          </Button>
          <div className="flex min-w-0 items-center gap-3 text-sm tabular-nums">
            {!isEdit && (
              <button
                aria-label={
                  clock.running
                    ? "Pause the workout timer"
                    : "Start the workout timer"
                }
                className={cn(
                  "flex h-9 items-center gap-1.5 rounded-full border px-3 transition-colors",
                  clock.running
                    ? "border-blood/40 bg-blood/10 text-blood"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
                onClick={clock.toggle}
                type="button"
              >
                {clock.running ? (
                  <Pause className="size-3.5" />
                ) : (
                  <Play className="size-3.5" />
                )}
                <span className="font-display font-semibold">
                  {mmss(clock.elapsed)}
                </span>
              </button>
            )}
            <span className="text-muted-foreground">
              {volumeNow > 0 ? `${volumeNow.toLocaleString()} lb` : "0 lb"}
            </span>
            <span className="text-muted-foreground">
              {setsNow.done}/{setsNow.total} sets
            </span>
          </div>
          <Button
            className="min-w-24"
            disabled={pending}
            onClick={submit}
            size="sm"
            type="button"
          >
            {pending ? "Saving…" : isEdit ? "Save changes" : "Finish"}
          </Button>
        </div>
      </div>

      {resumeOffer && (
        <div className="flex flex-col gap-2 rounded-xl border border-blood/30 bg-blood/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            You have an unfinished workout from earlier
            {resumeOffer.title.trim() ? ` (“${resumeOffer.title.trim()}”)` : ""}.
            Pick it back up?
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              onClick={() => resumeDraft(resumeOffer)}
              size="sm"
              type="button"
            >
              Resume it
            </Button>
            <Button
              onClick={() => {
                clearDraft();
                setResumeOffer(null);
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              Start fresh
            </Button>
          </div>
        </div>
      )}

      {mode === "plan" && (
        <p className="rounded-xl border border-border bg-card px-4 py-3 text-muted-foreground text-sm">
          Your plan's exercises are loaded. Faded numbers are last session (or
          the plan's target). Check a set off to accept them, or type what you
          actually did. Anything you skip is simply not logged.
        </p>
      )}

      {/* Session meta */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5 sm:col-span-1">
          <Label htmlFor="wk-title">Workout name</Label>
          <Input
            className="h-11 sm:h-9"
            id="wk-title"
            onChange={(e) => { setTouched(true); setTitle(e.target.value); }}
            placeholder="Push Day"
            value={title}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="wk-date">Date</Label>
          <DatePicker
            className="h-11 sm:h-9"
            id="wk-date"
            max={todayISO()}
            onChange={(v) => { setTouched(true); setDate(v); }}
            value={date}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="flex items-center gap-1" htmlFor="wk-duration">
            Duration (minutes)
            {!isEdit && (
              <KpiHelp label="Duration">
                Optional. Timing your session? Tap the play button on the
                clock in the top bar and this fills itself in. Logging after
                the fact? Just type the minutes, or leave it blank.
              </KpiHelp>
            )}
          </Label>
          <Input
            className="h-11 sm:h-9"
            id="wk-duration"
            inputMode="numeric"
            onChange={(e) => { setTouched(true); setDurationMin(e.target.value); }}
            placeholder="optional"
            value={durationMin}
          />
        </div>
      </div>

      {/* Exercises */}
      {exercises.length === 0 ? (
        <div className="rounded-xl border border-border border-dashed px-4 py-10 text-center">
          <p className="text-muted-foreground text-sm">
            No exercises yet. Add your first one and start logging.
          </p>
        </div>
      ) : (
        exercises.map((ex, i) => (
          <ExerciseBlock
            baseline={prBaseline[ex.name.trim().toLowerCase()]}
            canLink={i > 0}
            canMoveDown={i < exercises.length - 1}
            canMoveUp={i > 0}
            exercise={ex}
            groupNo={groups[i]}
            key={ex.uid}
            last={
              isEdit ? null : (lastSets[ex.name.trim().toLowerCase()] ?? null)
            }
            notesVisible={ex.notes.trim() !== "" || notesOpen.has(ex.uid)}
            onAddSet={() => addSet(ex.uid)}
            onAddWarmup={() => addWarmupRamp(ex.uid)}
            onCheckSet={(s, ghost, kind) => onCheckSet(ex.uid, s, ghost, kind)}
            onMoveDown={() => moveExercise(ex.uid, 1)}
            onMoveUp={() => moveExercise(ex.uid, -1)}
            onRemove={() => removeExercise(ex.uid)}
            onRemoveSet={(setUid) => removeSet(ex.uid, setUid)}
            onReplace={() => setView({ kind: "pick", replaceUid: ex.uid })}
            onSetUnit={(unit) => setUnit(ex.uid, unit)}
            onToggleLink={() => toggleLink(ex.uid)}
            onToggleNotes={() => toggleNotes(ex.uid)}
            onUpdate={(patch) => updateExercise(ex.uid, patch)}
            onUpdateSet={(setUid, patch) => updateSet(ex.uid, setUid, patch)}
          />
        ))
      )}

      <Button
        className="h-11 gap-1.5"
        onClick={() => setView({ kind: "pick", replaceUid: null })}
        type="button"
        variant="outline"
      >
        <Plus className="size-4" />
        Add exercise
      </Button>

      {/* Tools */}
      {!isEdit && <RestTimerCard timer={timer} />}
      <PlateCalculator />
      {!isEdit && exercises.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-background/40 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-xs">
            Stuck on what to lift next? Chad reads your session so far and your
            history, and tells you exactly what to aim for.
          </p>
          <AskChadButton
            className="shrink-0"
            label="Ask Chad mid-workout"
            prompt={midSessionPrompt()}
          />
        </div>
      )}

      {/* Session notes */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wk-notes">Session notes (optional)</Label>
        <Textarea
          id="wk-notes"
          maxLength={2000}
          onChange={(e) => { setTouched(true); setNotes(e.target.value); }}
          placeholder="How it felt, what to change next time…"
          rows={2}
          value={notes}
        />
      </div>

      <div className="flex items-center justify-end gap-2 border-border border-t pt-4 pb-16">
        <Button
          disabled={pending}
          onClick={onBack}
          type="button"
          variant="ghost"
        >
          Cancel
        </Button>
        <Button className="min-w-32" disabled={pending} onClick={submit} type="button">
          {pending ? "Saving…" : isEdit ? "Save changes" : "Finish workout"}
        </Button>
      </div>

      <RestTimerBar timer={timer} />

      {/* Discard confirmation, a REAL popup use: a warning, nothing more. */}
      <AlertDialog onOpenChange={setConfirmingDiscard} open={confirmingDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this workout?</AlertDialogTitle>
            <AlertDialogDescription>
              {isEdit
                ? "Your unsaved changes to this workout will be lost."
                : "Nothing is saved yet. Your session stays as a draft, so you can pick it up again from “Log a workout”, or discard it for good."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep training</AlertDialogCancel>
            {!isEdit && (
              <AlertDialogAction
                onClick={() => {
                  clearDraft();
                  router.push("/workouts");
                }}
              >
                Discard workout
              </AlertDialogAction>
            )}
            <AlertDialogAction
              onClick={() => {
                router.push("/workouts");
              }}
            >
              {isEdit ? "Leave without saving" : "Leave, keep the draft"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Build the finish-summary payload from what was actually saved. */
function buildSummary(
  payload: {
    title: string;
    durationSeconds: number | null;
    exercises: {
      name: string;
      muscleGroup: string | null;
      kind: ExerciseKindData | null;
      sets: {
        weight: number | null;
        reps: number | null;
        unit: "lb" | "kg";
        setType: SetType;
        completed: boolean;
      }[];
    }[];
  },
  prBaseline: Record<string, PrBaseline>,
  recentVolumes: number[]
): {
  title: string;
  durationSeconds: number | null;
  volumeLb: number;
  setsDone: number;
  exerciseCount: number;
  prs: SummaryPr[];
  muscles: MuscleSlice[];
  volumeVsAverage: number | null;
  chadPrompt: string;
} {
  let volume = 0;
  let setsDone = 0;
  const muscleSets = new Map<string, number>();
  const prs: SummaryPr[] = [];

  for (const ex of payload.exercises) {
    const key = ex.name.trim().toLowerCase();
    const baseline = prBaseline[key];
    let bestNewWeight: { weight: number; unit: "lb" | "kg"; reps: number | null } | null = null;
    let bestNewE1rm: { e1rmLb: number; weight: number; unit: "lb" | "kg"; reps: number } | null = null;
    let bestNewReps: number | null = null;

    for (const s of ex.sets) {
      if (!s.completed) {
        continue;
      }
      setsDone += 1;
      if (s.setType === "warmup") {
        continue;
      }
      const label =
        MUSCLE_GROUP_LABELS[(ex.muscleGroup ?? "other") as MuscleGroup] ??
        "Other";
      muscleSets.set(label, (muscleSets.get(label) ?? 0) + 1);
      if (s.weight != null && s.reps != null) {
        volume += toLb(s.weight, s.unit) * s.reps;
      }
      if (!baseline) {
        continue;
      }
      if (s.weight != null && toLb(s.weight, s.unit) > baseline.bestWeightLb) {
        if (
          !bestNewWeight ||
          toLb(s.weight, s.unit) > toLb(bestNewWeight.weight, bestNewWeight.unit)
        ) {
          bestNewWeight = { weight: s.weight, unit: s.unit, reps: s.reps };
        }
      }
      if (s.weight != null && s.reps != null && s.reps > 0) {
        const e = epley1RM(s.weight, s.reps);
        if (e != null && toLb(e, s.unit) > baseline.bestE1RMLb) {
          const eLb = Math.round(toLb(e, s.unit));
          if (!bestNewE1rm || eLb > bestNewE1rm.e1rmLb) {
            bestNewE1rm = { e1rmLb: eLb, weight: s.weight, unit: s.unit, reps: s.reps };
          }
        }
      }
      if (
        ex.kind === "bodyweight" &&
        s.reps != null &&
        s.reps > baseline.bestReps &&
        (bestNewReps == null || s.reps > bestNewReps)
      ) {
        bestNewReps = s.reps;
      }
    }

    if (bestNewWeight) {
      prs.push({
        exercise: ex.name,
        label: PR_LABEL.weight,
        detail: `${bestNewWeight.weight} ${bestNewWeight.unit}${bestNewWeight.reps != null ? ` × ${bestNewWeight.reps}` : ""}`,
      });
    }
    if (bestNewE1rm) {
      prs.push({
        exercise: ex.name,
        label: PR_LABEL.e1rm,
        detail: `${bestNewE1rm.e1rmLb} lb (from ${bestNewE1rm.weight} ${bestNewE1rm.unit} × ${bestNewE1rm.reps})`,
      });
    }
    if (bestNewReps != null) {
      prs.push({
        exercise: ex.name,
        label: PR_LABEL.reps,
        detail: `${bestNewReps} reps`,
      });
    }
  }

  const volumeLb = Math.round(volume);
  const usable = recentVolumes.filter((v) => v > 0);
  let volumeVsAverage: number | null = null;
  if (usable.length >= 3 && volumeLb > 0) {
    const avg = usable.reduce((a, b) => a + b, 0) / usable.length;
    volumeVsAverage = Math.round(((volumeLb - avg) / avg) * 100);
  }

  const muscles: MuscleSlice[] = [...muscleSets.entries()]
    .map(([label, sets]) => ({ label, sets }))
    .sort((a, b) => b.sets - a.sets);

  const prLine =
    prs.length > 0
      ? ` New PRs: ${prs.map((p) => `${p.exercise} ${p.label} ${p.detail}`).join(", ")}.`
      : "";
  const chadPrompt = `I just finished logging a workout: ${payload.title}. Total volume ${volumeLb.toLocaleString()} lb across ${setsDone} sets.${prLine} Look at the session in my dashboard and give me your honest verdict, and what I should focus on next time.`;

  return {
    title: payload.title,
    durationSeconds: payload.durationSeconds,
    volumeLb,
    setsDone,
    exerciseCount: payload.exercises.length,
    prs,
    muscles,
    volumeVsAverage,
    chadPrompt,
  };
}

function ExerciseBlock({
  exercise,
  baseline,
  canLink,
  canMoveUp,
  canMoveDown,
  groupNo,
  last,
  notesVisible,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onRemove,
  onReplace,
  onAddSet,
  onAddWarmup,
  onSetUnit,
  onToggleLink,
  onToggleNotes,
  onUpdateSet,
  onRemoveSet,
  onCheckSet,
}: {
  exercise: EditorExercise;
  baseline: PrBaseline | undefined;
  canLink: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  groupNo: number | null;
  last: LastExerciseLog | null;
  notesVisible: boolean;
  onUpdate: (patch: Partial<EditorExercise>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onReplace: () => void;
  onAddSet: () => void;
  onAddWarmup: () => void;
  onSetUnit: (unit: "lb" | "kg") => void;
  onToggleLink: () => void;
  onToggleNotes: () => void;
  onUpdateSet: (setUid: string, patch: Partial<EditorSet>) => void;
  onRemoveSet: (setUid: string) => void;
  onCheckSet: (
    s: EditorSet,
    ghost: { weight: string; reps: string } | null,
    kind: ExerciseKindData
  ) => void;
}) {
  let workingCount = 0;
  const kind = exercise.kind ?? "weighted";
  const unit = exercise.sets[0]?.unit ?? "lb";

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-background/40 p-2.5 sm:p-3",
        groupNo != null && "border-l-2",
        groupNo != null && GROUP_RAILS[(groupNo - 1) % GROUP_RAILS.length]
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-sm">{exercise.name}</span>
            {groupNo != null && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 font-medium text-[10px] uppercase tracking-wide",
                  GROUP_CHIPS[(groupNo - 1) % GROUP_CHIPS.length]
                )}
              >
                {supersetLabel(groupNo)}
              </span>
            )}
          </span>
          {exercise.target ? (
            <div className="text-muted-foreground text-xs">
              Plan: {exercise.target}
            </div>
          ) : null}
          {last ? (
            <div className="text-muted-foreground text-xs">
              {formatLastLine(last, kind)}
            </div>
          ) : null}
        </div>

        {/* One clean overflow menu per exercise (the Hevy/Strong kebab):
            every action spelled out in words, every target 44px tall. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Options for ${exercise.name}`}
              className="size-11 shrink-0 text-muted-foreground sm:size-8"
              size="icon"
              type="button"
              variant="ghost"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {canLink && (
              <DropdownMenuItem className="min-h-11 gap-2" onClick={onToggleLink}>
                <Link2 className="size-4" />
                {exercise.linkedWithPrev
                  ? "Remove from superset"
                  : "Superset with the exercise above"}
              </DropdownMenuItem>
            )}
            {kind !== "timed" && (
              <DropdownMenuItem className="min-h-11 gap-2" onClick={onAddWarmup}>
                <Flame className="size-4" />
                Add warm-up sets (calculated)
              </DropdownMenuItem>
            )}
            <DropdownMenuItem className="min-h-11 gap-2" onClick={onReplace}>
              <ArrowLeftRight className="size-4" />
              Replace exercise (keeps your sets)
            </DropdownMenuItem>
            <DropdownMenuItem className="min-h-11 gap-2" onClick={onToggleNotes}>
              <NotebookPen className="size-4" />
              {notesVisible ? "Hide exercise note" : "Add an exercise note"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="min-h-11 gap-2"
              disabled={!canMoveUp}
              onClick={onMoveUp}
            >
              <ArrowUp className="size-4" />
              Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              className="min-h-11 gap-2"
              disabled={!canMoveDown}
              onClick={onMoveDown}
            >
              <ArrowDown className="size-4" />
              Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="min-h-11 gap-2 text-blood focus:text-blood"
              onClick={onRemove}
            >
              <Trash2 className="size-4" />
              Remove exercise
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Column headers. A timed exercise (plank, cardio) logs seconds, not
          load × reps; a bodyweight one logs reps with optional added load.
          The lb/kg unit lives HERE, once per exercise, not per set row. */}
      <div className="mb-1 flex items-center gap-2 px-1 text-[11px] text-muted-foreground uppercase tracking-wide">
        <span className="w-11 text-center sm:w-8">Set</span>
        {kind !== "timed" && (
          <span className="flex flex-1 items-center gap-1">
            Weight
            <Select
              onValueChange={(v) => onSetUnit(v as "lb" | "kg")}
              value={unit}
            >
              <SelectTrigger
                aria-label="Weight unit for this exercise"
                className="h-6 gap-0.5 rounded-md px-1.5 text-[11px] text-muted-foreground"
                size="sm"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lb">lb</SelectItem>
                <SelectItem value="kg">kg</SelectItem>
              </SelectContent>
            </Select>
          </span>
        )}
        <span className="flex-1">{kind === "timed" ? "Seconds" : "Reps"}</span>
        <span className="hidden w-11 items-center justify-center gap-0.5 sm:flex">
          RPE
          <KpiHelp label="RPE">
            Rate of Perceived Exertion: how hard the set felt, 1 to 10. A 10
            means you had nothing left; an 8 means you could have done about
            two more reps. Optional: leave it blank if you don't track it.
          </KpiHelp>
        </span>
        <span className="w-11 text-center sm:w-8">Done</span>
        <span className="hidden w-7 sm:block" />
      </div>

      <div className="flex flex-col gap-3 sm:gap-1.5">
        {exercise.sets.map((s, setIndex) => {
          if (s.setType === "working") {
            workingCount += 1;
          }
          const badge =
            s.setType === "working"
              ? String(workingCount)
              : s.setType === "warmup"
                ? "W"
                : s.setType === "dropset"
                  ? "D"
                  : "F";
          const ghost = ghostAt(exercise, setIndex);
          const weightGhost =
            ghost?.weight || (kind === "bodyweight" ? "BW" : "–");
          const repsGhost = ghost?.reps || "–";
          const pr = detectSetPr(baseline, s, kind);
          return (
            // MOBILE-FIRST set layout (owner order s168): on phones the main
            // row holds only FOUR big touch targets (set type, weight, reps,
            // done); RPE and Remove get their own labeled line underneath.
            <div className="flex flex-col gap-1.5 sm:gap-0" key={s.uid}>
              <div className="flex items-center gap-2">
                <button
                  aria-label={`Set type: ${SET_TYPE_LABEL[s.setType]} (tap to change)`}
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-md border font-medium text-sm transition-colors sm:size-8 sm:text-xs",
                    s.setType === "working"
                      ? "border-border bg-card"
                      : s.setType === "warmup"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "border-blood/40 bg-blood/10 text-blood"
                  )}
                  onClick={() => {
                    const next =
                      SET_TYPE_ORDER[
                        (SET_TYPE_ORDER.indexOf(s.setType) + 1) %
                          SET_TYPE_ORDER.length
                      ];
                    onUpdateSet(s.uid, { setType: next });
                  }}
                  title={SET_TYPE_LABEL[s.setType]}
                  type="button"
                >
                  {badge}
                </button>

                {kind !== "timed" && (
                  <Input
                    aria-label={`Weight (${unit})`}
                    className="h-11 flex-1 px-2 text-center sm:h-9"
                    inputMode="decimal"
                    onChange={(e) =>
                      onUpdateSet(s.uid, { weight: e.target.value })
                    }
                    placeholder={weightGhost}
                    value={s.weight}
                  />
                )}

                <Input
                  aria-label={kind === "timed" ? "Seconds" : "Reps"}
                  className="h-11 flex-1 px-2 text-center sm:h-9"
                  inputMode="numeric"
                  onChange={(e) => onUpdateSet(s.uid, { reps: e.target.value })}
                  placeholder={repsGhost}
                  value={s.reps}
                />

                <Input
                  aria-label="RPE"
                  className="hidden h-9 w-11 px-1 text-center sm:block"
                  inputMode="decimal"
                  onChange={(e) => onUpdateSet(s.uid, { rpe: e.target.value })}
                  placeholder="–"
                  value={s.rpe}
                />

                <button
                  aria-label={s.completed ? "Mark not done" : "Mark done"}
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-md border transition-colors sm:size-8",
                    s.completed
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "border-border text-muted-foreground hover:bg-accent"
                  )}
                  onClick={() => onCheckSet(s, ghost, kind)}
                  type="button"
                >
                  <Check className="size-5 sm:size-4" />
                </button>

                <button
                  aria-label="Remove set"
                  className="hidden size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground sm:flex"
                  onClick={() => onRemoveSet(s.uid)}
                  type="button"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {/* A live PR the moment it's typed: the payoff pro apps save
                  for the end screen, surfaced right at the set. */}
              {pr && (
                <div className="flex items-center gap-1.5 pl-[52px] text-amber-600 text-xs dark:text-amber-400">
                  <Trophy className="size-3.5" />
                  {PR_LABEL[pr]}: beats your all-time best
                </div>
              )}

              {/* Phone-only second line: the optional/rare controls, labeled
                  in plain words so nothing needs decoding or a precise tap. */}
              <div className="flex items-center justify-between pl-[52px] sm:hidden">
                <label className="flex items-center gap-1.5 text-muted-foreground text-xs">
                  RPE (effort 1-10, optional)
                  <Input
                    aria-label="RPE"
                    className="h-9 w-12 px-1 text-center"
                    inputMode="decimal"
                    onChange={(e) => onUpdateSet(s.uid, { rpe: e.target.value })}
                    placeholder="–"
                    value={s.rpe}
                  />
                </label>
                <button
                  className="flex h-9 items-center gap-1 rounded-md px-2 text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-foreground"
                  onClick={() => onRemoveSet(s.uid)}
                  type="button"
                >
                  <X className="size-3.5" />
                  Remove set
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <button
        className="mt-2 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md border border-border border-dashed py-1.5 text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-foreground"
        onClick={onAddSet}
        type="button"
      >
        <Plus className="size-3.5" />
        Add set
      </button>

      {notesVisible && (
        <div className="mt-2">
          <Textarea
            aria-label={`Notes for ${exercise.name}`}
            maxLength={1000}
            onChange={(e) => onUpdate({ notes: e.target.value })}
            placeholder="Notes for this exercise: seat setting, grip, cue…"
            rows={2}
            value={exercise.notes}
          />
        </div>
      )}
    </div>
  );
}
