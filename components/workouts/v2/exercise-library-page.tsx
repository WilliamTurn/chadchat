"use client";

// The exercise catalog page body: search, muscle chips, create-your-own, and
// a row per exercise linking to its records & progress.

import { ChevronRight, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useUrlParam } from "@/hooks/use-url-state";
import { enumParam, textParam } from "@/lib/url-state";
import {
  MUSCLE_GROUP_LABELS,
  MUSCLE_GROUPS,
} from "@/lib/workouts/exercise-library";
import type { PrBaseline } from "@/lib/workouts/stats";
import {
  type CustomExerciseData,
  equipmentLabel,
  exerciseSlug,
  mergeCatalog,
  muscleLabel,
} from "./catalog";
import { formatWeight } from "./format";
import { WCard } from "./ui";

const QUERY_PARAM = textParam();
const MUSCLE_PARAM = enumParam<string>(["all", ...MUSCLE_GROUPS], "all");

export function ExerciseLibrary({
  customExercises,
  prBaseline,
}: {
  customExercises: CustomExerciseData[];
  prBaseline: Record<string, PrBaseline>;
}) {
  // URL-synced (FIX-03): `?q=` + `?muscle=` restore the filtered catalog on
  // back/forward and deep links. Typing debounces the URL write (the input
  // itself is instant); both replace, never push (Linear/Stripe filter
  // hygiene: no history entry per keystroke). `all` is the default, omitted.
  const [query, setQuery] = useUrlParam("q", QUERY_PARAM, {
    debounceMs: 350,
  });
  const [muscle, setMuscle] = useUrlParam("muscle", MUSCLE_PARAM);
  const catalog = useMemo(() => mergeCatalog(customExercises), [customExercises]);

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

  return (
    <div className="pb-24">
      <label className="relative block">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-muted-foreground/70"
        />
        <input
          aria-label="Search exercises"
          className="h-[52px] w-full rounded-xl border border-input bg-card pr-4 pl-10 text-[15px] text-foreground placeholder:text-muted-foreground/60 focus:border-blood/60 focus:outline-none"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises…"
          type="search"
          value={query}
        />
      </label>

      {/* Scrollable full-bleed chip row on phones; from md (where the LAY-2
          sidebar engages and full-bleed math breaks) it wraps in place. */}
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

      {/* Create your own */}
      <WCard className="mt-4">
        <Link
          className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition hover:bg-muted/50"
          href="/workouts/exercises/new"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blood-dim text-blood">
            <Plus aria-hidden className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold text-[15.5px] text-foreground">
              Create a custom exercise
            </span>
            <span className="block text-[13px] text-muted-foreground">
              Add your own custom exercise if you can&apos;t find it here. Add
              it once, use it forever.
            </span>
          </span>
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground/70"
          />
        </Link>
      </WCard>

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
              const best = prBaseline[exercise.name.trim().toLowerCase()];
              return (
                <li className="min-w-0" key={exercise.name}>
                  <Link
                    className="flex h-full min-h-[64px] items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 transition hover:border-input hover:bg-muted/30"
                    href={`/workouts/exercises/${exerciseSlug(exercise.name)}`}
                  >
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
                    <ChevronRight
                      aria-hidden
                      className="size-4 shrink-0 text-muted-foreground/70"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
