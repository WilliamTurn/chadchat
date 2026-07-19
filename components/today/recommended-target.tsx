"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  acceptRecommendedTarget,
  getTargetRecommendation,
  saveRecommendationInputs,
} from "@/app/nutrition/actions";
import { SegmentedPicker } from "@/components/meal-plan/segmented-picker";
import { ActivityLevelField } from "@/components/profile/activity-level-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  MissingRecommendationInput,
  TargetRecommendation,
} from "@/lib/nutrition/target-recommendation";
import {
  type ActivityLevel,
  ftInToCm,
  type Sex,
  SEX_OPTIONS,
  unitSystemFor,
} from "@/lib/profile";

/**
 * Calories-burned Phase 2: the "Recommended for you" block inside the
 * target editor. Three states, all computed server-side on open:
 *  - ready: the recommended daily target (observed expenditure outranks the
 *    formula, D1) with a one-line plain explanation and one tap to accept
 *    through the effective-dated consent rails (D4: proposed, never silent).
 *  - missing: asks for exactly the formula inputs still missing instead of
 *    hiding. A weight entered here is saved as the FIRST weigh-in
 *    (ProgressEntry), one storage place.
 *  - error: quiet line + retry; manual entry below is never blocked.
 */

type BlockState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "loaded";
      rec: TargetRecommendation;
      weightUnit: "lb" | "kg";
    };

/** The one-line plain explanation under the number (plan §5 wording). */
function explanationLine(
  rec: Extract<TargetRecommendation, { kind: "ready" }>
): string {
  const burn = rec.burnPerDay.toLocaleString();
  const target = rec.target.toLocaleString();
  const lead =
    rec.basis === "logs"
      ? `Your logs put your daily burn near ${burn}.`
      : `Maintenance is about ${burn}.`;
  const pace =
    rec.desiredRate === 0
      ? `Holding your weight means ${target}.`
      : rec.desiredRate < 0
        ? `Losing ${Math.abs(rec.desiredRate)} ${rec.unit} a week means ${target}.`
        : `Gaining ${rec.desiredRate} ${rec.unit} a week means ${target}.`;
  const floor = rec.floored
    ? " That's the lowest recommended daily target."
    : "";
  return `${lead} ${pace}${floor}`;
}

