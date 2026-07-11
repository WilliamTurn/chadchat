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
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useMemo,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { removeGoal, saveGoalRecord, updateGoalRecord } from "@/app/today/actions";
import { KpiHelp } from "@/components/dashboard/kpi";
import type { EditableGoal } from "@/components/goals/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
const LB_PER_KG = 2.204_62;

/** Metrics with no automatic data source: the member updates the number by
 *  hand (on this form or the goal's page). Weight reads from weigh-ins and
 *  lift from logged sets, so they never need a manual "now" value. */
const MANUAL_METRICS = new Set(["bodyfat", "measurement", "custom"]);

type MetricChoice = {
  value: string;
  label: string;
  description: string;
  icon: React.ReactNode;
};

// Ordered by how often people pick them; "No number" last, so the measurable
// options lead but the escape hatch is always visible.
const METRIC_CHOICES: MetricChoice[] = [
  {
    value: "weight",
    label: "Body weight",
    description:
      "Reach a target body weight. Progress updates automatically from your weigh-ins.",
    icon: <Scale className="size-4" />,
  },
  {
    value: "lift",
    label: "Strength (1-rep max)",
    description:
      "Bring a lift like the squat or bench press up to a target max. Progress updates automatically from your logged workouts.",
    icon: <Dumbbell className="size-4" />,
  },
  {
    value: "bodyfat",
    label: "Body fat %",
    description:
      "Reach a target body fat percentage. You update it whenever you get a new reading.",
    icon: <Percent className="size-4" />,
  },
  {
    value: "measurement",
    label: "Body measurement",
    description:
      "Waist, arms, chest, or any other measurement you take with a tape. You update it whenever you measure.",
    icon: <Ruler className="size-4" />,
  },
  {
    value: "custom",
    label: "Custom number",
    description:
      "Any other number you want to change, like push-ups in one set or miles run. You update it yourself.",
    icon: <Activity className="size-4" />,
  },
  {
    value: NONE,
    label: "No number",
    description:
      "For goals that can't be measured with a number, like a sharper jawline. Chad still sees this goal and holds you to it.",
    icon: <Sparkles className="size-4" />,
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

function round1(n: number): number {
  return Math.round(n * 10) / 10;
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
 * The dedicated goal create/edit page body (MOB-19, rebuilt s177 to the
 * pro-app bar): a centered column of clearly-titled section cards, plain
 * self-explanatory labels with "?" explainers, per-metric unit controls that
 * can't produce nonsense (body fat is always %, weight and lifts are lb/kg
 * pickers), inline validation, and the live feasibility coaching: required
 * pace vs a sustainable pace, a realistic landing date, and your actual lift
 * baseline.
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
  /** The member's current trend weight, for the start-value prefill. */
  currentWeight: { value: number; unit: "lb" | "kg" } | null;
  /** Current best est. 1RM (lb) per logged exercise, lowercased name. */
  liftE1rm: Record<string, number>;
  defaultUnit: "lb" | "kg";
}) {
  const router = useRouter();
  const isEdit = mode === "edit";
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState(goal?.title ?? "");
  const [detail, setDetail] = useState(goal?.detail ?? "");
  const [targetDate, setTargetDate] = useState(goal?.targetDate ?? "");
  // Which quick-date/pace chip filled the current date, so the picked chip
  // stays visibly selected (cleared when the member edits the date directly).
  const [selectedChip, setSelectedChip] = useState<string | null>(null);
  const [status, setStatus] = useState<EditableGoal["status"]>(
    goal?.status ?? "active"
  );
  // Create starts with nothing selected (choosing is an explicit act; saving
  // without a choice means "no number"). Edit shows the goal's saved state.
  const [metric, setMetric] = useState<string>(
    goal?.metric ?? (isEdit ? NONE : "")
  );
  const [metricRef, setMetricRef] = useState(goal?.metricRef ?? "");
  const [startValue, setStartValue] = useState(
    goal?.startValue != null ? String(goal.startValue) : ""
  );
  const [currentValue, setCurrentValue] = useState(
    goal?.currentValue != null ? String(goal.currentValue) : ""
  );
  const [targetValue, setTargetValue] = useState(
    goal?.targetValue != null ? String(goal.targetValue) : ""
  );
  const [unit, setUnit] = useState(goal?.unit ?? "");
  // Inline validation messages, keyed by field. Set on submit, cleared per
  // field as the member fixes it.
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isLift = metric === "lift";
  const hasMetric = metric !== NONE && metric !== "";
  const isManual = MANUAL_METRICS.has(metric);
  // Which metrics carry a "what exactly?" reference field.
  const needsRef = isLift || metric === "measurement" || metric === "custom";

  function clearError(key: string) {
    setErrors((prev) => {
      if (!(key in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

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
    if (value === metric) {
      return;
    }
    setMetric(value);
    setErrors({});
    // Numbers never survive a metric switch: 200 (lb) is not 200 (%). But
    // switching back to the metric this goal was saved with restores its
    // saved numbers, so an accidental tap loses nothing.
    if (goal && value === goal.metric) {
      setMetricRef(goal.metricRef ?? "");
      setStartValue(goal.startValue != null ? String(goal.startValue) : "");
      setCurrentValue(
        goal.currentValue != null ? String(goal.currentValue) : ""
      );
      setTargetValue(goal.targetValue != null ? String(goal.targetValue) : "");
      setUnit(goal.unit ?? "");
      return;
    }
    setStartValue("");
    setCurrentValue("");
    setTargetValue("");
    // Sensible defaults per metric so members only type the numbers.
    if (value === "lift") {
      setUnit("lb");
    } else if (value === "weight") {
      // Prefill from the latest trend weight (the MyFitnessPal pattern):
      // members shouldn't have to remember a number the app already knows.
      if (currentWeight != null) {
        setStartValue(String(currentWeight.value));
        setUnit(currentWeight.unit);
      } else {
        setUnit(defaultUnit);
      }
    } else if (value === "bodyfat") {
      setUnit("%");
    } else if (value === "measurement") {
      setUnit(defaultUnit === "kg" ? "cm" : "in");
    } else {
      setUnit("");
    }
  }

  // The member's current best est. 1RM (lb) for the typed lift, if logged.
  const liftBaselineLb = isLift
    ? (liftE1rm[metricRef.trim().toLowerCase()] ?? null)
    : null;
  const liftUnit: "lb" | "kg" = unit.trim().toLowerCase().startsWith("k")
    ? "kg"
    : "lb";
  const liftBaselineDisplay =
    liftBaselineLb == null
      ? null
      : Math.round(liftUnit === "kg" ? liftBaselineLb / LB_PER_KG : liftBaselineLb);

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
      if (target != null && liftBaselineLb != null) {
        // Feasibility math runs in lb (the unit the e1RM baselines are stored
        // in); a kg target converts in, and the result converts back out.
        const targetLb = liftUnit === "kg" ? target * LB_PER_KG : target;
        const raw = liftFeasibility({
          currentE1rm: liftBaselineLb,
          target: targetLb,
          targetDate,
        });
        if (raw && liftUnit === "kg") {
          return {
            kind: "lift" as const,
            data: {
              ...raw,
              gain: round1(raw.gain / LB_PER_KG),
              ratePerWeek:
                raw.ratePerWeek == null
                  ? null
                  : round1(raw.ratePerWeek / LB_PER_KG),
            },
          };
        }
        return { kind: "lift" as const, data: raw };
      }
    }
    return null;
  }, [metric, isLift, startValue, targetValue, targetDate, liftBaselineLb, liftUnit]);

  // Narrowed weight-goal feasibility for the pace-first chips (TS can't carry
  // the discriminated-union narrowing into the chip onClick closures).
  const weightPace = feasibility?.kind === "weight" ? feasibility.data : null;

  function validate(): Record<string, string> {
    const found: Record<string, string> = {};
    if (!title.trim()) {
      found["g-title"] = "Enter your goal.";
    }
    if (isLift && !metricRef.trim()) {
      found["g-ref"] = "Enter the lift you want to track, like Back Squat.";
    }
    if (metric === "measurement" && !metricRef.trim()) {
      found["g-ref"] = "Enter what you're measuring, like Waist.";
    }
    if (metric === "custom" && !metricRef.trim()) {
      found["g-ref"] = "Enter what you're tracking, like Push-ups in one set.";
    }
    if (hasMetric) {
      const target = numOrNull(targetValue);
      if (!targetValue.trim()) {
        found["g-targetval"] = "Enter the number you want to reach.";
      } else if (target == null) {
        found["g-targetval"] = "Enter a number, like 180.";
      } else if (target <= 0) {
        found["g-targetval"] = "Enter a number above zero.";
      } else if (metric === "bodyfat" && (target < 1 || target > 75)) {
        found["g-targetval"] = "Body fat is a percentage between 1 and 75.";
      }
      if (!isLift) {
        const start = numOrNull(startValue);
        if (!startValue.trim()) {
          found["g-start"] = "Enter where you are today.";
        } else if (start == null) {
          found["g-start"] = "Enter a number, like 200.";
        } else if (start <= 0) {
          found["g-start"] = "Enter a number above zero.";
        } else if (metric === "bodyfat" && (start < 1 || start > 75)) {
          found["g-start"] = "Body fat is a percentage between 1 and 75.";
        }
      }
      if (isEdit && isManual && currentValue.trim()) {
        const now = numOrNull(currentValue);
        if (now == null) {
          found["g-current"] = "Enter a number.";
        } else if (now <= 0) {
          found["g-current"] = "Enter a number above zero.";
        } else if (metric === "bodyfat" && (now < 1 || now > 75)) {
          found["g-current"] = "Body fat is a percentage between 1 and 75.";
        }
      }
    }
    return found;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    const firstError = Object.keys(found)[0];
    if (firstError) {
      const el = document.getElementById(firstError);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }
    const start = hasMetric && !isLift ? numOrNull(startValue) : null;
    const payload = {
      title: title.trim(),
      detail: detail.trim(),
      targetDate: targetDate.trim() || null,
      status,
      metric: hasMetric ? (metric as EditableGoal["metric"]) : null,
      metricRef: needsRef ? metricRef.trim() || null : null,
      // A lift goal reads its start from the first logged e1RM, so Start is
      // hidden and left null.
      startValue: start,
      // Manual metrics carry the member-updated "now" value. On create it IS
      // the start; on edit an empty field falls back to the start too.
      currentValue:
        hasMetric && isManual
          ? (isEdit ? (numOrNull(currentValue) ?? start) : start)
          : null,
      targetValue: hasMetric ? numOrNull(targetValue) : null,
      unit: hasMetric ? (metric === "bodyfat" ? "%" : unit.trim() || null) : null,
    };
    startTransition(async () => {
      const result =
        isEdit && goal
          ? await updateGoalRecord({ id: goal.id, ...payload })
          : await saveGoalRecord(payload);
      if (result.ok) {
        toast.success(isEdit ? "Goal updated." : "Goal created.");
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
    <form className="flex flex-col gap-5" noValidate onSubmit={onSubmit}>
      {/* 1 · The goal in your own words */}
      <SectionCard
        icon={<Target className="size-4" />}
        subtitle="Say exactly what you want to achieve. Chad reads your goals in every chat and holds you to them."
        title="Define your goal"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="g-title">Your goal</Label>
          <Input
            aria-invalid={errors["g-title"] ? true : undefined}
            className="h-11"
            id="g-title"
            maxLength={120}
            onChange={(e) => {
              setTitle(e.target.value);
              clearError("g-title");
            }}
            placeholder="e.g. Lose 20 lb and see my abs"
            value={title}
          />
          <FieldError message={errors["g-title"]} />
          <p className="text-muted-foreground text-xs">
            One clear sentence works best. The full story goes below.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="g-detail">Details (recommended)</Label>
          <Textarea
            className="min-h-32"
            id="g-detail"
            maxLength={8000}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Why this goal matters to you, what success looks like, and anything else Chad should know."
            value={detail}
          />
          <p className="text-muted-foreground text-xs">
            Be as detailed as you want. The more you write, the better Chad can
            coach you: he reads every word.
          </p>
        </div>
      </SectionCard>

      {/* 2 · Pin a number to it */}
      <SectionCard
        icon={<Scale className="size-4" />}
        subtitle={
          <>
            A goal with a specific number attached can be measured, and
            measurable goals are far more likely to be reached: you can see
            exactly how close you are at every step, and it shows as a live
            progress bar on your dashboard. Some goals, like a sharper jawline
            or rounder glutes, can't be measured with a number. Chad still sees
            those and holds you to them: choose "No number" below.
          </>
        }
        title="Track it with a number (recommended)"
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {METRIC_CHOICES.map((c) => (
            <button
              aria-pressed={metric === c.value}
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
              <Label htmlFor="g-ref">Which lift?</Label>
              <Input
                aria-invalid={errors["g-ref"] ? true : undefined}
                autoComplete="off"
                className="h-11"
                id="g-ref"
                list="g-lift-options"
                onChange={(e) => {
                  setMetricRef(e.target.value);
                  clearError("g-ref");
                }}
                placeholder="e.g. Back Squat"
                value={metricRef}
              />
              <FieldError message={errors["g-ref"]} />
              {exerciseNames.length > 0 && (
                <datalist id="g-lift-options">
                  {exerciseNames.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              )}
              {liftBaselineDisplay != null ? (
                <p className="text-muted-foreground text-xs">
                  Your current best estimated 1-rep max for {metricRef.trim()}:{" "}
                  <span className="font-medium text-foreground">
                    {liftBaselineDisplay} {liftUnit}
                  </span>
                  . Progress starts from there.
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">
                  Chad calculates your best estimated 1-rep max for this lift
                  from your logged sets and charts it against the target.
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <NumberField
                error={errors["g-targetval"]}
                help="The 1-rep max you want to reach: the heaviest single rep you're aiming for."
                id="g-targetval"
                label="Goal 1-rep max"
                onChange={(v) => {
                  setTargetValue(v);
                  clearError("g-targetval");
                }}
                placeholder="e.g. 405"
                value={targetValue}
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="g-unit">Unit</Label>
                <Select onValueChange={setUnit} value={liftUnit}>
                  <SelectTrigger className="min-h-11 w-full" id="g-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lb">lb</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {metric === "weight" && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <NumberField
                error={errors["g-start"]}
                help={
                  isEdit
                    ? "The weight you started from when you set this goal. Progress is measured from here."
                    : "Your weight today. Progress is measured from here."
                }
                id="g-start"
                label={isEdit ? "Starting weight" : "Current weight"}
                onChange={(v) => {
                  setStartValue(v);
                  clearError("g-start");
                  clearStalePaceChip();
                }}
                placeholder="e.g. 200"
                value={startValue}
              />
              <NumberField
                error={errors["g-targetval"]}
                help="The weight you want to reach. This is the number you're aiming for."
                id="g-targetval"
                label="Goal weight"
                onChange={(v) => {
                  setTargetValue(v);
                  clearError("g-targetval");
                  clearStalePaceChip();
                }}
                placeholder="e.g. 180"
                value={targetValue}
              />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="g-unit">Unit</Label>
                <Select
                  onValueChange={(v) => {
                    setUnit(v);
                    clearStalePaceChip();
                  }}
                  value={unit || defaultUnit}
                >
                  <SelectTrigger className="min-h-11 w-full" id="g-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lb">lb</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {currentWeight != null && (
              <button
                className="self-start rounded-md border border-border px-2.5 py-1.5 text-muted-foreground text-xs transition-colors hover:bg-accent hover:text-foreground"
                onClick={() => {
                  setStartValue(String(currentWeight.value));
                  setUnit(currentWeight.unit);
                  clearError("g-start");
                }}
                type="button"
              >
                Use my current weight: {currentWeight.value} {currentWeight.unit}
              </button>
            )}
          </div>
        )}

        {metric === "bodyfat" && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4">
            <div
              className={cn(
                "grid grid-cols-1 gap-3",
                isEdit ? "sm:grid-cols-3" : "sm:grid-cols-2"
              )}
            >
              <NumberField
                error={errors["g-start"]}
                help={
                  isEdit
                    ? "The body fat percentage you started from when you set this goal."
                    : "Your body fat percentage today. Progress is measured from here."
                }
                id="g-start"
                label={isEdit ? "Start" : "Current body fat"}
                onChange={(v) => {
                  setStartValue(v);
                  clearError("g-start");
                }}
                placeholder="e.g. 26"
                suffix="%"
                value={startValue}
              />
              {isEdit && (
                <NumberField
                  error={errors["g-current"]}
                  help="Your body fat percentage right now. Update it whenever you get a new reading; your progress bar moves with it."
                  id="g-current"
                  label="Now"
                  onChange={(v) => {
                    setCurrentValue(v);
                    clearError("g-current");
                  }}
                  placeholder={`e.g. ${startValue || "24"}`}
                  suffix="%"
                  value={currentValue}
                />
              )}
              <NumberField
                error={errors["g-targetval"]}
                help="The body fat percentage you want to reach. This is the number you're aiming for."
                id="g-targetval"
                label={isEdit ? "Goal" : "Goal body fat"}
                onChange={(v) => {
                  setTargetValue(v);
                  clearError("g-targetval");
                }}
                placeholder="e.g. 15"
                suffix="%"
                value={targetValue}
              />
            </div>
            <p className="text-muted-foreground text-xs">
              Body fat is always a percentage. Get readings from a smart scale,
              calipers, or a scan, and use the same method each time so the
              trend is honest.
            </p>
          </div>
        )}

        {(metric === "measurement" || metric === "custom") && (
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/40 p-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="g-ref">
                {metric === "measurement"
                  ? "What are you measuring?"
                  : "What are you tracking?"}
              </Label>
              <Input
                aria-invalid={errors["g-ref"] ? true : undefined}
                autoComplete="off"
                className="h-11"
                id="g-ref"
                maxLength={80}
                onChange={(e) => {
                  setMetricRef(e.target.value);
                  clearError("g-ref");
                }}
                placeholder={
                  metric === "measurement" ? "e.g. Waist" : "e.g. Push-ups in one set"
                }
                value={metricRef}
              />
              <FieldError message={errors["g-ref"]} />
            </div>
            <div
              className={cn(
                "grid grid-cols-1 gap-3",
                isEdit ? "sm:grid-cols-4" : "sm:grid-cols-3"
              )}
            >
              <NumberField
                error={errors["g-start"]}
                help={
                  isEdit
                    ? "The number you started from when you set this goal. Progress is measured from here."
                    : "The number you're at today. Progress is measured from here."
                }
                id="g-start"
                label={
                  isEdit
                    ? "Start"
                    : metric === "measurement"
                      ? "Current measurement"
                      : "Current number"
                }
                onChange={(v) => {
                  setStartValue(v);
                  clearError("g-start");
                }}
                placeholder={metric === "measurement" ? "e.g. 38" : "e.g. 20"}
                value={startValue}
              />
              {isEdit && (
                <NumberField
                  error={errors["g-current"]}
                  help="The number right now. Update it as you make progress; your progress bar moves with it."
                  id="g-current"
                  label="Now"
                  onChange={(v) => {
                    setCurrentValue(v);
                    clearError("g-current");
                  }}
                  placeholder={startValue ? `e.g. ${startValue}` : undefined}
                  value={currentValue}
                />
              )}
              <NumberField
                error={errors["g-targetval"]}
                help="The number you want to reach. This is the number you're aiming for."
                id="g-targetval"
                label={
                  isEdit
                    ? "Goal"
                    : metric === "measurement"
                      ? "Goal measurement"
                      : "Goal number"
                }
                onChange={(v) => {
                  setTargetValue(v);
                  clearError("g-targetval");
                }}
                placeholder={metric === "measurement" ? "e.g. 34" : "e.g. 50"}
                value={targetValue}
              />
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1">
                  <Label htmlFor="g-unit">Unit</Label>
                  {metric === "custom" && (
                    <KpiHelp label="Unit">
                      The word after the number, like reps, miles, or minutes.
                      Leave it blank if there isn't one.
                    </KpiHelp>
                  )}
                </div>
                {metric === "measurement" ? (
                  <Select onValueChange={setUnit} value={unit || "in"}>
                    <SelectTrigger className="min-h-11 w-full" id="g-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">inches</SelectItem>
                      <SelectItem value="cm">cm</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    className="h-11"
                    id="g-unit"
                    maxLength={20}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="e.g. reps"
                    value={unit}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* 3 · Goal date */}
      <SectionCard
        icon={<CalendarClock className="size-4" />}
        subtitle={
          <>
            Your target date sets the pace of your whole plan: training days,
            diet strictness, and your{" "}
            <Link
              className="text-blood underline underline-offset-2 transition-colors hover:text-blood/80"
              href="/future-you"
            >
              Future You
            </Link>{" "}
            forecast all follow it. Without a date, Chad can't tell you whether
            you're on schedule.
          </>
        }
        title="Set a target date (recommended)"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="g-target">Target date</Label>
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
              This goal's date is saved as "{targetDate}", which isn't a
              calendar date. Pick one to turn on the pace check.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-muted-foreground text-xs">Or pick a time frame:</p>
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
                  setTargetDate(formatTargetDate(dateWeeksFromNow(chip.weeks)));
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
              Or pick a weekly pace and the target date is calculated for you:
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
      </SectionCard>

      {/* 4 · The live pace check: inline feedback on the numbers and date just
          entered, directly under the fields it reacts to (the MyFitnessPal /
          Lose It placement), at every screen width. */}
      {feasibility?.kind === "weight" && feasibility.data && (
        <WeightPaceCheck data={feasibility.data} unit={unit || defaultUnit} />
      )}
      {feasibility?.kind === "lift" && feasibility.data && (
        <LiftPaceCheck data={feasibility.data} unit={liftUnit} />
      )}

      {/* 5 · Status (edit only) */}
      {isEdit && (
        <SectionCard
          icon={<Activity className="size-4" />}
          title="Status"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {(
              [
                ["active", "Active", "You're working toward it now."],
                ["achieved", "Achieved", "You reached this goal."],
                [
                  "archived",
                  "Archived",
                  "Set aside for now. You can reopen it anytime.",
                ],
              ] as const
            ).map(([value, label, hint]) => (
              <button
                aria-pressed={status === value}
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
        </SectionCard>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-border border-t pt-5">
        <div>
          {isEdit && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="h-11 gap-1.5 text-muted-foreground"
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Trash2 className="size-3.5" />
                  Delete goal
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this goal?</AlertDialogTitle>
                  <AlertDialogDescription>
                    "{goal?.title}" and its progress will be permanently
                    deleted, and Chad will stop tracking it. If you just want
                    it out of the way, set its status to Archived instead: you
                    can reopen an archived goal anytime.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={pending}>
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={pending}
                    onClick={destroy}
                  >
                    {pending ? "Deleting…" : "Delete goal"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
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
            {pending ? "Saving…" : isEdit ? "Save changes" : "Create goal"}
          </Button>
        </div>
      </div>
    </form>
  );
}

/** One clearly-titled section of the form: icon chip, plain-language title,
 *  a real explanation, then the controls. */
function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="flex items-center gap-2.5 font-semibold text-base">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blood/10 text-blood">
            {icon}
          </span>
          {title}
        </h2>
        {subtitle && (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

/** A labeled numeric input with a "?" explainer, optional unit suffix, and an
 *  inline validation message. */
function NumberField({
  id,
  label,
  help,
  value,
  onChange,
  placeholder,
  suffix,
  error,
}: {
  id: string;
  label: string;
  help: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  suffix?: string;
  error?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <Label htmlFor={id}>{label}</Label>
        <KpiHelp label={label}>{help}</KpiHelp>
      </div>
      <div className="relative">
        <Input
          aria-invalid={error ? true : undefined}
          className={cn("h-11", suffix && "pr-8")}
          id={id}
          inputMode="decimal"
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          value={value}
        />
        {suffix && (
          <span className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-3 text-muted-foreground text-sm">
            {suffix}
          </span>
        )}
      </div>
      <FieldError message={error} />
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return <p className="text-destructive text-xs">{message}</p>;
}

const BAND_STYLES: Record<RateBand, string> = {
  safe: "border-emerald-500/30 bg-emerald-500/5",
  aggressive: "border-amber-500/30 bg-amber-500/5",
  extreme: "border-blood/30 bg-blood/5",
};

function PaceCheckCard({
  band,
  headline,
  children,
}: {
  band: RateBand | null;
  headline: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border p-4 sm:p-5",
        band ? BAND_STYLES[band] : "border-border bg-card"
      )}
    >
      <p className="mb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">
        Pace check
      </p>
      <h3 className="font-medium text-sm">{headline}</h3>
      <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
        {children}
      </p>
    </section>
  );
}

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
    message = `A sustainable pace. At ${data.ratePerWeek} ${unit} a week this is very doable.`;
  } else if (data.band === "aggressive") {
    message = `An aggressive pace. It can be done, but expect hard weeks. Most coaches would give this a little more time.`;
  } else if (data.band === "extreme") {
    message =
      data.direction === "lose"
        ? `At this pace you would lose muscle along with the fat. At a sustainable ${data.sustainableRate} ${unit} a week you would finish around ${formatTargetDate(data.sustainableDate)}. Consider moving your target date.`
        : `Gaining this fast adds mostly fat rather than muscle. At a lean ${data.sustainableRate} ${unit} a week you would finish around ${formatTargetDate(data.sustainableDate)}. Consider moving your target date.`;
  } else {
    message = `At a sustainable ${data.sustainableRate} ${unit} a week you would finish around ${formatTargetDate(data.sustainableDate)}. Set a target date above and this becomes a live pace check.`;
  }

  return (
    <PaceCheckCard
      band={data.band}
      headline={`${verb} ${data.totalChange} ${unit}${
        data.ratePerWeek != null && data.weeks != null
          ? ` in ${data.weeks} weeks: that's ${data.ratePerWeek} ${unit} a week`
          : ""
      }`}
    >
      {message}
    </PaceCheckCard>
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
      "A very fast pace. Possible if you're new to this lift and eating enough; ambitious otherwise.";
  } else if (data.band === "extreme") {
    message =
      "Strength builds slower than this. Give the date more room, or pick a nearer target first and earn the rest.";
  } else {
    message =
      "Set a target date above and this becomes a pace check against how fast strength actually builds.";
  }
  return (
    <PaceCheckCard
      band={data.band}
      headline={`+${data.gain} ${unit} on your est. 1RM${
        data.ratePerWeek != null && data.weeks != null
          ? ` in ${data.weeks} weeks: about ${data.ratePerWeek} ${unit} a week`
          : ""
      }`}
    >
      {message}
    </PaceCheckCard>
  );
}
