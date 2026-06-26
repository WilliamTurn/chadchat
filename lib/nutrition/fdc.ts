import "server-only";

/**
 * USDA FoodData Central (FDC) client — the FALLBACK macro source for structured
 * meal plans, plus the offline tool that builds the curated food table.
 *
 * The DEFAULT macro source is the curated table (lib/nutrition/food-table.ts):
 * an exact, offline lookup that covers the common case. This module is only hit
 * when Chad names a food the table doesn't have (an unusual/picky request), where
 * the candidate-scoring heuristics below earn their keep. It's also what
 * scripts/build-food-table.ts uses to fetch verified macros once, offline.
 * Nothing here is AI-estimated (see memory `chad-accuracy-fix-at-data-layer`).
 *
 * Set `USDA_FDC_API_KEY` in env (free: https://fdc.nal.usda.gov/api-key-signup.html).
 * With no key we fall back to the public `DEMO_KEY`, rate-limited hard. Because
 * the table now handles the common case, a missing key only degrades exotic-food
 * lookups — recommended for prod, but no longer load-bearing for most plans.
 */

import type { Macros } from "./macros";

export type { Macros } from "./macros";
export { scaleMacros, sumMacros } from "./macros";

const FDC_BASE = "https://api.nal.usda.gov/fdc/v1";

// Generic whole-food data types, preferred for cooking-style plans. Branded is
// deliberately omitted from the default search — its per-serving noise and
// duplicate entries hurt match quality for plain foods like "chicken breast".
const PREFERRED_DATA_TYPES = "Foundation,SR Legacy,Survey (FNDDS)";

// FDC carries two nutrient-numbering schemes: SR Legacy uses the legacy INFOODS
// tagnames (Protein 203, Fat 204, Carbs 205, Energy 208) while Foundation/Branded
// use the newer ids (1003/1004/1005/1008). Match either. Energy appears twice
// (kJ + kcal) — we take only the KCAL row.
const PROTEIN_NUMS = new Set(["203", "1003"]);
const FAT_NUMS = new Set(["204", "1004"]);
const CARB_NUMS = new Set(["205", "1005"]);
const ENERGY_NUMS = new Set(["208", "1008"]);

export type FdcMatch = {
  fdcId: number;
  description: string;
  /** Macros per 100 g, straight from FDC. */
  per100g: Macros;
};

type FdcNutrient = {
  nutrientNumber?: string | number;
  unitName?: string;
  value?: number;
};

type FdcFood = {
  fdcId: number;
  description: string;
  dataType?: string;
  foodNutrients?: FdcNutrient[];
};

// Description words that signal a processed/wrong variant of a plain whole food.
// When the query didn't ask for them, they sink a candidate so "chicken breast
// cooked" doesn't match "Chicken breast tenders, breaded, cooked, microwaved",
// or "egg whites" → "Egg, white, dried" (a 10x-concentrated powder).
const NOISE_TERMS = [
  "breaded",
  "battered",
  "fried",
  "canned",
  "candied",
  "infant",
  "baby food",
  "flavored",
  "dehydrated",
  "dried",
  "freeze-dried",
  "powder",
  "powdered",
  "glutinous",
  "imitation",
  "sauce",
  "soup",
  "creamed",
  "smoked",
];

