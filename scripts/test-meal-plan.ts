import { config } from "dotenv";
config({ path: ".env.local" });

import { generateMealPlan } from "../lib/ai/meal-plan";
import { mealPlanPreferencesSchema } from "../lib/validation/meal-plan";

async function main() {
  const prefs = mealPlanPreferencesSchema.parse({
    dietStyle: "high_protein",
    allergies: ["shellfish"],
    dislikes: ["mushrooms"],
    mealsPerDay: 3,
    days: 1,
    budget: "moderate",
    cookTime: "moderate",
    notes: "Cutting, lifts 4x/week.",
  });

  console.time("generate");
  const plan = await generateMealPlan({
    preferences: prefs,
    target: { calories: 2000, protein: 180, carbs: 160, fat: 60 },
  });
  console.timeEnd("generate");

  console.log("\nTITLE:", plan.title);
  console.log("INTRO:", plan.coachIntro);
  console.log("TARGET:", plan.target);
  for (const day of plan.days) {
    console.log(`\n=== ${day.label} === totals:`, day.totals);
    for (const meal of day.meals) {
      console.log(`  [${meal.slot}] ${meal.title} —`, meal.totals);
      for (const f of meal.foods) {
        console.log(
          `     ${f.grams}g ${f.name}  →  ${f.calories}kcal P${f.protein} C${f.carbs} F${f.fat}  (fdc:${f.fdcId ?? "MISS"} ${f.fdcDescription ?? ""})`
        );
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAILED:", e);
    process.exit(1);
  });
