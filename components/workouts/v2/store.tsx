"use client";

// Client store for the live workout session and the template-builder draft.
// Everything is mirrored to localStorage so a refresh, a picker-page round
// trip, or an accidental tab close never loses work. Finishing a session
// saves it to the database (saveWorkout server action); the store itself
// never talks to the network.

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import type { SetType } from "@/lib/workouts/stats";
import { sessionEngaged } from "./format";
import type {
  ActiveSession,
  BuilderDraft,
  DraftExercise,
  PRKind,
  RestTimer,
  SessionExercise,
  SessionSet,
} from "./types";

const STORAGE_KEY = "chad-workouts-live-v1";

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

type State = {
  session: ActiveSession | null;
  restTimer: RestTimer | null;
  draft: BuilderDraft | null;
};

const EMPTY_STATE: State = { session: null, restTimer: null, draft: null };

type Action =
  | { type: "hydrate"; state: State }
  // --- live session ---
  | { type: "start-session"; session: ActiveSession }
  | { type: "discard-session" }
  | { type: "rename-session"; name: string }
  | { type: "set-session-notes"; notes: string }
  | { type: "timer-play"; now: number }
  | { type: "timer-pause"; now: number }
  | { type: "timer-reset" }
  | {
      type: "update-set";
      wexId: string;
      setId: string;
      field: "weight" | "reps";
      value: number | null;
    }
  | {
      type: "set-completed";
      wexId: string;
      setId: string;
      completed: boolean;
      prs?: PRKind[];
      now: number;
    }
  | {
      // Bulk check-off (owner s181): every remaining set at once, per exercise
      // or session-wide. PRs are detected by the caller (a UI concern); the
      // rest timer is deliberately NOT started — this is an after-the-fact
      // logging action, not a live set.
      type: "complete-all-sets";
      wexId?: string;
      prsBySetId: Record<string, PRKind[]>;
    }
  | { type: "add-set"; wexId: string; setType: SetType }
  | { type: "set-set-type"; wexId: string; setId: string; setType: SetType }
  | { type: "set-set-rpe"; wexId: string; setId: string; rpe: number | null }
  | { type: "remove-set"; wexId: string; setId: string }
  | { type: "add-session-exercises"; exercises: SessionExercise[] }
  | { type: "replace-session-exercise"; wexId: string; exercise: SessionExercise }
  | { type: "remove-session-exercise"; wexId: string }
  | { type: "move-session-exercise"; wexId: string; direction: -1 | 1 }
  | { type: "set-exercise-rest"; wexId: string; seconds: number }
  | { type: "set-exercise-note"; wexId: string; note: string }
  | { type: "clear-session" }
  // --- rest timer ---
  | { type: "adjust-rest"; deltaSeconds: number; now: number }
  | { type: "skip-rest" }
  // --- builder draft ---
  | { type: "init-draft"; draft: BuilderDraft }
  | { type: "set-draft-name"; name: string }
  | { type: "add-draft-exercises"; exercises: DraftExercise[] }
  | { type: "patch-draft-exercise"; id: string; patch: Partial<DraftExercise> }
  | { type: "remove-draft-exercise"; id: string }
  | { type: "move-draft-exercise"; id: string; direction: -1 | 1 }
  | { type: "clear-draft" };

function withSession(
  state: State,
  mutate: (s: ActiveSession) => ActiveSession
): State {
  if (!state.session) {
    return state;
  }
  return { ...state, session: mutate(state.session) };
}

function mapExercise(
  session: ActiveSession,
  wexId: string,
  mutate: (ex: SessionExercise) => SessionExercise
): ActiveSession {
  return {
    ...session,
    exercises: session.exercises.map((ex) =>
      ex.id === wexId ? mutate(ex) : ex
    ),
  };
}

