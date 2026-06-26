/**
 * Offline build script for the curated food table (chad meal plans).
 *
 * Run once (and again when you add foods) to fetch VERIFIED per-100g macros from
 * USDA for a hand-curated list of common whole foods, and bake them into a
 * static JSON the app reads at runtime. At runtime we never call USDA for these
 * foods — it's a plain exact lookup — so the table can be as big as we want with
 * zero cost to the AI or the site. USDA stays as a live fallback only for foods
 * not in this list (see lib/nutrition/food-table.ts).
 *
 * Run:  npx tsx --conditions=react-server scripts/build-food-table.ts
 *
 * RESUMABLE: it merges into the existing JSON and skips foods already baked, so
 * if USDA rate-limits you partway, just run it again later and it continues.
 * Pass --refetch to rebuild every entry from scratch.
 *
 * Each entry is COOKED macros for foods normally eaten cooked (meats, grains,
 * legumes) and RAW for foods eaten raw (fruit, salad veg, nuts, oils). The query
 * carries that intent; the stored USDA description is shown to users for
 * transparency.
 */

import { config } from "dotenv";

config({ path: ".env.local" });

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { searchFoodMacros } from "../lib/nutrition/fdc";
import type { Macros } from "../lib/nutrition/macros";

type Seed = [name: string, query?: string, aliases?: string[]];

