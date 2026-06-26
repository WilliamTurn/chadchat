import { config } from "dotenv";

config({ path: ".env.local" });

import { searchFoodMacros } from "../lib/nutrition/fdc";

const QUERIES = [
  "egg whites",
  "whole eggs",
  "rolled oats dry",
  "blueberries",
  "chicken breast cooked",
  "white rice cooked",
  "broccoli",
  "olive oil",
  "lean ground beef",
  "potato",
  "spinach",
  "greek yogurt",
  "banana",
  "almonds",
  "salmon",
  "sweet potato",
];

async function main() {
  for (const q of QUERIES) {
    const m = await searchFoodMacros(q);
    if (!m) {
      console.log(`MISS   "${q}"`);
      continue;
    }
    const p = m.per100g;
    console.log(
      `OK     "${q}"  →  ${m.description}  [${Math.round(p.calories)}kcal P${Math.round(p.protein)} C${Math.round(p.carbs)} F${Math.round(p.fat)} /100g]  fdc:${m.fdcId}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  });