function move<T extends { id: string }>(
  list: T[],
  id: string,
  direction: -1 | 1
): T[] {
  const i = list.findIndex((x) => x.id === id);
  const j = i + direction;
  if (i === -1 || j < 0 || j >= list.length) {
    return list;
  }
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return action.state;

    case "start-session":
      // At most one ENGAGED live session; a pending one (entered but never
      // played, no sets done) is replaced instead of locking every Start
      // button behind "finish your current workout first" (flaws RUN-08).
      if (state.session && sessionEngaged(state.session)) {
        return state;
      }
      return { ...state, session: action.session, restTimer: null };

    case "discard-session":
    case "clear-session":
      return { ...state, session: null, restTimer: null };

    case "rename-session":
      return withSession(state, (s) => ({ ...s, name: action.name }));

    case "set-session-notes":
      return withSession(state, (s) => ({ ...s, notes: action.notes }));

    case "timer-play":
      return withSession(state, (s) =>
        s.timer.running
          ? s
          : { ...s, timer: { ...s.timer, running: true, startedAt: action.now } }
      );

    case "timer-pause":
      return withSession(state, (s) => {
        if (!s.timer.running) {
          return s;
        }
        const elapsed = s.timer.startedAt ? action.now - s.timer.startedAt : 0;
        return {
          ...s,
          timer: {
            running: false,
            startedAt: null,
            accumulatedMs: s.timer.accumulatedMs + Math.max(0, elapsed),
          },
        };
      });

    case "timer-reset":
      return withSession(state, (s) => ({
        ...s,
        timer: { running: false, startedAt: null, accumulatedMs: 0 },
      }));

    case "update-set":
      return withSession(state, (s) =>
        mapExercise(s, action.wexId, (ex) => ({
          ...ex,
          sets: ex.sets.map((set) =>
            set.id === action.setId
              ? { ...set, [action.field]: action.value }
              : set
          ),
        }))
      );

    case "set-completed": {
      if (!state.session) {
        return state;
      }
      let restSource: SessionExercise | null = null;
      const session = mapExercise(state.session, action.wexId, (ex) => ({
        ...ex,
        sets: ex.sets.map((set) => {
          if (set.id !== action.setId) {
            return set;
          }
          if (!action.completed) {
            return { ...set, completed: false, prs: undefined };
          }
          restSource = ex;
          return { ...set, completed: true, prs: action.prs };
        }),
      }));
      let restTimer = state.restTimer;
      // A rest countdown begins ONLY here, in response to checking off a set.
      const source = restSource as SessionExercise | null;
      if (source && source.restSeconds > 0) {
        restTimer = {
          endsAt: action.now + source.restSeconds * 1000,
          totalSeconds: source.restSeconds,
          exerciseName: source.name,
        };
      }
      return { ...state, session, restTimer };
    }

    case "complete-all-sets":
      return withSession(state, (s) => ({
        ...s,
        exercises: s.exercises.map((ex) =>
          action.wexId && ex.id !== action.wexId
            ? ex
            : {
                ...ex,
                sets: ex.sets.map((set) =>
                  set.completed
                    ? set
                    : {
                        ...set,
                        completed: true,
                        prs: action.prsBySetId[set.id],
                      }
                ),
              }
        ),
      }));

    case "add-set":
      return withSession(state, (s) =>
        mapExercise(s, action.wexId, (ex) => {
          const set: SessionSet = {
            id: uid("set"),
            type: action.setType,
            weight: ex.kind === "bodyweight" ? 0 : null,
            reps: null,
            rpe: null,
            completed: false,
          };
          // New working sets start from the previous working row's values.
          const lastWorking = [...ex.sets]
            .reverse()
            .find((x) => x.type === "working");
          if (action.setType === "working" && lastWorking) {
            set.weight = lastWorking.weight;
            set.reps = lastWorking.reps;
          }
          // Warm-ups go before working sets; everything else goes at the end.
          const sets =
            action.setType === "warmup"
              ? (() => {
                  const firstWorking = ex.sets.findIndex(
                    (x) => x.type === "working"
                  );
                  const at = firstWorking === -1 ? ex.sets.length : firstWorking;
                  return [...ex.sets.slice(0, at), set, ...ex.sets.slice(at)];
                })()
              : [...ex.sets, set];
          return { ...ex, sets };
        })
      );

    case "set-set-type":
      return withSession(state, (s) =>
        mapExercise(s, action.wexId, (ex) => ({
          ...ex,
          sets: ex.sets.map((set) =>
            set.id === action.setId ? { ...set, type: action.setType } : set
          ),
        }))
      );

    case "set-set-rpe":
      return withSession(state, (s) =>
        mapExercise(s, action.wexId, (ex) => ({
          ...ex,
          sets: ex.sets.map((set) =>
            set.id === action.setId ? { ...set, rpe: action.rpe } : set
          ),
        }))
      );

    case "remove-set":
      return withSession(state, (s) =>
        mapExercise(s, action.wexId, (ex) => ({
          ...ex,
          sets: ex.sets.filter((set) => set.id !== action.setId),
        }))
      );

    case "add-session-exercises":
      return withSession(state, (s) => ({
        ...s,
        exercises: [...s.exercises, ...action.exercises],
      }));

    case "replace-session-exercise":
      return withSession(state, (s) => ({
        ...s,
        exercises: s.exercises.map((ex) =>
          ex.id === action.wexId ? action.exercise : ex
        ),
      }));

    case "remove-session-exercise":
      return withSession(state, (s) => ({
        ...s,
        exercises: s.exercises.filter((ex) => ex.id !== action.wexId),
      }));

    case "move-session-exercise":
      return withSession(state, (s) => ({
        ...s,
        exercises: move(s.exercises, action.wexId, action.direction),
      }));

    case "set-exercise-rest":
      return withSession(state, (s) =>
        mapExercise(s, action.wexId, (ex) => ({
          ...ex,
          restSeconds: action.seconds,
        }))
      );

    case "set-exercise-note":
      return withSession(state, (s) =>
        mapExercise(s, action.wexId, (ex) => ({
          ...ex,
          note: action.note.trim() ? action.note : null,
        }))
      );

    case "adjust-rest": {
      if (!state.restTimer) {
        return state;
      }
      const endsAt = state.restTimer.endsAt + action.deltaSeconds * 1000;
      if (endsAt <= action.now) {
        return { ...state, restTimer: null };
      }
      return {
        ...state,
        restTimer: {
          ...state.restTimer,
          endsAt,
          totalSeconds: Math.max(
            state.restTimer.totalSeconds + action.deltaSeconds,
            1
          ),
        },
      };
    }

    case "skip-rest":
      return { ...state, restTimer: null };

    case "init-draft":
      return { ...state, draft: action.draft };

    case "set-draft-name":
      return state.draft
        ? { ...state, draft: { ...state.draft, name: action.name } }
        : state;

    case "add-draft-exercises":
      return state.draft
        ? {
            ...state,
            draft: {
              ...state.draft,
              exercises: [...state.draft.exercises, ...action.exercises],
            },
          }
        : state;

    case "patch-draft-exercise":
      return state.draft
        ? {
            ...state,
            draft: {
              ...state.draft,
              exercises: state.draft.exercises.map((ex) =>
                ex.id === action.id ? { ...ex, ...action.patch } : ex
              ),
            },
          }
        : state;

    case "remove-draft-exercise":
      return state.draft
        ? {
            ...state,
            draft: {
              ...state.draft,
              exercises: state.draft.exercises.filter(
                (ex) => ex.id !== action.id
              ),
            },
          }
        : state;

    case "move-draft-exercise":
      return state.draft
        ? {
            ...state,
            draft: {
              ...state.draft,
              exercises: move(state.draft.exercises, action.id, action.direction),
            },
          }
        : state;

    case "clear-draft":
      return { ...state, draft: null };

    default:
      return state;
  }
}