// name = the canonical food (what we match Chad's plan against, after
// normalization). query = the USDA search term (defaults to name). aliases =
// extra synonyms users/Chad might say.
const SEEDS: Seed[] = [
  // ---------- Poultry ----------
  [
    "chicken breast",
    "chicken breast cooked roasted",
    ["grilled chicken breast", "chicken breasts"],
  ],
  ["chicken thigh", "chicken thigh cooked roasted", ["chicken thighs"]],
  ["chicken drumstick", "chicken drumstick cooked", ["chicken leg"]],
  ["chicken wing", "chicken wing cooked"],
  ["ground chicken", "ground chicken cooked"],
  ["rotisserie chicken", "chicken roasted meat only"],
  ["turkey breast", "turkey breast cooked roasted", ["sliced turkey"]],
  ["ground turkey", "ground turkey cooked"],
  ["turkey thigh", "turkey thigh cooked"],
  ["turkey bacon", "turkey bacon cooked"],
  ["duck breast", "duck breast cooked"],

  // ---------- Beef ----------
  [
    "ground beef",
    "ground beef 90 lean cooked",
    ["lean ground beef", "hamburger"],
  ],
  ["ground beef 80/20", "ground beef 80 lean 20 fat cooked"],
  ["ground beef 93/7", "ground beef 93 lean cooked"],
  ["sirloin steak", "beef sirloin cooked", ["sirloin"]],
  ["ribeye steak", "beef ribeye cooked", ["ribeye"]],
  ["flank steak", "beef flank cooked"],
  ["beef tenderloin", "beef tenderloin cooked", ["filet mignon"]],
  ["new york strip", "beef short loin strip cooked"],
  ["beef chuck", "beef chuck cooked"],
  ["beef brisket", "beef brisket cooked"],
  ["beef stew meat", "beef stew meat cooked"],
  ["roast beef", "roast beef deli"],
  ["beef jerky", "beef jerky"],

  // ---------- Pork ----------
  ["pork chop", "pork chop cooked", ["pork chops"]],
  ["pork loin", "pork loin cooked"],
  ["pork tenderloin", "pork tenderloin cooked"],
  ["ground pork", "ground pork cooked"],
  ["bacon", "bacon cooked"],
  ["ham", "ham sliced", ["deli ham"]],
  ["pork sausage", "pork sausage cooked", ["sausage"]],
  ["italian sausage", "italian sausage cooked"],
  ["pork ribs", "pork ribs cooked"],
  ["prosciutto", "prosciutto"],

  // ---------- Fish & seafood ----------
  ["salmon", "salmon cooked", ["grilled salmon", "atlantic salmon"]],
  ["canned salmon", "salmon canned"],
  ["tuna steak", "tuna cooked", ["ahi tuna"]],
  ["canned tuna", "tuna canned water", ["tuna in water"]],
  ["cod", "cod cooked"],
  ["tilapia", "tilapia cooked"],
  ["halibut", "halibut cooked"],
  ["mahi mahi", "mahi mahi cooked"],
  ["trout", "trout cooked"],
  ["mackerel", "mackerel cooked"],
  ["sardines", "sardines canned"],
  ["herring", "herring cooked"],
  ["catfish", "catfish cooked"],
  ["sea bass", "sea bass cooked"],
  ["snapper", "snapper cooked"],
  ["shrimp", "shrimp cooked", ["prawns"]],
  ["scallops", "scallops cooked"],
  ["crab", "crab cooked", ["crab meat"]],
  ["lobster", "lobster cooked"],
  ["mussels", "mussels cooked"],
  ["oysters", "oysters cooked"],
  ["clams", "clams cooked"],
  ["squid", "squid cooked", ["calamari"]],

  // ---------- Eggs ----------
  ["whole egg", "egg whole cooked", ["eggs", "egg"]],
  ["egg white", "egg white raw", ["egg whites", "liquid egg whites"]],
  ["egg yolk", "egg yolk raw"],

  // ---------- Dairy ----------
  ["whole milk", "milk whole", ["milk"]],
  ["2% milk", "milk reduced fat 2%"],
  ["skim milk", "milk nonfat skim", ["nonfat milk"]],
  ["almond milk", "almond milk unsweetened"],
  ["soy milk", "soy milk unsweetened"],
  ["oat milk", "oat milk"],
  ["greek yogurt", "yogurt greek plain nonfat", ["nonfat greek yogurt"]],
  ["whole milk greek yogurt", "yogurt greek plain whole milk"],
  ["plain yogurt", "yogurt plain whole milk"],
  ["cottage cheese", "cottage cheese lowfat 2%", ["low fat cottage cheese"]],
  ["cheddar cheese", "cheese cheddar", ["cheddar"]],
  ["mozzarella cheese", "cheese mozzarella", ["mozzarella"]],
  ["parmesan cheese", "cheese parmesan", ["parmesan"]],
  ["feta cheese", "cheese feta", ["feta"]],
  ["swiss cheese", "cheese swiss"],
  ["provolone cheese", "cheese provolone"],
  ["cream cheese", "cream cheese"],
  ["goat cheese", "cheese goat"],
  ["ricotta cheese", "cheese ricotta part skim", ["ricotta"]],
  ["string cheese", "cheese mozzarella low moisture part skim"],
  ["butter", "butter salted"],
  ["sour cream", "sour cream"],
  ["heavy cream", "cream heavy whipping"],
  ["half and half", "cream half and half"],

  // ---------- Protein supplements ----------
  ["whey protein", "whey protein powder", ["protein powder", "whey"]],
  ["casein protein", "casein protein powder"],
  ["plant protein powder", "pea protein powder"],

  // ---------- Legumes & soy ----------
  ["black beans", "black beans cooked"],
  ["kidney beans", "kidney beans cooked"],
  ["pinto beans", "pinto beans cooked"],
  ["navy beans", "navy beans cooked"],
  ["cannellini beans", "white beans cooked"],
  ["chickpeas", "chickpeas cooked", ["garbanzo beans"]],
  ["lentils", "lentils cooked"],
  ["split peas", "split peas cooked"],
  ["edamame", "edamame cooked"],
  ["tofu", "tofu firm", ["firm tofu"]],
  ["tempeh", "tempeh"],
  ["hummus", "hummus"],
  ["refried beans", "refried beans"],

  // ---------- Grains, rice, pasta, bread ----------
  ["white rice", "rice white cooked", ["jasmine rice", "cooked white rice"]],
  ["brown rice", "rice brown cooked"],
  ["basmati rice", "rice white long grain cooked"],
  ["quinoa", "quinoa cooked"],
  ["rolled oats", "oats raw", ["oatmeal", "oats", "dry oats"]],
  ["steel cut oats", "oats raw"],
  ["pasta", "pasta cooked", ["spaghetti", "white pasta"]],
  ["whole wheat pasta", "pasta whole wheat cooked"],
  ["couscous", "couscous cooked"],
  ["barley", "barley cooked"],
  ["farro", "farro cooked"],
  ["bulgur", "bulgur cooked"],
  ["white bread", "bread white", ["bread"]],
  ["whole wheat bread", "bread whole wheat", ["wheat bread"]],
  ["sourdough bread", "bread sourdough"],
  ["rye bread", "bread rye"],
  ["bagel", "bagel plain"],
  ["english muffin", "english muffin"],
  ["flour tortilla", "tortilla flour", ["tortilla"]],
  ["corn tortilla", "tortilla corn"],
  ["pita bread", "pita bread"],
  ["naan", "naan bread"],
  ["crackers", "crackers"],
  ["rice cakes", "rice cakes"],
  ["cornmeal", "cornmeal"],
  ["grits", "grits cooked"],
  ["cereal", "corn flakes cereal"],
  ["granola", "granola"],
  ["pancake", "pancakes"],
  ["all purpose flour", "wheat flour white all purpose"],
  ["whole wheat flour", "wheat flour whole grain"],

  // ---------- Fruits ----------
  ["banana", "banana raw", ["bananas"]],
  ["apple", "apple raw with skin", ["apples"]],
  ["orange", "orange raw", ["oranges"]],
  ["strawberries", "strawberries raw"],
  ["blueberries", "blueberries raw"],
  ["raspberries", "raspberries raw"],
  ["blackberries", "blackberries raw"],
  ["grapes", "grapes raw"],
  ["mango", "mango raw"],
  ["pineapple", "pineapple raw"],
  ["watermelon", "watermelon raw"],
  ["cantaloupe", "cantaloupe raw"],
  ["peach", "peach raw", ["peaches"]],
  ["pear", "pear raw"],
  ["plum", "plum raw"],
  ["kiwi", "kiwifruit raw"],
  ["cherries", "cherries raw sweet"],
  ["pomegranate", "pomegranate raw"],
  ["grapefruit", "grapefruit raw"],
  ["cantaloupe melon", "melon cantaloupe raw"],
  ["apricot", "apricots raw"],
  ["dates", "dates medjool"],
  ["raisins", "raisins"],
  ["dried cranberries", "cranberries dried"],
  ["avocado", "avocado raw"],
  ["lemon", "lemon raw"],
  ["lime", "lime raw"],
  ["coconut", "coconut meat raw"],

  // ---------- Vegetables ----------
  ["broccoli", "broccoli raw"],
  ["spinach", "spinach raw"],
  ["kale", "kale raw"],
  ["romaine lettuce", "lettuce romaine raw", ["lettuce"]],
  ["arugula", "arugula raw"],
  ["carrots", "carrots raw", ["carrot"]],
  ["bell pepper", "peppers sweet red raw", ["red pepper", "bell peppers"]],
  ["onion", "onions raw", ["onions"]],
  ["garlic", "garlic raw"],
  ["tomato", "tomatoes red raw", ["tomatoes"]],
  ["cherry tomatoes", "tomatoes cherry raw"],
  ["cucumber", "cucumber raw"],
  ["zucchini", "zucchini raw", ["courgette"]],
  ["yellow squash", "squash summer raw"],
  ["butternut squash", "squash butternut cooked"],
  ["sweet potato", "sweet potato cooked baked", ["sweet potatoes", "yam"]],
  [
    "potato",
    "potato cooked baked",
    ["potatoes", "russet potato", "white potato"],
  ],
  ["red potato", "potatoes red cooked"],
  ["corn", "corn sweet yellow cooked", ["sweet corn"]],
  ["green peas", "peas green cooked", ["peas"]],
  ["green beans", "green beans cooked", ["string beans"]],
  ["asparagus", "asparagus cooked"],
  ["brussels sprouts", "brussels sprouts cooked"],
  ["cauliflower", "cauliflower raw"],
  ["mushrooms", "mushrooms white raw", ["mushroom"]],
  ["cabbage", "cabbage raw"],
  ["celery", "celery raw"],
  ["beets", "beets cooked"],
  ["eggplant", "eggplant cooked"],
  ["sweet pepper", "peppers sweet green raw"],
  ["jalapeno", "peppers jalapeno raw"],
  ["green onion", "onions spring raw scallions", ["scallions"]],
  ["leek", "leeks raw"],
  ["bok choy", "bok choy cooked"],
  ["collard greens", "collards cooked"],
  ["swiss chard", "chard cooked"],
  ["okra", "okra cooked"],
  ["radish", "radishes raw"],
  ["turnip", "turnips cooked"],
  ["pumpkin", "pumpkin cooked"],
  ["artichoke", "artichokes cooked"],
  ["snap peas", "edible podded peas cooked"],
  ["sauerkraut", "sauerkraut canned"],
  ["olives", "olives ripe canned"],
  ["pickles", "pickles dill"],

  // ---------- Nuts, seeds & nut butters ----------
  ["almonds", "almonds raw"],
  ["walnuts", "walnuts english"],
  ["cashews", "cashews raw"],
  ["pistachios", "pistachios raw"],
  ["pecans", "pecans"],
  ["peanuts", "peanuts raw"],
  ["macadamia nuts", "macadamia nuts raw"],
  ["hazelnuts", "hazelnuts"],
  ["brazil nuts", "brazil nuts"],
  ["pine nuts", "pine nuts"],
  ["peanut butter", "peanut butter smooth"],
  ["almond butter", "almond butter"],
  ["cashew butter", "cashew butter"],
  ["chia seeds", "chia seeds"],
  ["flax seeds", "flaxseed", ["flaxseed"]],
  ["sunflower seeds", "sunflower seeds kernels"],
  ["pumpkin seeds", "pumpkin seeds", ["pepitas"]],
  ["sesame seeds", "sesame seeds"],
  ["tahini", "sesame butter tahini"],

  // ---------- Oils & fats ----------
  ["olive oil", "olive oil"],
  ["coconut oil", "coconut oil"],
  ["avocado oil", "avocado oil"],
  ["canola oil", "canola oil"],
  ["vegetable oil", "vegetable oil"],
  ["sesame oil", "sesame oil"],

  // ---------- Condiments, sauces & sweeteners ----------
  ["honey", "honey"],
  ["maple syrup", "maple syrup"],
  ["sugar", "sugar granulated"],
  ["brown sugar", "sugar brown"],
  ["ketchup", "ketchup"],
  ["mustard", "mustard prepared yellow"],
  ["mayonnaise", "mayonnaise", ["mayo"]],
  ["soy sauce", "soy sauce"],
  ["hot sauce", "hot sauce"],
  ["sriracha", "sriracha sauce"],
  ["bbq sauce", "barbecue sauce"],
  ["salsa", "salsa"],
  ["marinara sauce", "marinara sauce"],
  ["pesto", "pesto sauce"],
  ["ranch dressing", "ranch dressing"],
  ["balsamic vinegar", "vinegar balsamic"],
  ["soy sauce low sodium", "soy sauce reduced sodium"],
  ["coconut milk", "coconut milk canned"],
  ["tomato sauce", "tomato sauce canned"],
  ["tomato paste", "tomato paste"],
  ["chicken broth", "chicken broth"],
  ["dark chocolate", "chocolate dark 70-85%"],
  ["jam", "jam preserves"],
];

