"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addBodyMeasurement,
  removeBodyMeasurement,
} from "@/app/progress/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
      <h2 className="mb-1 font-medium text-lg">Body measurements</h2>
      <p className="mb-4 text-muted-foreground text-sm">
        The scale lies on a cut or a bulk — the tape doesn't. Track where it
        actually changes.
      </p>

      <form className="flex flex-wrap items-end gap-3" onSubmit={onSubmit}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="m-kind">Spot</Label>
          <select
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            id="m-kind"
            onChange={(e) =>
              setKind(e.target.value as (typeof MEASUREMENT_KINDS)[number])
            }
            value={kind}
          >
            {MEASUREMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
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
            <select
              aria-label="Unit"
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              onChange={(e) => setUnit(e.target.value as "in" | "cm")}
              value={unit}
            >
              <option value="in">in</option>
              <option value="cm">cm</option>
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="m-date">Date</Label>
          <Input
            className="w-40"
            id="m-date"
            max={todayISO()}
            onChange={(e) => setDate(e.target.value)}
            type="date"
            value={date}
          />
        </div>
        <Button disabled={pending} type="submit">
          {pending ? "Saving…" : "Log"}
        </Button>
      </form>

      {byKind.size > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[...byKind.entries()].map(([k, list]) => {
            const latest = list.at(-1);
            const firstVal = list[0]?.value;
            const change =
              latest && firstVal != null
                ? Math.round((latest.value - firstVal) * 10) / 10
                : null;
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
                        className={`ml-2 text-xs ${
                          change < 0 ? "text-emerald-500" : "text-muted-foreground"
                        }`}
                      >
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
      )}
    </section>
  );
}
