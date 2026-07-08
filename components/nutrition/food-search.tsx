"use client";

/**
 * The Calorie Tracker's Search AND Barcode tabs (FN-1, NUT-24): text search
 * over verified food databases (curated table + USDA generic/branded), and a
 * camera barcode scanner (USDA Branded + Open Food Facts) as its own
 * top-level tab - the MacroFactor/MFP core logging path. Pick a result, set
 * the portion (grams / oz / servings), see the exact macros live, and it
 * lands in the diary under the meal + date chosen above. All arithmetic is
 * code (lib/nutrition/food-hit.ts), never a model estimate.
 */

import {
  BadgeCheck,
  Loader2,
  Plus,
  ScanBarcode,
  Search,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  logMealManually,
  lookupFoodBarcode,
  searchFoods,
} from "@/app/nutrition/actions";
import { useReward } from "@/components/dashboard/reward";
import { BarcodeScannerDialog } from "@/components/nutrition/barcode-scanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCalendarDay, parseCalendarDay, todayLocalISO } from "@/lib/date";
import type { FoodHit, PortionUnit } from "@/lib/nutrition/food-hit";
import { portionLabel, portionMacros } from "@/lib/nutrition/food-hit";
import { cn } from "@/lib/utils";
import type { MealCategory } from "@/lib/validation/nutrition";

const SEARCH_DEBOUNCE_MS = 350;
const MIN_QUERY_CHARS = 2;

/** "165 cal · 31g P · 0g C · 3.6g F" for a macro set. */
function macroLine(m: {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}): string {
  return `${Math.round(m.calories).toLocaleString()} cal · ${m.protein}g P · ${m.carbs}g C · ${m.fat}g F`;
}

function sourceBadge(hit: FoodHit): string {
  if (hit.source === "off") {
    return "Open Food Facts";
  }
  return hit.source === "table" ? "Verified" : "USDA";
}

/** Portion defaults: packaged food starts at 1 serving, whole food at 100 g. */
function defaultPortion(hit: FoodHit): { amount: string; unit: PortionUnit } {
  if (hit.serving) {
    return { amount: "1", unit: "serving" };
  }
  return { amount: "100", unit: "g" };
}