// Words that don't change a food's identity — prep methods, descriptors, joins.
// They're allowed to sit in a description's head segment without penalty.
const STOPWORDS = new Set([
  "raw",
  "cooked",
  "dry",
  "dried",
  "fresh",
  "plain",
  "whole",
  "boiled",
  "steamed",
  "roasted",
  "baked",
  "grilled",
  "broiled",
  "stewed",
  "enriched",
  "unenriched",
  "prepared",
  "with",
  "without",
  "and",
  "or",
  "skin",
  "salt",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Token equality that tolerates only simple plurals — exact match, or the longer
 * token is the shorter + "s"/"es". So "potato"≈"potatoes", "white"≈"whites",
 * "egg"≈"eggs", but NOT "roll"≈"rolled" (which would wrongly match oats to a
 * bread roll) or "egg"≈"eggplant".
 */
function tokenMatch(a: string, b: string): boolean {
  if (a === b) {
    return true;
  }
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < 3) {
    return false;
  }
  return long === `${short}s` || long === `${short}es`;
}

/**
 * Score how well an FDC candidate matches the query. Higher is better. The key
 * signal is the description's HEAD (the part before the first comma) — FDC names
 * a food as "Head, qualifier, qualifier, prep", so the head is its true
 * identity. We reward query words landing in the head, but penalize EXTRA
 * identity words in the head that the query didn't ask for — that's what
 * separates "Potatoes, boiled" (good) from "Sweet potato, cooked", "Broccoli,
 * raw" from "Broccoli raab", "Spinach" from "Malabar spinach". Processed-variant
 * noise and oddly-specific long descriptions are penalized too.
 */
function scoreCandidate(query: string, food: FdcFood, index: number): number {
  const desc = food.description.toLowerCase();
  const headTokens = tokenize(desc.split(",")[0] ?? desc);
  const allTokens = tokenize(desc);
  const qTokens = tokenize(query);
  let score = 0;

  // Query-word coverage: a content word in the head is worth far more than one
  // buried in a later qualifier; a query word that's entirely absent is a red
  // flag that this is the wrong food.
  for (const t of qTokens) {
    if (STOPWORDS.has(t)) {
      continue;
    }
    if (headTokens.some((h) => tokenMatch(h, t))) {
      score += 4;
    } else if (allTokens.some((h) => tokenMatch(h, t))) {
      score += 1.5;
    } else {
      score -= 2;
    }
  }

  // Extra identity words in the head the query didn't ask for change the food.
  for (const h of headTokens) {
    if (!STOPWORDS.has(h) && !qTokens.some((t) => tokenMatch(h, t))) {
      score -= 3;
    }
  }

  for (const noise of NOISE_TERMS) {
    if (desc.includes(noise) && !query.toLowerCase().includes(noise)) {
      score -= 4;
    }
  }

  // Prefer plainer (shorter) descriptions.
  score -= desc.length * 0.015;

  // Data-type quality: Foundation/SR Legacy are clean whole-food references.
  if (food.dataType === "Foundation") {
    score += 2;
  } else if (food.dataType === "SR Legacy") {
    score += 1.5;
  } else if (food.dataType?.startsWith("Survey")) {
    score += 1;
  }

  // Gentle tiebreak toward FDC's own relevance ranking.
  score -= index * 0.05;

  return score;
}

/** Pull per-100g macros off an FDC food row, tolerant of both number schemes. */
function extractPer100g(food: FdcFood): Macros | null {
  let calories: number | null = null;
  let protein: number | null = null;
  let carbs: number | null = null;
  let fat: number | null = null;

  for (const n of food.foodNutrients ?? []) {
    const num = String(n.nutrientNumber ?? "");
    const value = typeof n.value === "number" ? n.value : null;
    if (value == null) {
      continue;
    }
    if (PROTEIN_NUMS.has(num) && protein == null) {
      protein = value;
    } else if (FAT_NUMS.has(num) && fat == null) {
      fat = value;
    } else if (CARB_NUMS.has(num) && carbs == null) {
      carbs = value;
    } else if (
      ENERGY_NUMS.has(num) &&
      calories == null &&
      String(n.unitName).toUpperCase() === "KCAL"
    ) {
      calories = value;
    }
  }

  // A usable match needs at least calories + protein; carbs/fat default to 0
  // (a pure-protein food legitimately has ~0 of one).
  if (calories == null || protein == null) {
    return null;
  }
  return {
    calories,
    protein,
    carbs: carbs ?? 0,
    fat: fat ?? 0,
  };
}

// Module-level cache keyed by the normalized query. A 7-day plan reuses the same
// staples (oats, chicken, rice…) many times, so this collapses dozens of lookups
// into a handful of network calls and stays well under the rate limit.
const cache = new Map<string, FdcMatch | null>();

function apiKey(): string {
  return process.env.USDA_FDC_API_KEY?.trim() || "DEMO_KEY";
}

/**
 * Look up a food by a clean search term and return the best generic match with
 * its per-100g macros. Returns null when nothing usable is found (caller decides
 * how to handle a miss). Never throws on a network/API error — resolves null —
 * so one bad lookup can't sink a whole plan generation.
 */
export async function searchFoodMacros(
  query: string
): Promise<FdcMatch | null> {
  const key = query.trim().toLowerCase();
  if (!key) {
    return null;
  }
  if (cache.has(key)) {
    return cache.get(key) ?? null;
  }

  try {
    // Try clean whole-food data types first; fall back to including Branded only
    // if nothing usable turns up (covers supplements/cartons like whey or liquid
    // egg whites that don't exist as a generic SR/Foundation entry).
    let match = await runSearch(query, PREFERRED_DATA_TYPES);
    if (!match) {
      match = await runSearch(query, `${PREFERRED_DATA_TYPES},Branded`);
    }
    cache.set(key, match);
    return match;
  } catch {
    // Don't cache transient failures — a retry on the next plan might succeed.
    return null;
  }
}

// scaleMacros / sumMacros are re-exported from ./macros at the top of this file.

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * GET an FDC search with retry on rate-limit/transient errors. FDC throttles
 * bursts (we look up many foods per plan, some concurrently), so a 429/5xx is
 * usually transient — back off and retry rather than letting the food silently
 * fall through to zero macros. Returns the parsed body, null for a genuine
 * "nothing here" (non-retryable 4xx), or THROWS when retries are exhausted (so
 * the caller treats it as a transient failure and doesn't cache the miss).
 */
async function fetchSearch(url: URL): Promise<{ foods?: FdcFood[] } | null> {
  const MAX_ATTEMPTS = 3;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(12_000),
      // FDC data is static; let the platform cache identical queries for a day.
      next: { revalidate: 86_400 },
    });
    if (res.ok) {
      return (await res.json()) as { foods?: FdcFood[] };
    }
    // 429 (rate limit) and 5xx are transient — back off (with jitter) and retry.
    if (res.status === 429 || res.status >= 500) {
      if (attempt < MAX_ATTEMPTS - 1) {
        await sleep(500 * (attempt + 1) + Math.floor(Math.random() * 250));
        continue;
      }
      throw new Error(`FDC throttled (status ${res.status})`);
    }
    // A real "no/invalid" response — not worth retrying.
    return null;
  }
  return null;
}

/** One FDC search pass over a given set of data types; best-scoring usable hit. */
async function runSearch(
  query: string,
  dataTypes: string
): Promise<FdcMatch | null> {
  const url = new URL(`${FDC_BASE}/foods/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("pageSize", "25");
  url.searchParams.set("dataType", dataTypes);
  url.searchParams.set("api_key", apiKey());

  const json = await fetchSearch(url);
  if (!json) {
    return null;
  }
  const foods = json.foods ?? [];

  // Score every candidate that has readable macros, take the best.
  let best: FdcMatch | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const [index, food] of foods.entries()) {
    const per100g = extractPer100g(food);
    if (!per100g) {
      continue;
    }
    const score = scoreCandidate(query, food, index);
    if (score > bestScore) {
      bestScore = score;
      best = { fdcId: food.fdcId, description: food.description, per100g };
    }
  }
  return best;
}