type Entry = {
  name: string;
  fdcId: number;
  desc: string;
  per100g: Macros;
  aliases: string[];
};

const OUT = "lib/nutrition/food-table.json";

function plausible(m: Macros): string | null {
  if (m.calories <= 0 && m.protein <= 0) {
    return "zero macros";
  }
  if (m.protein > 95) {
    return `protein ${m.protein}/100g looks too high`;
  }
  if (m.calories > 950) {
    return `calories ${m.calories}/100g looks too high`;
  }
  return null;
}

async function main() {
  const refetch = process.argv.includes("--refetch");
  const existing: Record<string, Entry> =
    !refetch && existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

  const misses: string[] = [];
  const warnings: string[] = [];
  let added = 0;

  for (const [name, query, aliases] of SEEDS) {
    if (existing[name]) {
      continue; // resume: skip already-baked
    }
    const match = await searchFoodMacros(query ?? name);
    if (!match) {
      misses.push(name);
      console.log(`MISS   ${name}  (q: "${query ?? name}")`);
      continue;
    }
    const per100g: Macros = {
      calories: Math.round(match.per100g.calories),
      protein: Math.round(match.per100g.protein * 10) / 10,
      carbs: Math.round(match.per100g.carbs * 10) / 10,
      fat: Math.round(match.per100g.fat * 10) / 10,
    };
    const warn = plausible(per100g);
    if (warn) {
      warnings.push(`${name} → ${match.description} (${warn})`);
    }
    existing[name] = {
      name,
      fdcId: match.fdcId,
      desc: match.description,
      per100g,
      aliases: aliases ?? [],
    };
    added++;
    console.log(
      `OK     ${name}  →  ${match.description}  [${per100g.calories}kcal P${per100g.protein} C${per100g.carbs} F${per100g.fat}]`
    );
  }

  // Write sorted by name for stable diffs.
  const sorted: Record<string, Entry> = {};
  for (const k of Object.keys(existing).sort()) {
    sorted[k] = existing[k];
  }
  writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`);

  console.log(
    `\nDONE. ${Object.keys(sorted).length} foods in table (+${added} new). ${misses.length} misses.`
  );
  if (misses.length) {
    console.log("MISSES (will use live USDA fallback):", misses.join(", "));
  }
  if (warnings.length) {
    console.log("\nSANITY WARNINGS — review these:");
    for (const w of warnings) {
      console.log(`  - ${w}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  });