export function RecommendedTargetBlock({
  open,
  onAccepted,
}: {
  /** The parent dialog's open state; the block loads on each open. */
  open: boolean;
  /** Called after a successful accept with the saved calorie target. */
  onAccepted: (calories: number) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<BlockState>({ status: "loading" });
  const [pending, startTransition] = useTransition();

  async function load() {
    setState({ status: "loading" });
    try {
      const result = await getTargetRecommendation();
      if (result.ok && result.rec) {
        setState({
          status: "loaded",
          rec: result.rec,
          weightUnit: result.weightUnit ?? "lb",
        });
      } else {
        setState({ status: "error" });
      }
    } catch {
      setState({ status: "error" });
    }
  }

  // Recompute on every open: profile edits or new logs elsewhere must show.
  // biome-ignore lint/correctness/useExhaustiveDependencies: load is stable per render purpose
  useEffect(() => {
    if (open) {
      load();
    }
  }, [open]);

  function onAccept(rec: Extract<TargetRecommendation, { kind: "ready" }>) {
    startTransition(async () => {
      const result = await acceptRecommendedTarget();
      if (result.ok) {
        toast.success(
          `Target updated: ${rec.target.toLocaleString()} calories a day.`
        );
        onAccepted(rec.target);
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't update your target.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-border bg-muted/30 p-4">
      <h3 className="font-medium text-sm">Recommended for you</h3>

      {state.status === "loading" && (
        <div aria-hidden className="mt-3 flex flex-col gap-2">
          <div className="h-7 w-40 animate-pulse rounded bg-muted-foreground/20" />
          <div className="h-4 w-full animate-pulse rounded bg-muted-foreground/20" />
        </div>
      )}

      {state.status === "error" && (
        <div className="mt-2 flex flex-col items-start gap-2.5">
          <p className="text-muted-foreground text-sm">
            Couldn&apos;t load your recommendation.
          </p>
          <Button onClick={load} size="sm" type="button" variant="outline">
            Try again
          </Button>
        </div>
      )}

      {state.status === "loaded" && state.rec.kind === "ready" && (
        <ReadyView onAccept={onAccept} pending={pending} rec={state.rec} />
      )}

      {state.status === "loaded" && state.rec.kind === "missing" && (
        <MissingInputsForm
          missing={state.rec.missing}
          onSaved={() => {
            router.refresh();
            load();
          }}
          weightUnit={state.weightUnit}
        />
      )}
    </section>
  );
}

function ReadyView({
  rec,
  pending,
  onAccept,
}: {
  rec: Extract<TargetRecommendation, { kind: "ready" }>;
  pending: boolean;
  onAccept: (rec: Extract<TargetRecommendation, { kind: "ready" }>) => void;
}) {
  return (
    <div className="mt-2 flex flex-col gap-3">
      <div>
        <p className="font-semibold text-2xl tracking-tight">
          {rec.target.toLocaleString()}
          <span className="ml-1.5 font-normal text-muted-foreground text-sm">
            calories a day
          </span>
        </p>
        <p className="mt-0.5 text-muted-foreground text-xs">
          {rec.basis === "logs"
            ? "Estimated from your logged meals and weigh-ins"
            : "Estimated from your stats"}
        </p>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {explanationLine(rec)}
      </p>
      {rec.matchesCurrent ? (
        <p className="text-muted-foreground text-xs">
          This is your current target.
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <Button
            disabled={pending}
            onClick={() => onAccept(rec)}
            size="sm"
            type="button"
          >
            {pending ? "Saving…" : `Use ${rec.target.toLocaleString()}`}
          </Button>
          <p className="text-muted-foreground text-xs">
            Or set your own below.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * The missing-data ask: exactly the formula inputs the recommendation still
 * needs, in the member's unit system. All asked fields are required so one
 * save always produces the recommendation.
 */
function MissingInputsForm({
  missing,
  weightUnit,
  onSaved,
}: {
  missing: MissingRecommendationInput[];
  weightUnit: "lb" | "kg";
  onSaved: () => void;
}) {
  const system = unitSystemFor(weightUnit);
  const [pending, startTransition] = useTransition();

  const [activity, setActivity] = useState<ActivityLevel | null>(null);
  const [sex, setSex] = useState<Sex | null>(null);
  const [age, setAge] = useState("");
  const [heightFt, setHeightFt] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weight, setWeight] = useState("");

  const asks = new Set(missing);

  const heightCmValue: number | null =
    system === "imperial"
      ? heightFt.trim()
        ? ftInToCm(Number(heightFt), Number(heightIn || "0"))
        : null
      : heightCm.trim()
        ? Math.round(Number(heightCm))
        : null;

  const complete =
    (!asks.has("activity") || activity != null) &&
    (!asks.has("sex") || sex != null) &&
    (!asks.has("age") || Number(age) > 0) &&
    (!asks.has("height") || heightCmValue != null) &&
    (!asks.has("weight") || Number(weight) > 0);

  function onSave() {
    startTransition(async () => {
      const result = await saveRecommendationInputs({
        ...(asks.has("activity") && activity ? { activityLevel: activity } : {}),
        ...(asks.has("sex") && sex ? { sex } : {}),
        ...(asks.has("age") && age.trim() ? { age: Number(age) } : {}),
        ...(asks.has("height") && heightCmValue != null
          ? { heightCm: heightCmValue }
          : {}),
        ...(asks.has("weight") && weight.trim()
          ? { weight: Number(weight) }
          : {}),
      });
      if (result.ok) {
        onSaved();
      } else {
        toast.error(result.error ?? "Couldn't save those details.");
      }
    });
  }

  return (
    <div className="mt-2 flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        To see a recommended daily target, fill in what&apos;s missing.
      </p>

      {asks.has("activity") && (
        <ActivityLevelField onChange={setActivity} value={activity} />
      )}

      {asks.has("sex") && (
        <div className="flex flex-col gap-2">
          <Label>Sex</Label>
          <SegmentedPicker
            ariaLabel="Sex"
            onChange={setSex}
            options={[...SEX_OPTIONS]}
            value={sex as Sex}
          />
        </div>
      )}

      {(asks.has("age") || asks.has("weight")) && (
      <div
        className={
          asks.has("age") && asks.has("weight")
            ? "grid grid-cols-2 gap-4"
            : "grid grid-cols-1 gap-4"
        }
      >
        {asks.has("age") && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="rec-age">Age</Label>
            <Input
              id="rec-age"
              inputMode="numeric"
              onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="30"
              value={age}
            />
          </div>
        )}

        {asks.has("weight") && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="rec-weight">Current weight ({weightUnit})</Label>
            <Input
              id="rec-weight"
              inputMode="decimal"
              onChange={(e) =>
                setWeight(e.target.value.replace(/[^0-9.]/g, ""))
              }
              placeholder={system === "metric" ? "82" : "180"}
              value={weight}
            />
            <span className="text-muted-foreground text-xs">
              Saved as your first weigh-in.
            </span>
          </div>
        )}
      </div>
      )}

      {asks.has("height") && (
        <div className="flex flex-col gap-2">
          <Label>Height</Label>
          {system === "imperial" ? (
            <div className="grid grid-cols-2 gap-2">
              <Input
                aria-label="Height (feet)"
                inputMode="numeric"
                onChange={(e) =>
                  setHeightFt(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="Feet"
                value={heightFt}
              />
              <Input
                aria-label="Height (inches)"
                inputMode="numeric"
                onChange={(e) =>
                  setHeightIn(e.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="Inches"
                value={heightIn}
              />
            </div>
          ) : (
            <Input
              aria-label="Height (centimeters)"
              inputMode="numeric"
              onChange={(e) =>
                setHeightCm(e.target.value.replace(/[^0-9]/g, ""))
              }
              placeholder="Centimeters"
              value={heightCm}
            />
          )}
        </div>
      )}

      <div>
        <Button
          disabled={pending || !complete}
          onClick={onSave}
          size="sm"
          type="button"
        >
          {pending ? "Saving…" : "See your target"}
        </Button>
      </div>
    </div>
  );
}
