import "server-only";

/**
 * Interactive food-database search + barcode lookup (FN-1) - the data layer
 * behind the Calorie Tracker's Search tab.
 *
 * Search merges two verified sources: the curated food table (instant,
 * hand-verified, lib/nutrition/food-table.ts) first, then live USDA FoodData
 * Central (generic + branded) ranked by lib/nutrition/fdc.ts. Barcode lookup
 * asks USDA (official US label data, matched strictly by GTIN/UPC) and Open
 * Food Facts (the global crowdsourced barcode database, no key needed) in
 * parallel and prefers the official answer. Nothing here is AI-estimated
 * (memory `chad-accuracy-fix-at-data-layer`); the client does the only math
 * (grams/servings scaling) with exact arithmetic.
 */

import { type FdcListItem, lookupFdcBarcode, searchFoodList } from "./fdc";
import type { FoodHit } from "./food-hit";
import { searchFoodTable } from "./food-table";
import type { Macros } from "./macros";

export type { FoodHit } from "./food-hit";

const round1 = (n: number) => Math.round(n * 10) / 10;

function tidyMacros(m: Macros): Macros {
  return {
    calories: Math.round(m.calories),
    protein: round1(m.protein),
    carbs: round1(m.carbs),
    fat: round1(m.fat),
  };
}

/** Scale per-100g macros to a serving's gram weight (exact, then tidied). */
function servingMacros(per100g: Macros, grams: number): Macros {
  const f = grams / 100;
  return tidyMacros({
    calories: per100g.calories * f,
    protein: per100g.protein * f,
    carbs: per100g.carbs * f,
    fat: per100g.fat * f,
  });
}

function titleCase(s: string): string {
  const t = s.trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

function fdcItemToHit(item: FdcListItem): FoodHit {
  return {
    id: `fdc:${item.fdcId}`,
    name: titleCase(item.description),
    brand: item.brand,
    per100g: tidyMacros(item.per100g),
    serving:
      item.serving?.grams != null
        ? {
            label: item.serving.label,
            grams: item.serving.grams,
            macros: servingMacros(item.per100g, item.serving.grams),
          }
        : null,
    source: "usda",
  };
}

/**
 * Search both verified sources and merge: curated table first (it's the
 * hand-checked short list), then USDA generic + branded, deduped against the
 * table by fdcId. USDA failing (throttled, offline) degrades to table-only -
 * the search never errors out entirely.
 */
export async function searchFoodDatabase(
  query: string,
  limit = 12
): Promise<FoodHit[]> {
  const q = query.trim();
  if (q.length < 2) {
    return [];
  }

  const tableHits = searchFoodTable(q, 5);
  const usdaHits = await searchFoodList(q, limit);

  const results: FoodHit[] = tableHits.map((t) => ({
    id: `table:${t.name}`,
    name: titleCase(t.name),
    brand: null,
    per100g: tidyMacros(t.per100g),
    serving: null,
    source: "table" as const,
  }));

  const tableFdcIds = new Set(
    tableHits.map((t) => t.fdcId).filter((id): id is number => id != null)
  );
  const seenNames = new Set(results.map((r) => r.name.toLowerCase()));
  for (const item of usdaHits) {
    if (results.length >= limit) {
      break;
    }
    if (tableFdcIds.has(item.fdcId)) {
      continue;
    }
    const hit = fdcItemToHit(item);
    const nameKey = `${hit.name.toLowerCase()}|${(hit.brand ?? "").toLowerCase()}`;
    if (seenNames.has(nameKey)) {
      continue;
    }
    seenNames.add(nameKey);
    results.push(hit);
  }
  return results;
}

/* ------------------------------------------------------------------ */
/* Barcode lookup                                                      */
/* ------------------------------------------------------------------ */

type OffNutriments = Record<string, number | string | undefined>;

type OffProduct = {
  product_name?: string;
  brands?: string;
  nutriments?: OffNutriments;
  serving_size?: string;
  serving_quantity?: number | string;
};

const OFF_FIELDS =
  "product_name,brands,nutriments,serving_size,serving_quantity";

function offNumber(n: OffNutriments, key: string): number | null {
  const v = n[key];
  const num = typeof v === "string" ? Number.parseFloat(v) : v;
  return typeof num === "number" && Number.isFinite(num) ? num : null;
}

/** OFF serving_size strings are crowdsourced and sometimes carry duplicated
 *  annotations ("3/4 cup (28 g) (28 g)"); collapse exact repeats. */
function tidyServingLabel(label: string): string {
  return label.replace(/(\([^)]*\))(?:\s*\1)+/g, "$1").trim();
}

