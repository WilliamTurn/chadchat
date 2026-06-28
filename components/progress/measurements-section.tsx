"use client";

import { ArrowDownRight, ArrowUpRight, Ruler, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addBodyMeasurement,
  removeBodyMeasurement,
} from "@/app/progress/actions";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { todayLocalISO } from "@/lib/date";
import { MEASUREMENT_KINDS } from "@/lib/validation/progress";

type Measurement = {
  id: string;
  recordedAt: string; // ISO yyyy-mm-dd
  kind: (typeof MEASUREMENT_KINDS)[number];
  value: number;
  unit: "in" | "cm";
};

const KIND_LABEL: Record<string, string> = {
  waist: "Waist",
  chest: "Chest",
  arms: "Arms",
  hips: "Hips",
  thighs: "Thighs",
  shoulders: "Shoulders",
  neck: "Neck",
};

/**
 * Which direction is "progress" per spot. For most people the waist/hips/neck
 * shrinking is the win (fat loss the scale hides), while arms/chest/shoulders
 * growing is the win (muscle). Used to color the change green vs neutral so the
 * number actually means something instead of always treating "down" as good.
 */
const GROW_IS_GOOD = new Set(["arms", "chest", "shoulders"]);

const todayISO = todayLocalISO;

/** A tiny inline sparkline for one metric's history. */
function Spark({ values }: { values: number[] }) {
  if (values.length < 2) {
    return null;
  }
  const W = 80;
  const H = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" L");
  return (
    <svg
      aria-hidden="true"
      className="text-blood"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      width={W}
    >
      <path
        d={`M${pts}`}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function MeasurementsSection({
  measurements,
}: {
  measurements: Measurement[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [date, setDate] = useState(todayISO);
  const [kind, setKind] =
    useState<(typeof MEASUREMENT_KINDS)[number]>("waist");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState<"in" | "cm">("in");

  // Group by kind, oldest→newest (input is already ascending by recordedAt).
  const byKind = new Map<string, Measurement[]>();
  for (const m of measurements) {
    const list = byKind.get(m.kind) ?? [];
    list.push(m);
    byKind.set(m.kind, list);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const num = Number(value);
    if (!value.trim() || Number.isNaN(num) || num <= 0) {
      toast.error("Enter a measurement.");
      return;
    }
    startTransition(async () => {
      const result = await addBodyMeasurement({
        recordedAt: date,
        kind,
        value: num,
        unit,
      });
      if (result.ok) {
        toast.success("Logged.");
        setValue("");
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't save that measurement.");
      }
    });
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const result = await removeBodyMeasurement(id);
      if (result.ok) {
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't delete that.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-medium text-lg">Body measurements</h2>
        <Ruler aria-hidden="true" className="size-4 text-muted-foreground/60" />
      </div>
      <p className="mb-4 text-muted-foreground text-sm">
        The scale lies on a cut or a bulk — the tape doesn't. A shrinking waist
        with a steady scale means you're losing fat and holding muscle. Track the
        spots that matter and watch them move.
      </p>

      <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="m-kind">Spot</Label>
          <Select
            onValueChange={(v) =>
              setKind(v as (typeof MEASUREMENT_KINDS)[number])
            }
            value={kind}
          >
            <SelectTrigger className="h-9 w-fit rounded-lg" id="m-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEASUREMENT_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {KIND_LABEL[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="m-value">Measurement</Label>
          <div className="flex gap-2">
            <Input
              className="w-24"
              id="m-value"
              inputMode="decimal"
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. 34"
              value={value}
            />
            <Select
              onValueChange={(v) => setUnit(v as "in" | "cm")}
              value={unit}
            >
              <SelectTrigger
                aria-label="Unit"
                className="h-9 shrink-0 rounded-lg"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in">in</SelectItem>
                <SelectItem value="cm">cm</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="m-date">Date</Label>
          <DatePicker
            className="w-40"
            id="m-date"
            max={todayISO()}
            onChange={setDate}
            value={date}
          />
        </div>
        <Button disabled={pending} type="submit">
          {pending ? "Saving…" : "Log"}
        </Button>
      </form>

      {byKind.size > 0 ? (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[...byKind.entries()].map(([k, list]) => {
            const latest = list.at(-1);
            const firstVal = list[0]?.value;
            const change =
              latest && firstVal != null
                ? Math.round((latest.value - firstVal) * 10) / 10
                : null;
            // Is this change in the good direction for this spot?
            const isProgress =
              change != null && change !== 0
                ? GROW_IS_GOOD.has(k)
                  ? change > 0
                  : change < 0
                : false;
            return (
              <div
                className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/40 px-4 py-3"
                key={k}
              >
                <div className="min-w-0">
                  <div className="text-muted-foreground text-xs">
                    {KIND_LABEL[k]}
                  </div>
                  <div className="font-display font-semibold text-lg">
                    {latest?.value}
                    <span className="ml-0.5 text-muted-foreground text-sm">
                      {latest?.unit}
                    </span>
                    {change != null && change !== 0 && (
                      <span
                        className={`ml-2 inline-flex items-center gap-0.5 text-xs ${
                          isProgress ? "text-emerald-500" : "text-muted-foreground"
                        }`}
                        title={`${change > 0 ? "+" : ""}${change} ${latest?.unit} since your first reading`}
                      >
                        {change < 0 ? (
                          <ArrowDownRight className="size-3" />
                        ) : (
                          <ArrowUpRight className="size-3" />
                        )}
                        {change > 0 ? "+" : ""}
                        {change}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Spark values={list.map((m) => m.value)} />
                  {latest && (
                    <Button
                      aria-label={`Delete latest ${KIND_LABEL[k]} reading`}
                      className="size-7 text-muted-foreground"
                      disabled={pending}
                      onClick={() => onDelete(latest.id)}
                      size="icon"
                      variant="ghost"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-border border-dashed bg-background/40 px-4 py-5 text-center text-muted-foreground text-sm">
          No measurements yet. Start with your{" "}
          <span className="font-medium text-foreground">waist</span> — it's the
          single best non-scale signal of fat loss. Log it weekly and the trend
          shows up here.
        </div>
      )}
    </section>
  );
}
