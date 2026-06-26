import { config } from "dotenv";

config({ path: ".env.local" });

import {
  FOOD_TABLE_SIZE,
  resolveFoodMacros,
} from "../lib/nutrition/food-table";

// Mix of in-table foods (varied phrasings/plurals) and out-of-table foods that
// must fall back to live USDA.
const CASES: [name: string, query: string][] = [
  ["Salmon fillet", "salmon cooked"],
  ["Salmon", "salmon"],
  ["Grilled chicken breast", "chicken breast cooked"],
  ["Egg whites", "egg whites"],
  ["Rolled oats", "rolled oats dry"],
  ["Sweet potatoes", "sweet potato baked"],
  ["Garbanzo beans", "garbanzo beans"],
  ["Jasmine rice", "white rice cooked"],
  ["Mozzarella", "mozzarella cheese"],
  // out-of-table → USDA fallback expected:
  ["Ostrich steak", "ostrich cooked"],
  ["Jackfruit", "jackfruit raw"],
  ["Elk meat", "elk cooked"],
];

async function main() {
  console.log(`Table size: ${FOOD_TABLE_SIZE} foods\n`);
  for (const [name, query] of CASES) {
    const r = await resolveFoodMacros(name, query);
    if (!r) {
      console.log(`MISS    ${name}`);
      continue;
    }
    const p = r.per100g;
    console.log(
      `${r.source.toUpperCase().padEnd(6)} ${name.padEnd(22)} → ${r.description}  [${Math.round(p.calories)}kcal P${Math.round(p.protein)} C${Math.round(p.carbs)} F${Math.round(p.fat)}]`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  });