/** Fetch one barcode from Open Food Facts. Null on miss or unusable data. */
async function lookupOffBarcode(code: string): Promise<FoodHit | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${code}.json?fields=${OFF_FIELDS}`;
  let product: OffProduct | null = null;
  try {
    const res = await fetch(url, {
      // OFF asks API users to identify themselves.
      headers: { "User-Agent": "ChadCoach/1.0 (https://app.chadcoach.ai)" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86_400 },
    });
    if (!res.ok) {
      return null;
    }
    const json = (await res.json()) as {
      status?: number;
      product?: OffProduct;
    };
    if (json.status !== 1 || !json.product) {
      return null;
    }
    product = json.product;
  } catch {
    return null;
  }

  const name = product.product_name?.trim();
  const n = product.nutriments ?? {};
  if (!name) {
    return null;
  }

  const servingQty =
    typeof product.serving_quantity === "string"
      ? Number.parseFloat(product.serving_quantity)
      : product.serving_quantity;
  const servingGrams =
    typeof servingQty === "number" && Number.isFinite(servingQty) && servingQty > 0
      ? servingQty
      : null;
  const servingLabel = product.serving_size?.trim()
    ? tidyServingLabel(product.serving_size)
    : null;

  // Prefer per-100g values; derive them from per-serving when that's all the
  // product publishes and the serving's gram weight is known.
  let per100g: Macros | null = null;
  const kcal100 = offNumber(n, "energy-kcal_100g");
  const pro100 = offNumber(n, "proteins_100g");
  if (kcal100 != null && pro100 != null) {
    per100g = {
      calories: kcal100,
      protein: pro100,
      carbs: offNumber(n, "carbohydrates_100g") ?? 0,
      fat: offNumber(n, "fat_100g") ?? 0,
    };
  } else {
    const kcalServ = offNumber(n, "energy-kcal_serving");
    const proServ = offNumber(n, "proteins_serving");
    if (kcalServ != null && proServ != null && servingGrams) {
      const f = 100 / servingGrams;
      per100g = {
        calories: kcalServ * f,
        protein: proServ * f,
        carbs: (offNumber(n, "carbohydrates_serving") ?? 0) * f,
        fat: (offNumber(n, "fat_serving") ?? 0) * f,
      };
    }
  }
  if (!per100g) {
    return null;
  }

  const brand = product.brands?.split(",")[0]?.trim() || null;
  return {
    id: `off:${code}`,
    name: titleCase(name),
    brand,
    per100g: tidyMacros(per100g),
    serving:
      servingGrams != null
        ? {
            label: servingLabel ?? `${Math.round(servingGrams)} g serving`,
            grams: servingGrams,
            macros: servingMacros(per100g, servingGrams),
          }
        : null,
    source: "off",
  };
}

/** The barcode digit-string variants worth trying: as scanned, UPC-A->EAN-13,
 *  and EAN-13-with-leading-zero->UPC-A. */
function barcodeVariants(digits: string): string[] {
  const variants = [digits];
  if (digits.length === 12) {
    variants.push(`0${digits}`);
  } else if (digits.length === 13 && digits.startsWith("0")) {
    variants.push(digits.slice(1));
  }
  return variants;
}

/**
 * Look a scanned/typed barcode up across USDA Branded (strict GTIN match,
 * official US label data) and Open Food Facts (global) in parallel. USDA wins
 * when both answer. Null when neither knows the product.
 */
export async function lookupBarcode(raw: string): Promise<FoodHit | null> {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 14) {
    return null;
  }

  const [fdcItem, offHit] = await Promise.all([
    lookupFdcBarcode(digits),
    (async () => {
      for (const variant of barcodeVariants(digits)) {
        const hit = await lookupOffBarcode(variant);
        if (hit) {
          return hit;
        }
      }
      return null;
    })(),
  ]);

  if (fdcItem) {
    return fdcItemToHit(fdcItem);
  }
  return offHit;
}