export function FoodSearch({
  meal,
  mealLabel,
  date,
  variant = "search",
}: {
  meal: MealCategory;
  /** Custom slot name when meal = "other" (already trimmed, or null). */
  mealLabel: string | null;
  date: string;
  /** "search" = text search over the databases; "barcode" = the Barcode tab
   *  (camera scanner front and center, no text input). */
  variant?: "search" | "barcode";
}) {
  const router = useRouter();
  const reward = useReward();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState("100");
  const [unit, setUnit] = useState<PortionUnit>("g");
  // The Barcode tab opens the camera immediately (the tap on the tab IS the
  // "scan something" intent, same as MyFitnessPal / MacroFactor).
  const [scanOpen, setScanOpen] = useState(variant === "barcode");
  const [scanning, setScanning] = useState(false);
  // A scanned barcode product is pinned above the text results until
  // dismissed or replaced by the next scan.
  const [scanned, setScanned] = useState<FoodHit | null>(null);
  const seqRef = useRef(0);

  // Debounced as-you-type search; stale responses are dropped by sequence.
  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_CHARS) {
      setResults([]);
      setSearching(false);
      setSearched(false);
      return;
    }
    setSearching(true);
    const seq = ++seqRef.current;
    const timer = setTimeout(async () => {
      const res = await searchFoods(q);
      if (seq !== seqRef.current) {
        return;
      }
      setSearching(false);
      setSearched(true);
      if (res.ok) {
        setResults(res.results ?? []);
      } else {
        setResults([]);
        toast.error(res.error ?? "Search failed. Try again.");
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  function select(hit: FoodHit) {
    if (selectedId === hit.id) {
      setSelectedId(null);
      return;
    }
    const d = defaultPortion(hit);
    setSelectedId(hit.id);
    setAmount(d.amount);
    setUnit(d.unit);
  }

  async function onScanned(code: string) {
    setScanning(true);
    const res = await lookupFoodBarcode(code);
    setScanning(false);
    if (!res.ok) {
      toast.error(res.error ?? "Couldn't look that barcode up.");
      return;
    }
    if (!res.result) {
      toast.error(
        "That barcode isn't in the food databases yet. Photograph the nutrition facts panel with the Label Photo tab instead and Chad reads it straight off the package."
      );
      return;
    }
    const hit = res.result;
    // Pin the scanned product above the results, pre-selected at 1 serving.
    setScanned(hit);
    const d = defaultPortion(hit);
    setSelectedId(hit.id);
    setAmount(d.amount);
    setUnit(d.unit);
  }

  function logSelected(hit: FoodHit) {
    const amountNum = Number.parseFloat(amount);
    const macros = portionMacros(hit, amountNum, unit);
    if (!macros) {
      toast.error("Enter how much you had.");
      return;
    }
    // Brand-prefix the diary title, unless the product name already carries
    // the brand ("Fairlife Core Power" must not become "Fairlife Fairlife…").
    const baseName =
      hit.brand && !hit.name.toLowerCase().includes(hit.brand.toLowerCase())
        ? `${hit.brand} ${hit.name}`
        : hit.name;
    const portion = portionLabel(amountNum, unit);
    const title = `${baseName} (${portion})`.slice(0, 120);
    startTransition(async () => {
      const result = await logMealManually({
        title,
        meal,
        mealLabel,
        recordedAt: date,
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        note: null,
      });
      if (result.ok) {
        // Spell out the day when it isn't today, so a back-dated log is
        // visibly confirmed (BT1-3).
        const day = date === todayLocalISO() ? null : parseCalendarDay(date);
        reward.celebrate(
          day
            ? `Logged ${baseName} for ${formatCalendarDay(day, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}.`
            : `Logged ${baseName}.`
        );
        setSelectedId(null);
        router.refresh();
      } else {
        toast.error(result.error ?? "Couldn't log that.");
      }
    });
  }

  const trimmed = query.trim();

  return (
    <div className="flex flex-col gap-3">
      {variant === "barcode" ? (
        /* Barcode tab: the scanner IS the interface. */
        <Button
          className="gap-2"
          disabled={scanning}
          onClick={() => setScanOpen(true)}
          size="lg"
          type="button"
        >
          {scanning ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ScanBarcode className="size-4" />
          )}
          {scanning ? "Looking the product up…" : "Scan a barcode"}
        </Button>
      ) : (
        /* Search input */
        <div className="relative">
          <Search className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
          <Input
            aria-label="Search foods"
            className="pr-9 pl-9"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // The tab lives inside the log-a-meal form; Enter here must
              // never fire the outer submit.
              if (e.key === "Enter") {
                e.preventDefault();
              }
            }}
            placeholder="Search foods, e.g. chicken breast"
            value={query}
          />
          {query && (
            <button
              aria-label="Clear search"
              className="absolute inset-y-0 right-2 my-auto flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              onClick={() => {
                setQuery("");
                setResults([]);
                setSelectedId(null);
                setSearched(false);
              }}
              type="button"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Scanned product - pinned above the text results until dismissed */}
      {scanned && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
              <ScanBarcode className="size-3.5" />
              Scanned product
            </span>
            <button
              aria-label="Dismiss scanned product"
              className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              onClick={() => {
                if (selectedId === scanned.id) {
                  setSelectedId(null);
                }
                setScanned(null);
              }}
              type="button"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <ResultRow
            amount={amount}
            hit={scanned}
            logging={pending}
            onAmount={setAmount}
            onLog={() => logSelected(scanned)}
            onSelect={() => select(scanned)}
            onUnit={setUnit}
            open={selectedId === scanned.id}
            unit={unit}
          />
          <p className="text-muted-foreground text-xs">
            {scanned.source === "off"
              ? "Numbers from Open Food Facts, a public product database. If they don't match the package, photograph the label with the Label Photo tab and Chad reads the printed numbers instead."
              : "Numbers from the USDA's official product database, exactly as printed on the label."}
          </p>
        </div>
      )}

      {/* Results / states */}
      {searching ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border border-dashed bg-background/40 px-4 py-8 text-muted-foreground text-sm">
          <Loader2 className="size-4 animate-spin" />
          Searching the food databases…
        </div>
      ) : results.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs">
            Tap a food to set the portion. Numbers come straight from the named
            database (USDA is official US label data; Open Food Facts is a
            public product database), never from estimates.
          </p>
          {results
            .filter((hit) => hit.id !== scanned?.id)
            .map((hit) => (
              <ResultRow
                amount={amount}
                hit={hit}
                key={hit.id}
                logging={pending}
                onAmount={setAmount}
                onLog={() => logSelected(hit)}
                onSelect={() => select(hit)}
                onUnit={setUnit}
                open={selectedId === hit.id}
                unit={unit}
              />
            ))}
        </div>
      ) : trimmed.length >= MIN_QUERY_CHARS && searched ? (
        <p className="rounded-xl border border-border border-dashed bg-background/40 px-4 py-8 text-center text-muted-foreground text-sm">
          No match for "{trimmed}". Try fewer or simpler words ("chicken
          breast", not "my grilled chicken"), scan its barcode with the Barcode
          tab, or log it with the Food Photo, Label Photo, or Manual tab.
        </p>
      ) : scanned ? null : (
        <p className="rounded-xl border border-border border-dashed bg-background/40 px-4 py-8 text-center text-muted-foreground text-sm">
          {variant === "barcode"
            ? "Point your camera at the barcode on any packaged food. The product's verified label numbers come up; set how much you ate and it lands in your diary."
            : 'Search verified foods by name, like "chicken breast" or "greek yogurt". Set the portion and the exact macros land in your diary.'}
        </p>
      )}

      <BarcodeScannerDialog
        onDetected={onScanned}
        onOpenChange={setScanOpen}
        open={scanOpen}
      />
    </div>
  );
}

