"use client";

import {
  Activity,
  CalendarClock,
  Dumbbell,
  Percent,
  Ruler,
  Scale,
  Sparkles,
  Target,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { removeGoal, saveGoalRecord, updateGoalRecord } from "@/app/today/actions";
import type { EditableGoal } from "@/components/goals/types";
import { Button } from "@/components/ui/button";
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
import {
  dateWeeksFromNow,
  formatTargetDate,
  liftFeasibility,
  parseTargetDate,
  type RateBand,
  weightFeasibility,
} from "@/lib/goals/feasibility";
import { cn } from "@/lib/utils";

const NONE = "none";

type MetricChoice = {
  value: string;
  label: string;
  description: string;
  icon: React.ReactNode;
};

const METRIC_CHOICES: MetricChoice[] = [
  {
    value: NONE,
    label: "Just a goal",
    description: "No number to track. Chad still sees it and holds you to it.",
    icon: <Sparkles className="size-4" />,
  },
  {
    value: "weight",
    label: "Bodyweight",
    description: "Hit a target weight. Progress tracks itself from your weigh-ins.",
    icon: <Scale className="size-4" />,
  },
  {
    value: "lift",
    label: "A lift (est. 1RM)",
    description: "Get a lift to a target max. Tracks from your logged sets.",
    icon: <Dumbbell className="size-4" />,
  },
  {
    value: "bodyfat",
    label: "Body fat %",
    description: "Bring your body fat percentage down to a target.",
    icon: <Percent className="size-4" />,
  },
  {
    value: "measurement",
    label: "A measurement",
    description: "Waist, arms, chest: any body measurement you track.",
    icon: <Ruler className="size-4" />,
  },
  {
    value: "custom",
    label: "Something else",
    description: "Any other number you want to move. You update it.",
    icon: <Activity className="size-4" />,
  },
];

const DEADLINE_CHIPS: { label: string; weeks: number }[] = [
  { label: "4 weeks", weeks: 4 },
  { label: "8 weeks", weeks: 8 },
  { label: "12 weeks", weeks: 12 },
  { label: "6 months", weeks: 26 },
];

// Pace-first date picking (the Lose It / MyFitnessPal pattern): pick how fast
// you want to move and the goal date fills itself from your numbers.
const PACE_CHIPS: Record<"lb" | "kg", number[]> = {
  lb: [0.5, 1, 1.5, 2],
  kg: [0.25, 0.5, 0.75, 1],
};

function numOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) {
    return null;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** The stored target-date string ("Sep 30, 2026") as a native date-input
 *  value ("2026-09-30"); "" when the stored text isn't a parseable date. */
function toDateInputValue(raw: string): string {
  const d = parseTargetDate(raw);
  if (!d) {
    return "";
  }
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function todayInputValue(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * The dedicated goal create/edit page body (MOB-19): the full-width form that
 * replaced the cramped dialog, plus what no popup had room for, live
 * feasibility coaching: required pace vs a sustainable pace, a realistic
 * landing date, and your actual lift baseline.
 */
export function GoalForm({
  mode,
  goal,
  exerciseNames,
  currentWeight,
  liftE1rm,
  defaultUnit,
}: {
  mode: "create" | "edit";
  goal?: EditableGoal;
  /** Logged exercise names, offered as suggestions for a lift goal. */
  exerciseNames: string[];
  /** The member's current trend weight, for the one-tap start prefill. */
  currentWeight: { value: number; unit: "lb" | "kg" } | null;
  /** Current best est. 1RM (lb) per logged exercise, lowercased name. */
  liftE1rm: Record<string, number>;
  defaultUnit: "lb" | "kg";
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [pending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [title, setTitle] = useState(goal?.title ?? "");
  const [detail, setDetail] = useState(goal?.detail ?? "");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  // Which quick-date/pace chip filled the current date, so the picked chip
  // stays visibly selected (cleared when the member edits the date directly).
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [status, setStatus] = useState<EditableGoal["status"]>(
    goal?.status ?? "active"
  );
  const [metric, setMetric] = useState<string>(goal?.metric ?? NONE);
  const [metricRef, setMetricRef] = useState(goal?.metricRef ?? "");
  const [startValue, setStartValue] = useState(
    goal?.startValue != null ? String(goal.startValue) : ""
  );
  const [targetValue, setTargetValue] = useState(
    goal?.targetValue != null ? String(goal.targetValue) : ""
  );
  const [unit, setUnit] = useState(goal?.unit ?? "");

  const isLift = metric === "lift";
  const hasMetric = metric !== NONE;

  // A selected pace chip's claim ("Lose 1 lb a week") is only true for the
  // numbers it was computed from; editing them makes it stale.
  function clearStalePaceChip() {
    setSelectedChip((chip) => (chip?.startsWith("pace:") ? null : chip));
  }
  // Unit space for the pace-first chips (kg members see kg paces).
  const paceUnit: "lb" | "kg" = (unit || defaultUnit)
    .trim()
    .toLowerCase()
    .startsWith("k")
    ? "kg"
    : "lb";

  function onMetricChange(value: string) {
    setMetric(value);
    // Sensible default units per metric so members only type the numbers.
    if (value === "lift" && !unit.trim()) {
      setUnit("lb");
    }
    if (value === "weight" && !unit.trim()) {
      setUnit(defaultUnit);
    }
    if (value === "bodyfat") {
      setUnit("%");
    }
  }

  // The member's current best est. 1RM for the typed lift, if they've logged it.
  const liftBaseline = isLift
    ? (liftE1rm[metricRef.trim().toLowerCase()] ?? null)
    : null;

  // Live feasibility: the coaching no mainstream app gives at the rate picker.
  const feasibility = useMemo(() => {
    if (metric === "weight") {
      const start = numOrNull(startValue);
      const target = numOrNull(targetValue);
      if (start != null && target != null) {
        return {
          kind: "weight" as const,
          data: weightFeasibility({ start, target, targetDate }),
        };
      }
    }
    if (isLift) {
      const target = numOrNull(targetValue);
      if (target != null && liftBaseline != null) {
        return {
          kind: "lift" as const,
          data: liftFeasibility({
            currentE1rm: liftBaseline,
            target,
            targetDate,
          }),
        };
      }
    }
    return null;
  }, [metric, isLift, startValue, targetValue, targetDate, liftBaseline]);

  // Narrowed weight-goal feasibility for the pace-first chips (TS can't carry
  // the discriminated-union narrowing into the chip onClick closures).
  const weightPace =
    feasibility?.kind === "weight" ? feasibility.data : null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Give your goal a title.");
      return;
    }
    if (isLift && !metricRef.trim()) {
      toast.error("Name the lift to track (e.g. Back Squat).");
      return;
    }
    const payload = {
      title: title.trim(),
      detail: detail.trim(),
      targetDate: targetDate.trim() || null,
      status,
      metric: hasMetric ? (metric as EditableGoal["metric"]) : null,
      metricRef: isLift ? metricRef.trim() || null : null,
      // A lift goal reads its start from the first logged e1RM, so Start is
      // hidden and left null.
      startValue: hasMetric && !isLift ? numOrNull(startValue) : null,
      targetValue: hasMetric ? numOrNull(targetValue) : null,
      unit: hasMetric ? unit.trim() || null : null,
    };
    startTransition(async () => {
      const result =
        isEdit && goal
          ? await updateGoalRecord({ id: goal.id, ...payload })
          : await saveGoalRecord(payload);
      if (result.ok) {
        toast.success(isEdit ? "Goal updated." : "Goal saved.");
        router.push("/goals");
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't save your goal.");
      }
    });
  }

  function destroy() {
    if (!goal) {
      return;
    }
    startTransition(async () => {
      const result = await removeGoal(goal.id);
      if (result.ok) {
        toast.success("Goal deleted.");
        router.push("/goals");
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't delete that goal.");
      }
    });
  }

  return (
    <form className="flex max-w-2xl flex-col gap-7" onSubmit={onSubmit}>
      {/* 1 · The goal in your own words */}
      <section className="flex flex-col gap-4">
        <SectionHeading
          icon={<Target className="size-4" />}
          title="What are you chasing?"
        />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="g-title">Goal</Label>
          <Input
            className="h-11"
            id="g-title"
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Lose 20 lb and see abs"
            value={title}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="g-detail">Details (optional)</Label>
          <Textarea
            className="min-h-24"
            id="g-detail"
            maxLength={8000}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="The full picture: your why, what done looks like, how you'll measure it. Chad reads every word and holds you to it."
            value={detail}
          />
        </div>
      </section>

      {/* 2 · Pin a number to it */}
      <section className="flex flex-col gap-4">
        <SectionHeading
          icon={<Scale className="size-4" />}
          title="Track it with a number (recommended)"
          subtitle="A goal with a number gets a live progress bar on your dashboard. One without stays words."
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {METRIC_CHOICES.map((c) => (
            <button
              className={cn(
                "flex min-h-11 items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors",
                metric === c.value
                  ? "border-blood/40 bg-blood/10"
                  : "border-border hover:bg-accent"
              )}
              key={c.value}
              onClick={() => onMetricChange(c.value)}
              type="button"
            >
              <span
                className={cn(
                  "mt-0.5 shrink-0",
                  metric === c.value ? "text-blood" : "text-muted-foreground"
                )}
              >
                {c.icon}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block font-medium text-sm",
                    metric === c.value ? "text-blood" : "text-foreground"
                  )}
                >
                  {c.label}
                </span>
                <span className="block text-muted-foreground text-xs leading-snug">
                  {c.description}
                </span>
              </span>
            </button>
          ))}
        </div>

        {isLift && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-lift">Which lift?</Label>
              <Input
                autoComplete="off"
                className="h-11"
                id="g-lift"
                list="g-lift-options"
                onChange={(e) => setMetricRef(e.target.value)}
                placeholder="e.g. Back Squat"
                value={metricRef}
              />
              {exerciseNames.length > 0 && (
                <datalist id="g-lift-options">
                  {exerciseNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              )}
              {liftBaseline != null ? (
                <p className="text-muted-foreground text-xs">
                  Your current best est. 1RM for {metricRef.trim()}:{" "}
                  <span className="font-medium text-foreground">
                    {Math.round(liftBaseline)} lb
                  </span>
                  . Progress starts from there.
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Chad reads your best est. 1RM for this lift from your logged
                  sets and charts it against the target.
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="g-targetval">Target 1RM</Label>
                <Input
                  className="h-11"
                  id="g-targetval"
                  inputMode="decimal"
                  onChange={(e) => setTargetValue(e.target.value)}
                  placeholder="405"
                  value={targetValue}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="g-unit">Unit</Label>
                <Input
                  className="h-11"
                  id="g-unit"
                  maxLength={20}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="lb"
                  value={unit}
                />
              </div>
            </div>
          </div>
        )}

        {hasMetric && !isLift && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="g-start">Start</Label>
                <Input
                  className="h-11"
                  id="g-start"
                  inputMode="decimal"
                  onChange={(e) => {
                    setStartValue(e.target.value);
                    clearStalePaceChip();
                  }}
                  placeholder={metric === "bodyfat" ? "26" : "200"}
                  value={startValue}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="g-targetval">Target</Label>
                <Input
                  className="h-11"
                  id="g-targetval"
                  inputMode="decimal"
                  onChange={(e) => {
                    setTargetValue(e.target.value);
                    clearStalePaceChip();
                  }}
                  placeholder={metric === "bodyfat" ? "15" : "180"}
                  value={targetValue}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="g-unit">Unit</Label>
                {metric === "weight" ? (
                  <Select
                    onValueChange={(v) => {
                      setUnit(v);
                      clearStalePaceChip();
                    }}
                    value={unit || defaultUnit}
                  >
                    <SelectTrigger className="h-11 w-full" id="g-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="lb">lb</SelectItem>
                      <SelectItem value="kg">kg</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="h-11"
                    id="g-unit"
                    maxLength={20}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder={metric === "bodyfat" ? "%" : "in"}
                    value={unit}
                  />
                )}
              </div>
            </div>
            {metric === "weight" && currentWeight != null && (
              <button
                className="self-start rounded-md border border-border px-2.5 py-1.5 text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => {
                  setStartValue(String(currentWeight.value));
                  setUnit(currentWeight.unit);
                }}
                type="button"
              >
                Use my current weight: {currentWeight.value} {currentWeight.unit}
              </button>
            )}
          </div>
        )}
      </section>

      {/* 3 · Goal date */}
      <section className="flex flex-col gap-3">
        <SectionHeading
          icon={<CalendarClock className="size-4" />}
          title="When do you want it done? (optional)"
          subtitle="Your date sets the pace of the whole plan: training days, diet strictness, and your Future You forecast all follow it."
        />
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="g-target">Goal date</Label>
            <Input
              className="h-11 max-w-xs"
              id="g-target"
              min={todayInputValue()}
              onChange={(e) => {
                const picked = parseTargetDate(e.target.value);
                setTargetDate(picked ? formatTargetDate(picked) : "");
                setSelectedChip(null);
              }}
              type="date"
              value={toDateInputValue(targetDate)}
            />
            {targetDate.trim() !== "" && !parseTargetDate(targetDate) && (
              <p className="text-muted-foreground text-xs">
                Currently saved as "{targetDate}". Pick a calendar date to turn
                on the pace check.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="text-muted-foreground text-xs">Quick dates:</p>
            <div className="flex flex-wrap gap-1.5">
              {DEADLINE_CHIPS.map((chip) => (
                <button
                  aria-pressed={selectedChip === `date:${chip.label}`}
                  className={cn(
                    "h-11 rounded-full border px-4 text-xs transition-colors",
                    selectedChip === `date:${chip.label}`
                      ? "border-blood/40 bg-blood/10 font-medium text-blood"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                  key={chip.label}
                  onClick={() => {
                    setTargetDate(
                      formatTargetDate(dateWeeksFromNow(chip.weeks))
                    );
                    setSelectedChip(`date:${chip.label}`);
                  }}
                  type="button"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
          {weightPace && (
            <div className="flex flex-col gap-1.5">
              <p className="text-muted-foreground text-xs">
                Or pick your pace and the date fills itself:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PACE_CHIPS[paceUnit].map((rate) => (
                  <button
                    aria-pressed={selectedChip === `pace:${rate}`}
                    className={cn(
                      "h-11 rounded-full border px-4 text-xs transition-colors",
                      selectedChip === `pace:${rate}`
                        ? "border-blood/40 bg-blood/10 font-medium text-blood"
                        : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                    key={rate}
                    onClick={() => {
                      setTargetDate(
                        formatTargetDate(
                          dateWeeksFromNow(weightPace.totalChange / rate)
                        )
                      );
                      setSelectedChip(`pace:${rate}`);
                    }}
                    type="button"
                  >
                    {weightPace.direction === "lose" ? "Lose" : "Gain"} {rate}{" "}
                    {paceUnit} a week
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 4 · The live pace check */}
      {feasibility?.kind === "weight" && feasibility.data && (
        <WeightPaceCheck
          data={feasibility.data}
          unit={unit || defaultUnit}
        />
      )}
      {feasibility?.kind === "lift" && feasibility.data && (
        <LiftPaceCheck data={feasibility.data} unit={unit || "lb"} />
      )}

      {/* 5 · Status (edit only) */}
      {isEdit && (
        <section className="flex flex-col gap-3">
          <SectionHeading
            icon={<Activity className="size-4" />}
            title="Status"
          />
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["active", "Active", "You're working on it."],
                ["achieved", "Achieved", "You did it."],
                ["archived", "Archived", "Shelved, not deleted."],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                className={cn(
                  "flex min-h-11 flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  status === value
                    ? "border-blood/40 bg-blood/10"
                    : "border-border hover:bg-accent"
                )}
                key={value}
                onClick={() => setStatus(value)}
                type="button"
              >
                <span
                  className={cn(
                    "font-medium text-sm",
                    status === value ? "text-blood" : "text-foreground"
                  )}
                >
                  {label}
                </span>
                <span className="text-muted-foreground text-xs">{hint}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-border border-t pt-5">
        <div>
          {isEdit &&
            (confirmingDelete ? (
              <div className="flex items-center gap-1.5">
                <Button
                  disabled={pending}
                  onClick={destroy}
                  size="sm"
                  type="button"
                  variant="destructive"
                >
                  {pending ? "Deleting…" : "Really delete"}
                </Button>
                <Button
                  disabled={pending}
                  onClick={() => setConfirmingDelete(false)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Keep it
                </Button>
              </div>
            ) : (
              <Button
                className="gap-1.5 text-muted-foreground"
                onClick={() => setConfirmingDelete(true)}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Trash2 className="size-3.5" />
                Delete goal
              </Button>
            ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="h-11"
            disabled={pending}
            onClick={() => router.push("/goals")}
            type="button"
            variant="ghost"
          >
            Cancel
          </Button>
          <Button className="h-11 min-w-32" disabled={pending} type="submit">
            {pending ? "Saving…" : isEdit ? "Save changes" : "Save goal"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function SectionHeading({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <h2 className="flex items-center gap-2 font-medium text-muted-foreground text-sm uppercase tracking-wide">
        <span className="text-blood">{icon}</span>
        {title}
      </h2>
      {subtitle && (
        <p className="mt-1 text-muted-foreground text-xs">{subtitle}</p>
      )}
    </div>
  );
}

const BAND_STYLES: Record<RateBand, string> = {
  safe: "border-emerald-500/30 bg-emerald-500/5",
  aggressive: "border-amber-500/30 bg-amber-500/5",
  extreme: "border-blood/30 bg-blood/5",
};

function WeightPaceCheck({
  data,
  unit,
}: {
  data: NonNullable<ReturnType<typeof weightFeasibility>>;
  unit: string;
}) {
  const verb = data.direction === "lose" ? "Lose" : "Gain";
  let message: string;
  if (data.band === "safe") {
    message = `A sustainable pace. Lock it in: at ${data.ratePerWeek} ${unit}/week this is very doable.`;
  } else if (data.band === "aggressive") {
    message = `An aggressive pace. Doable, but expect hard weeks. Most coaches would give this a little more time.`;
  } else if (data.band === "extreme") {
    message =
      data.direction === "lose"
        ? `At that pace you'd be losing muscle, not just fat. At a sustainable ${data.sustainableRate} ${unit}/week you'd land around ${formatTargetDate(data.sustainableDate)}. Consider moving the date.`
        : `Gaining that fast is mostly fat, not muscle. At a lean ${data.sustainableRate} ${unit}/week you'd land around ${formatTargetDate(data.sustainableDate)}. Consider moving the date.`;
  } else {
    message = `At a sustainable ${data.sustainableRate} ${unit}/week you'd land around ${formatTargetDate(data.sustainableDate)}. Pick a goal date above and this becomes a pace check.`;
  }

  return (
    <section
      className={cn(
        "rounded-xl border p-4",
        data.band ? BAND_STYLES[data.band] : "border-border bg-card"
      )}
    >
      <h3 className="font-medium text-sm">
        {verb} {data.totalChange} {unit}
        {data.ratePerWeek != null && data.weeks != null
          ? ` in ${data.weeks} weeks: that's ${data.ratePerWeek} ${unit}/week`
          : ""}
      </h3>
      <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
        {message}
      </p>
    </section>
  );
}

function LiftPaceCheck({
  data,
  unit,
}: {
  data: NonNullable<ReturnType<typeof liftFeasibility>>;
  unit: string;
}) {
  let message: string;
  if (data.band === "safe") {
    message = "Steady, earnable strength progress. A realistic target.";
  } else if (data.band === "aggressive") {
    message =
      "A beginner-gains pace. Possible if you're new to this lift and eating for it; ambitious otherwise.";
  } else if (data.band === "extreme") {
    message =
      "Strength doesn't move that fast. Give the date more room or pick a nearer target, then earn the rest.";
  } else {
    message =
      "Pick a goal date above and this becomes a pace check against how fast strength actually builds.";
  }
  return (
    <section
      className={cn(
        "rounded-xl border p-4",
        data.band ? BAND_STYLES[data.band] : "border-border bg-card"
      )}
    >
      <h3 className="font-medium text-sm">
        +{data.gain} {unit} on your est. 1RM
        {data.ratePerWeek != null && data.weeks != null
          ? ` in ${data.weeks} weeks: about ${data.ratePerWeek} ${unit}/week`
          : ""}
      </h3>
      <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
        {message}
      </p>
    </section>
  );
}