interface WorkoutsStore {
  session: ActiveSession | null;
  restTimer: RestTimer | null;
  draft: BuilderDraft | null;
  /** False until localStorage has been read AND the consuming component has
   * mounted (see the veil in `useWorkouts`), so it is never true during a
   * hydration render and persisted state can't mismatch the server HTML. */
  ready: boolean;
  startSession: (session: ActiveSession) => void;
  discardSession: () => void;
  clearSession: () => void;
  renameSession: (name: string) => void;
  setSessionNotes: (notes: string) => void;
  timerPlay: () => void;
  timerPause: () => void;
  timerReset: () => void;
  updateSet: (
    wexId: string,
    setId: string,
    field: "weight" | "reps",
    value: number | null
  ) => void;
  setSetCompleted: (
    wexId: string,
    setId: string,
    completed: boolean,
    prs?: PRKind[]
  ) => void;
  /** Check off every remaining set at once — one exercise, or all of them. */
  completeAllSets: (
    prsBySetId: Record<string, PRKind[]>,
    wexId?: string
  ) => void;
  addSet: (wexId: string, setType: SetType) => void;
  setSetType: (wexId: string, setId: string, setType: SetType) => void;
  setSetRpe: (wexId: string, setId: string, rpe: number | null) => void;
  removeSet: (wexId: string, setId: string) => void;
  addSessionExercises: (exercises: SessionExercise[]) => void;
  replaceSessionExercise: (wexId: string, exercise: SessionExercise) => void;
  removeSessionExercise: (wexId: string) => void;
  moveSessionExercise: (wexId: string, direction: -1 | 1) => void;
  setExerciseRest: (wexId: string, seconds: number) => void;
  setExerciseNote: (wexId: string, note: string) => void;
  adjustRest: (deltaSeconds: number) => void;
  skipRest: () => void;
  initDraft: (draft: BuilderDraft) => void;
  setDraftName: (name: string) => void;
  addDraftExercises: (exercises: DraftExercise[]) => void;
  patchDraftExercise: (id: string, patch: Partial<DraftExercise>) => void;
  removeDraftExercise: (id: string) => void;
  moveDraftExercise: (id: string, direction: -1 | 1) => void;
  clearDraft: () => void;
}

const StoreContext = createContext<WorkoutsStore | null>(null);