/** One tappable food row; expands into the portion editor when selected. */
function ResultRow({
  hit,
  open,
  amount,
  unit,
  logging,
  onSelect,
  onAmount,
  onUnit,
  onLog,
}: {
  hit: FoodHit;
  open: boolean;
  amount: string;
  unit: PortionUnit;
  logging: boolean;
  onSelect: () => void;
  onAmount: (v: string) => void;
  onUnit: (u: PortionUnit) => void;
  onLog: () => void;
}) {
  // Lead with the label's own per-serving numbers when the product has a
  // serving ("Per 1 bar (60 g): 190 cal…"); per-100g is the fallback for
  // whole foods. Always say what the numbers are per: a bare
  // "300 cal · 33.3g P /100g" read as gibberish (user report).
  const sub = hit.serving
    ? `Per ${hit.serving.label}: ${macroLine(hit.serving.macros)}`
    : hit.per100g
      ? `Per 100 g: ${macroLine(hit.per100g)}`
      : "";
  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        open
          ? "border-blood/50 bg-card"
          : "border-border bg-background/40 hover:bg-accent/40"
      )}
    >
      {/* Nothing in this row truncates: the name and macro line wrap instead,
          so the full food data is always readable on a phone (user report:
          picking a food you couldn't see the numbers for). */}
      <button
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
        onClick={onSelect}
        type="button"
      >
        <div className="min-w-0 flex-1">
          <div className="font-medium text-sm leading-snug">{hit.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-muted-foreground text-xs">
            {hit.brand && <span>{hit.brand}</span>}
            {sub && <span className="tabular-nums">{sub}</span>}
            <span className="flex items-center gap-1">
              {hit.source !== "off" && (
                <BadgeCheck className="size-3.5 text-emerald-500" />
              )}
              {sourceBadge(hit)}
            </span>
          </div>
        </div>
        <Plus
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-45"
          )}
        />
      </button>

      {open && (
        <PortionEditor
          amount={amount}
          hit={hit}
          logging={logging}
          onAmount={onAmount}
          onLog={onLog}
          onUnit={onUnit}
          unit={unit}
        />
      )}
    </div>
  );
}

/** Portion picker: amount + unit (g / oz / servings) + live exact macros. */
function PortionEditor({
  hit,
  amount,
  unit,
  logging,
  onAmount,
  onUnit,
  onLog,
}: {
  hit: FoodHit;
  amount: string;
  unit: PortionUnit;
  logging: boolean;
  onAmount: (v: string) => void;
  onUnit: (u: PortionUnit) => void;
  onLog: () => void;
}) {
  const amountNum = Number.parseFloat(amount);
  const macros = portionMacros(hit, amountNum, unit);

  const units: { value: PortionUnit; label: string; enabled: boolean }[] = [
    { value: "g", label: "g", enabled: hit.per100g != null },
    { value: "oz", label: "oz", enabled: hit.per100g != null },
    {
      value: "serving",
      label: hit.serving ? "servings" : "servings (n/a)",
      enabled: hit.serving != null,
    },
  ];

  return (
    <div className="flex flex-col gap-3 border-border border-t px-3 py-3">
      {hit.serving && (
        <p className="text-muted-foreground text-xs">
          1 serving = {hit.serving.label}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Amount"
          autoFocus
          className="w-24"
          inputMode="decimal"
          min="0"
          onChange={(e) => onAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onLog();
            }
          }}
          step="any"
          type="number"
          value={amount}
        />
        <div className="flex overflow-hidden rounded-lg border border-border">
          {units
            .filter((u) => u.enabled)
            .map((u) => (
              <button
                className={cn(
                  "px-3 py-1.5 font-medium text-xs transition-colors",
                  unit === u.value
                    ? "bg-blood/10 text-foreground"
                    : "bg-background/40 text-muted-foreground hover:bg-accent/50"
                )}
                key={u.value}
                onClick={() => onUnit(u.value)}
                type="button"
              >
                {u.label}
              </button>
            ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm tabular-nums">
          {macros ? (
            macroLine(macros)
          ) : (
            <span className="text-muted-foreground">
              Enter an amount to see the macros.
            </span>
          )}
        </span>
        <Button
          className="gap-2"
          disabled={logging || !macros}
          onClick={onLog}
          size="sm"
          type="button"
        >
          {logging && <Loader2 className="size-4 animate-spin" />}
          {logging ? "Logging…" : "Add to diary"}
        </Button>
      </div>
    </div>
  );
}
