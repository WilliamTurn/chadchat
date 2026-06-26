/**
 * One-shot corrections for food-table.json entries the auto-matcher resolved to
 * the wrong USDA variant (e.g. "almonds" → "Abiyuch", "salmon" → breaded
 * nuggets, dry instead of cooked legumes). Values below are hand-verified USDA
 * SR Legacy per-100g, cooked-as-eaten where that's how the food is normally
 * consumed. fdcId is cleared for overridden rows since the original id pointed at
 * the wrong food; the description shown to users is the correct one.
 *
 * Run:  npx tsx scripts/fix-food-table.ts
 */

import { readFileSync, writeFileSync } from "node:fs";

type Macros = { calories: number; protein: number; carbs: number; fat: number };
type Entry = {
  name: string;
  fdcId: number | null;
  desc: string;
  per100g: Macros;
  aliases: string[];
};

const OUT = "lib/nutrition/food-table.json";

const FIX: Record<string, { desc: string; per100g: Macros }> = {
  almonds: {
    desc: "Nuts, almonds, raw",
    per100g: { calories: 579, protein: 21.2, carbs: 21.6, fat: 49.9 },
  },
  bacon: {
    desc: "Pork bacon, cooked",
    per100g: { calories: 541, protein: 37, carbs: 1.4, fat: 41.8 },
  },
  "chicken breast": {
    desc: "Chicken, breast, meat only, cooked, roasted",
    per100g: { calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  },
  cod: {
    desc: "Fish, cod, cooked, dry heat",
    per100g: { calories: 105, protein: 22.8, carbs: 0, fat: 0.9 },
  },
  "mahi mahi": {
    desc: "Fish, mahi mahi (dolphinfish), cooked",
    per100g: { calories: 109, protein: 23.7, carbs: 0, fat: 0.9 },
  },
  mayonnaise: {
    desc: "Mayonnaise, regular",
    per100g: { calories: 680, protein: 1, carbs: 0.6, fat: 75 },
  },
  "mozzarella cheese": {
    desc: "Cheese, mozzarella, whole milk",
    per100g: { calories: 300, protein: 22.2, carbs: 2.2, fat: 22.4 },
  },
  salmon: {
    desc: "Fish, salmon, Atlantic, farmed, cooked",
    per100g: { calories: 206, protein: 22.1, carbs: 0, fat: 12.4 },
  },
  squid: {
    desc: "Mollusks, squid, raw",
    per100g: { calories: 92, protein: 15.6, carbs: 3.1, fat: 1.4 },
  },
  "tuna steak": {
    desc: "Fish, tuna, yellowfin, cooked",
    per100g: { calories: 130, protein: 28.2, carbs: 0, fat: 1.3 },
  },
  walnuts: {
    desc: "Nuts, walnuts, english",
    per100g: { calories: 654, protein: 15.2, carbs: 13.7, fat: 65.2 },
  },
  lentils: {
    desc: "Lentils, cooked, boiled",
    per100g: { calories: 116, protein: 9, carbs: 20.1, fat: 0.4 },
  },
  "navy beans": {
    desc: "Beans, navy, cooked, boiled",
    per100g: { calories: 140, protein: 8.2, carbs: 26.1, fat: 0.6 },
  },
  "split peas": {
    desc: "Peas, split, cooked, boiled",
    per100g: { calories: 118, protein: 8.3, carbs: 21.1, fat: 0.4 },
  },
  eggplant: {
    desc: "Eggplant, cooked, boiled",
    per100g: { calories: 35, protein: 0.8, carbs: 8.7, fat: 0.2 },
  },
  zucchini: {
    desc: "Squash, zucchini, raw",
    per100g: { calories: 17, protein: 1.2, carbs: 3.1, fat: 0.3 },
  },
  halibut: {
    desc: "Fish, halibut, cooked, dry heat",
    per100g: { calories: 111, protein: 22.5, carbs: 0, fat: 2.3 },
  },
  leek: {
    desc: "Leeks, raw",
    per100g: { calories: 61, protein: 1.5, carbs: 14.2, fat: 0.3 },
  },
  pumpkin: {
    desc: "Pumpkin, cooked, boiled",
    per100g: { calories: 20, protein: 0.7, carbs: 4.9, fat: 0.1 },
  },
  "green peas": {
    desc: "Peas, green, cooked, boiled",
    per100g: { calories: 84, protein: 5.4, carbs: 15.6, fat: 0.2 },
  },
  "vegetable oil": {
    desc: "Oil, vegetable (soybean)",
    per100g: { calories: 884, protein: 0, carbs: 0, fat: 100 },
  },
  "ground beef": {
    desc: "Beef, ground, 90% lean, cooked, pan-browned",
    per100g: { calories: 217, protein: 26.1, carbs: 0, fat: 11.6 },
  },
  "ground chicken": {
    desc: "Chicken, ground, cooked",
    per100g: { calories: 189, protein: 23.5, carbs: 0, fat: 10.9 },
  },
  "pork chop": {
    desc: "Pork, loin chop, cooked, broiled",
    per100g: { calories: 210, protein: 29.9, carbs: 0, fat: 9 },
  },
  "rotisserie chicken": {
    desc: "Chicken, roasted, meat and skin",
    per100g: { calories: 197, protein: 28, carbs: 0, fat: 9 },
  },
  farro: {
    desc: "Farro, cooked",
    per100g: { calories: 130, protein: 5, carbs: 26, fat: 1 },
  },
  turnip: {
    desc: "Turnips, cooked, boiled",
    per100g: { calories: 22, protein: 0.7, carbs: 5.1, fat: 0.1 },
  },
  "pork ribs": {
    desc: "Pork, ribs, cooked",
    per100g: { calories: 277, protein: 20.4, carbs: 0, fat: 21.4 },
  },
  shrimp: {
    desc: "Crustaceans, shrimp, cooked",
    per100g: { calories: 99, protein: 24, carbs: 0.2, fat: 0.3 },
  },
};

// Redundant duplicate of "cantaloupe".
const DELETE = ["cantaloupe melon"];

const table: Record<string, Entry> = JSON.parse(readFileSync(OUT, "utf8"));

let fixed = 0;
for (const [name, fix] of Object.entries(FIX)) {
  if (!table[name]) {
    console.log("MISSING (skipped):", name);
    continue;
  }
  table[name] = {
    ...table[name],
    fdcId: null,
    desc: fix.desc,
    per100g: fix.per100g,
  };
  fixed++;
}

let deleted = 0;
for (const d of DELETE) {
  if (table[d]) {
    delete table[d];
    deleted++;
  }
}

const sorted: Record<string, Entry> = {};
for (const k of Object.keys(table).sort()) {
  sorted[k] = table[k];
}
writeFileSync(OUT, `${JSON.stringify(sorted, null, 2)}\n`);

console.log(
  `Fixed ${fixed} entries, deleted ${deleted}. Table now has ${Object.keys(sorted).length} foods.`
);