function loadInitialState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as State;
      return { ...EMPTY_STATE, ...parsed };
    }
  } catch {
    // Corrupt storage: start clean. The database history is untouched.
  }
  return EMPTY_STATE;
}

export function WorkoutsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, EMPTY_STATE);
  const [ready, markReady] = useReducer(() => true, false);

  useEffect(() => {
    dispatch({ type: "hydrate", state: loadInitialState() });
    markReady();
  }, []);

  useEffect(() => {
    if (!ready) {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full/unavailable: the session still works in memory.
    }
  }, [state, ready]);

  const value = useMemo<WorkoutsStore>(
    () => ({
      session: state.session,
      restTimer: state.restTimer,
      draft: state.draft,
      ready,
      startSession: (session) => dispatch({ type: "start-session", session }),
      discardSession: () => dispatch({ type: "discard-session" }),
      clearSession: () => dispatch({ type: "clear-session" }),
      renameSession: (name) => dispatch({ type: "rename-session", name }),
      setSessionNotes: (notes) => dispatch({ type: "set-session-notes", notes }),
      timerPlay: () => dispatch({ type: "timer-play", now: Date.now() }),
      timerPause: () => dispatch({ type: "timer-pause", now: Date.now() }),
      timerReset: () => dispatch({ type: "timer-reset" }),
      updateSet: (wexId, setId, field, value) =>
        dispatch({ type: "update-set", wexId, setId, field, value }),
      setSetCompleted: (wexId, setId, completed, prs) =>
        dispatch({
          type: "set-completed",
          wexId,
          setId,
          completed,
          prs,
          now: Date.now(),
        }),
      completeAllSets: (prsBySetId, wexId) =>
        dispatch({ type: "complete-all-sets", wexId, prsBySetId }),
      addSet: (wexId, setType) => dispatch({ type: "add-set", wexId, setType }),
      setSetType: (wexId, setId, setType) =>
        dispatch({ type: "set-set-type", wexId, setId, setType }),
      setSetRpe: (wexId, setId, rpe) =>
        dispatch({ type: "set-set-rpe", wexId, setId, rpe }),
      removeSet: (wexId, setId) => dispatch({ type: "remove-set", wexId, setId }),
      addSessionExercises: (exercises) =>
        dispatch({ type: "add-session-exercises", exercises }),
      replaceSessionExercise: (wexId, exercise) =>
        dispatch({ type: "replace-session-exercise", wexId, exercise }),
      removeSessionExercise: (wexId) =>
        dispatch({ type: "remove-session-exercise", wexId }),
      moveSessionExercise: (wexId, direction) =>
        dispatch({ type: "move-session-exercise", wexId, direction }),
      setExerciseRest: (wexId, seconds) =>
        dispatch({ type: "set-exercise-rest", wexId, seconds }),
      setExerciseNote: (wexId, note) =>
        dispatch({ type: "set-exercise-note", wexId, note }),
      adjustRest: (deltaSeconds) =>
        dispatch({ type: "adjust-rest", deltaSeconds, now: Date.now() }),
      skipRest: () => dispatch({ type: "skip-rest" }),
      initDraft: (draft) => dispatch({ type: "init-draft", draft }),
      setDraftName: (name) => dispatch({ type: "set-draft-name", name }),
      addDraftExercises: (exercises) =>
        dispatch({ type: "add-draft-exercises", exercises }),
      patchDraftExercise: (id, patch) =>
        dispatch({ type: "patch-draft-exercise", id, patch }),
      removeDraftExercise: (id) =>
        dispatch({ type: "remove-draft-exercise", id }),
      moveDraftExercise: (id, direction) =>
        dispatch({ type: "move-draft-exercise", id, direction }),
      clearDraft: () => dispatch({ type: "clear-draft" }),
    }),
    [state, ready]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useWorkouts(): WorkoutsStore {
  const ctx = useContext(StoreContext);
  // CI-8: the provider's `ready` flag flips in ITS effect, which can run
  // before a consumer inside a still-dehydrated Suspense boundary hydrates,
  // so that consumer's first (hydration) render would see the localStorage
  // session and mismatch the server HTML, which always renders the empty
  // state. Veil the persisted state until THIS component has mounted: its
  // own first render then always matches the server, and the layout effect
  // reveals the real state synchronously before paint (no flash on
  // client-side navigations, where components also mount fresh).
  const [hydrated, setHydrated] = useState(false);
  useLayoutEffect(() => setHydrated(true), []);
  const store = useMemo(
    () =>
      ctx && !hydrated
        ? { ...ctx, session: null, restTimer: null, draft: null, ready: false }
        : ctx,
    [ctx, hydrated]
  );
  if (!store) {
    throw new Error("useWorkouts must be used inside <WorkoutsProvider>");
  }
  return store;
}
