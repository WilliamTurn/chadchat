import "server-only";

/**
 * The curated food table — the DEFAULT macro source for Chad's meal plans.
 *
 * `food-table.json` holds a few hundred common whole foods with VERIFIED per-100g
 * macros (sourced once from USDA offline via scripts/build-food-table.ts, then
 * hand-corrected). At runtime we resolve each food Chad names against this table
 * with a plain normalized lookup — no API call, no rate limits, no fuzzy
 * scoring, instant, and impossible to mismatch. The table can grow without limit
 * because matching happens in code, not in the model's prompt.
 *
 * Only when a food isn't in the table (an unusual/picky request) do we fall back
 * to a live USDA search (lib/nutrition/fdc.ts), which is the one place the
 * candidate-scoring heuristics still earn their keep.
 */

import { searchFoodMacros } from "./fdc";
import rawTable from "./food-table.json";
import type { Macros } from "./macros";

type TableEntry = {
  name: string;
  fdcId: number | null;
  desc: string;
  per100g: Macros;
  aliases: string[];
};

const TABLE = rawTable as Record<string, TableEntry>;

export type ResolvedFood = {
  fdcId: number | null;
  description: string;
  per100g: Macros;
  source: "table" | "usda";
};

// Cooking/prep/cut words that don't change a food's identity — stripped before
// matching so "grilled chicken breast, cooked" resolves to "chicken breast".
// Identity words are NOT here on purpose: "whole/skim" distinguish milks,
// "ground" beef from steak, and "canned/dried/frozen" distinguish e.g. "canned
// salmon" from fresh "salmon" — stripping those would collide their keys.
const PREP_WORDS = new Set([
  "cooked",
  "raw",
  "baked",
  "boiled",
  "steamed",
  "roasted",
  "broiled",
  "grilled",
  "fried",
  "sauteed",
  "seared",
  "poached",
  "pan",
  "fresh",
  "sliced",
  "chopped",
  "diced",
  "minced",
  "shredded",
  "grated",
  "cubed",
  "crushed",
  "drained",
  "rinsed",
  "plain",
  "ripe",
  "peeled",
  "prepared",
  "homemade",
  "organic",
  "large",
  "medium",
  "small",
  "extra",
  "fillet",
  "fillets",
  "piece",
  "pieces",
  "of",
  "the",
  "a",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Content tokens: prep words and bare numbers removed. */
function contentTokens(s: string): string[] {
  return tokenize(s).filter((t) => !PREP_WORDS.has(t) && !/^\d+$/.test(t));
}

/** Canonical key: content tokens, sorted, joined — order-insensitive. */
function normKey(s: string): string {
  return contentTokens(s).sort().join(" ");
}

/** Plural-tolerant token equality (mirrors fdc.ts): exact, or +"s"/"es". */
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

// Indexes built once at module load.
const exactIndex = new Map<string, TableEntry>();
const tokenIndex: { tokens: string[]; entry: TableEntry }[] = [];

for (const entry of Object.values(TABLE)) {
  for (const label of [entry.name, ...entry.aliases]) {
    const key = normKey(label);
    if (key && !exactIndex.has(key)) {
      exactIndex.set(key, entry);
    }
    const tokens = contentTokens(label);
    if (tokens.length) {
      tokenIndex.push({ tokens, entry });
    }
  }
}

/**
 * Find a food in the curated table by a free-text name. Tries an exact
 * (order-insensitive, prep-stripped) match first, then a token-subset match —
 * the table entry whose words are all present in the query, most specific
 * winning (so "chicken breast" beats "chicken" for "grilled chicken breast").
 */
function lookupInTable(...labels: string[]): TableEntry | null {
  for (const label of labels) {
    const hit = exactIndex.get(normKey(label));
    if (hit) {
      return hit;
    }
  }

  let best: TableEntry | null = null;
  let bestLen = 0;
  for (const label of labels) {
    const qt = contentTokens(label);
    if (!qt.length) {
      continue;
    }
    for (const cand of tokenIndex) {
      if (
        cand.tokens.length > bestLen &&
        cand.tokens.every((kt) => qt.some((q) => tokenMatch(q, kt)))
      ) {
        best = cand.entry;
        bestLen = cand.tokens.length;
      }
    }
  }
  return best;
}

/**
 * Resolve a food's verified per-100g macros: the curated table first, then a
 * live USDA search as a fallback. `name` is Chad's human label, `query` his
 * clean search term — we try both against the table. Returns null only when both
 * the table and USDA come up empty.
 */
export async function resolveFoodMacros(
  name: string,
  query: string
): Promise<ResolvedFood | null> {
  const hit = lookupInTable(query, name);
  if (hit) {
    return {
      fdcId: hit.fdcId,
      description: hit.desc,
      per100g: hit.per100g,
      source: "table",
    };
  }

  const usda = await searchFoodMacros(query);
  if (usda) {
    return {
      fdcId: usda.fdcId,
      description: usda.description,
      per100g: usda.per100g,
      source: "usda",
    };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Interactive table search (FN-1)                                     */
/* ------------------------------------------------------------------ */

/** One curated-table row surfaced by the interactive food search. */
export type TableSearchHit = {
  name: string;
  description: string;
  fdcId: number | null;
  per100g: Macros;
};

/**
 * Prefix-tolerant token match for as-you-type search: exact/plural like
 * `tokenMatch`, or the query token is a 2+ char prefix of the entry token,
 * so "chicken brea" already surfaces "chicken breast".
 */
function typeaheadMatch(queryToken: string, entryToken: string): boolean {
  if (tokenMatch(queryToken, entryToken)) {
    return true;
  }
  return queryToken.length >= 2 && entryToken.startsWith(queryToken);
}

/**
 * Rank curated-table foods against a free-text query for the Calorie
 * Tracker's search tab. AND semantics: every query content token must land in
 * the entry's name or an alias. Exact (order-insensitive) matches rank first,
 * then tighter labels (fewer words beyond what was asked). Pure in-memory:
 * instant, no API, hand-verified macros.
 */
export function searchFoodTable(query: string, limit = 6): TableSearchHit[] {
  const qt = contentTokens(query);
  if (!qt.length) {
    return [];
  }
  const qKey = normKey(query);

  const best = new Map<string, { entry: TableEntry; score: number }>();
  for (const entry of Object.values(TABLE)) {
    let entryScore = Number.NEGATIVE_INFINITY;
    for (const label of [entry.name, ...entry.aliases]) {
      const lt = contentTokens(label);
      if (!lt.length) {
        continue;
      }
      if (!qt.every((q) => lt.some((t) => typeaheadMatch(q, t)))) {
        continue;
      }
      let score = 100;
      if (normKey(label) === qKey) {
        score += 50;
      }
      // Prefer labels that add the fewest words beyond what was asked
      // ("chicken breast" over "chicken breast tenders" for "chicken brea").
      score -= (lt.length - qt.length) * 8;
      score -= label.length * 0.1;
      entryScore = Math.max(entryScore, score);
    }
    if (entryScore > Number.NEGATIVE_INFINITY) {
      const prev = best.get(entry.name);
      if (!prev || entryScore > prev.score) {
        best.set(entry.name, { entry, score: entryScore });
      }
    }
  }

  return [...best.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry }) => ({
      name: entry.name,
      description: entry.desc,
      fdcId: entry.fdcId,
      per100g: entry.per100g,
    }));
}

/** Count of foods in the curated table (for diagnostics/tests). */
export const FOOD_TABLE_SIZE = Object.keys(TABLE).length;
