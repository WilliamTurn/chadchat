"use client";

// The Add Exercises PAGE (never a popup, never an overlay): search, muscle
// filters, the member's own exercises first, and a create-your-own path.
// Selections apply to the builder draft or the live session (both live in
// the store), then this page navigates back to where the member came from.

import { Check, ChevronRight, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import type { LastExerciseLog, PrBaseline } from "@/lib/workouts/stats";
import { MUSCLE_GROUPS, MUSCLE_GROUP_LABELS } from "@/lib/workouts/exercise-library";
import {
  type CustomExerciseData,
  equipmentLabel,
  mergeCatalog,
  muscleLabel,
} from "./catalog";
import { formatWeight } from "./format";
import { exerciseFromRef } from "./session-factory";
import { useWorkouts, uid } from "./store";
import type { DraftExercise, ExerciseRef } from "./types";
import { WButton, WCard } from "./ui";

export type PickerTarget = "draft" | "session" | "replace";

function refToDraftExercise(ref: ExerciseRef): DraftExercise {
  return {
    id: uid("dex"),
    name: ref.name,
    muscleGroup: ref.muscleGroup,
    equipment: ref.equipment,
    kind: ref.kind,
    targetSets: 3,
    repRangeMin: ref.kind === "timed" ? 30 : 8,
    repRangeMax: ref.kind === "timed" ? 60 : 12,
    restSeconds: 120,
    note: null,
  };
}

export function ExercisePickerPage({
  target,
  replaceWexId,
  customExercises,
  lastSets,
  prBaseline,
}: {
  target: PickerTarget;
  /** The session exercise being swapped when target = "replace". */
  replaceWexId: string | null;
  customExercises: CustomExerciseData[];
  lastSets: Record<string, LastExerciseLog>;
  prBaseline: Record<string, PrBaseline>;
}) {
  const router = useRouter();
  const {
    ready,
    draft,
    session,
    addDraftExercises,
    addSessionExercises,
    replaceSessionExercise,
  } = useWorkouts();

  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<string>("all");
  const [selected, setSelected] = useState<string[]>([]);

  const single = target === "replace";
  const catalog = useMemo(() => mergeCatalog(customExercises), [customExercises]);

  // Exercises already in the plan/session are shown but not re-addable.
  const excluded = useMemo(() => {
    const names =
      target === "draft"
        ? (draft?.exercises ?? []).map((e) => e.name)
        : (session?.exercises ?? []).map((e) => e.name);
    return new Set(names.map((n) => n.trim().toLowerCase()));
  }, [target, draft, session]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalog.filter((e) => {
      if (muscle !== "all" && e.muscleGroup !== muscle) {
        return false;
      }
      if (
        q &&
        !e.name.toLowerCase().includes(q) &&
        !(e.muscleGroup ?? "").toLowerCase().includes(q) &&
        !(e.equipment ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [catalog, query, muscle]);

  function applyRefs(refs: ExerciseRef[]) {
    if (target === "draft") {
      addDraftExercises(refs.map(refToDraftExercise));
      toast.success(
        refs.length === 1
          ? `${refs[0].name} added to the workout builder.`
          : `${refs.length} exercises added to the workout builder.`
      );
    } else if (target === "replace" && replaceWexId) {
      const old = session?.exercises.find((ex) => ex.id === replaceWexId);
      const ref = refs[0];
      if (ref) {
        const fresh = exerciseFromRef(ref, lastSets);
        replaceSessionExercise(replaceWexId, {
          ...fresh,
          id: replaceWexId,
          restSeconds: old?.restSeconds ?? fresh.restSeconds,
        });
        // One term per concept: "replace", never "swap" (canon 04 §132).
        toast.success(
          old
            ? `${old.name} replaced with ${ref.name}.`
            : `Replaced with ${ref.name}.`
        );
      }
    } else {
      addSessionExercises(refs.map((ref) => exerciseFromRef(ref, lastSets)));
      toast.success(
        refs.length === 1
          ? `${refs[0].name} added to your workout.`
          : `${refs.length} exercises added to your workout.`
      );
    }
    // Land on the workout in ONE tap, whatever the history stack looks like
    // (flaws XPK-16: router.back() looped through the custom-exercise form).
    router.replace(target === "draft" ? "/workouts/new" : "/workouts/active");
  }

  function toggle(ref: ExerciseRef) {
    if (excluded.has(ref.name.trim().toLowerCase())) {
      return;
    }
    if (single) {
      applyRefs([ref]);
      return;
    }
    setSelected((prev) =>
      prev.includes(ref.name)
        ? prev.filter((n) => n !== ref.name)
        : [...prev, ref.name]
    );
  }

  if (!ready) {
    return (
      // biome-ignore lint/a11y/useSemanticElements: role="status" is the standard live-region idiom; swapping to <output> changes element semantics and default display for zero AT gain.
      <div className="py-24 text-center text-muted-foreground" role="status">
        Loading…
      </div>
    );
  }

  const returnLabel = target === "draft" ? "the workout builder" : "your workout";

  return (
    <div className="pb-36">
      {/* Search */}
      <label className="relative block">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground/70"
        />
        <input
          aria-label="Search exercises"
          // text-base: the 16px iOS no-zoom floor on the first field a
          // member touches on this page (mobile audit; canon 06 §90).
          className="h-[52px] w-full rounded-xl border border-input bg-card pr-4 pl-10 text-base text-foreground placeholder:text-muted-foreground/60 focus:border-blood/60 focus:outline-none"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises…"
          type="search"
          value={query}
        />
      </label>

      {/* Muscle filter chips: scrollable full-bleed row on phones; from md
          (where the LAY-2 sidebar engages and full-bleed math breaks) it
          wraps in place. */}
      <div
        aria-label="Filter by muscle group"
        className="scrollbar-none -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 py-1 sm:-mx-6 sm:px-6 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
        role="tablist"
      >
        {[
          { value: "all", label: "All muscles" },
          ...MUSCLE_GROUPS.map((m) => ({
            value: m as string,
            label: MUSCLE_GROUP_LABELS[m],
          })),
        ].map((m) => (
          <button
            aria-selected={muscle === m.value}
            className={`min-h-[44px] shrink-0 cursor-pointer rounded-full px-4 font-semibold text-[13.5px] transition ${
              muscle === m.value
                ? "bg-foreground text-background"
                : "bg-muted/70 text-muted-foreground hover:text-foreground"
            }`}
            key={m.value}
            onClick={() => setMuscle(m.value)}
            role="tab"
            type="button"
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Create your own, always one tap away. */}
      <WCard className="mt-4">
        <button
          className="flex min-h-[64px] w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-muted/50"
          onClick={() =>
            router.push(
              // `wex`, NOT `replace`: both readers of this id -
              // app/workouts/exercises/new/page.tsx (which rebuilds the back
              // href) and app/workouts/exercises/pick/page.tsx (which feeds
              // replaceWexId) - key on `wex`. Emitting `replace` dropped the
              // id on the round trip, so returning from "create a custom
              // exercise" mid-swap left the picker with replaceWexId=null: it
              // still promised "swap it in" but fell through to the ADD
              // branch and appended a duplicate exercise to the live session.
              // Found by the S0c ux-flow-auditor pass.
              `/workouts/exercises/new?from=pick&target=${target}${
                replaceWexId ? `&wex=${replaceWexId}` : ""
              }`
            )
          }
          type="button"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--go)]/12 text-[var(--go)]">
            <Plus aria-hidden className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-[15.5px] text-foreground">
              Create a custom exercise
            </span>
            <span className="block text-[13px] text-muted-foreground">
              Add your own custom exercise if you can&apos;t find it here.
            </span>
          </span>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground/70" />
        </button>
      </WCard>

      {/* Results */}
      <div className="mt-2">
        {results.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-semibold text-[15px] text-foreground">
              No exercises match
            </p>
            <p className="mt-1 text-[13.5px] text-muted-foreground">
              Try a different name, clear the muscle filter, or create it as a
              custom exercise above.
            </p>
          </div>
        ) : (
          /* Multi-column card grid on desktop (LAY-1); explicit grid-cols-1 +
             min-w-0 so the implicit column never sizes to max-content.
             Columns start at lg (768 content is too narrow beside the
             sidebar for half-width cards). */
          <ul className="grid grid-cols-1 gap-2 lg:grid-cols-2 xl:grid-cols-3">
            {results.map((exercise) => {
              const key = exercise.name.trim().toLowerCase();
              const inList = excluded.has(key);
              const isSelected = selected.includes(exercise.name);
              const best = prBaseline[key];
              return (
                <li className="min-w-0" key={exercise.name}>
                  <button
                    aria-pressed={single ? undefined : isSelected}
                    className={`flex h-full min-h-[64px] w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      inList
                        ? "border-border bg-card opacity-40"
                        : isSelected
                          ? "border-[var(--go)]/60 bg-[var(--go)]/12"
                          : "border-border bg-card hover:border-input hover:bg-muted/30"
                    }`}
                    disabled={inList}
                    onClick={() => toggle(exercise)}
                    type="button"
                  >
                    <span
                      aria-hidden
                      className={`flex size-6 shrink-0 items-center justify-center rounded-md border transition ${
                        isSelected
                          ? "border-[var(--go)] bg-[var(--go)] text-[var(--bg)]"
                          : "border-input text-transparent"
                      } ${single ? "hidden" : ""}`}
                    >
                      <Check className="size-4" strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-[15.5px] text-foreground">
                        {exercise.name}
                      </span>
                      <span className="block text-[13px] text-muted-foreground">
                        {/* Unset "Other" facets add no information; drop
                            them instead of printing "Other · Other". */}
                        {[
                          muscleLabel(exercise.muscleGroup),
                          equipmentLabel(exercise.equipment),
                        ]
                          .filter((label) => label && label !== "Other")
                          .concat(exercise.custom ? ["Your exercise"] : [])
                          .concat(inList ? ["Already added"] : [])
                          .join(" · ")}
                      </span>
                    </span>
                    {best && best.bestWeightLb > 0 && (
                      <span className="shrink-0 text-right">
                        <span className="block font-mono font-semibold text-[14px] text-foreground tabular-nums">
                          {formatWeight(best.bestWeightLb)} lb
                        </span>
                        <span className="block text-[11px] text-muted-foreground/80">
                          your best
                        </span>
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Multi-select confirm bar. Portaled to <body>: the shell's <main>
          carries a transform that would otherwise anchor this "fixed" bar to
          the document floor instead of pinning it to the viewport. (This
          renders only after `ready`, i.e. post-mount, so document exists.) */}
      {!single &&
        createPortal(
          <div
            // Above the phone tab bar, never covering it (placement canon
            // 08 #58; owner order 2026-07-24, same stack as the finish bar).
            className="bottom-pinned-bar fixed inset-x-0 z-50 border-border border-t bg-background/95 px-4 pt-3 backdrop-blur-xl"
          >
            <div className="mx-auto w-full max-w-[560px]">
              <WButton
                className="w-full"
                disabled={selected.length === 0}
                onClick={() => {
                  const refs = selected
                    .map((name) => catalog.find((e) => e.name === name))
                    .filter((e): e is ExerciseRef => Boolean(e));
                  applyRefs(refs);
                }}
                size="lg"
                variant="primary"
              >
                {selected.length === 0
                  ? "Select exercises to add"
                  : `Add ${selected.length} ${
                      selected.length === 1 ? "exercise" : "exercises"
                    } to ${returnLabel}`}
              </WButton>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
