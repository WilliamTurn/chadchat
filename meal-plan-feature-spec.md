# Build Spec — Structured Meal Plans (Outstanding task #5)

> **Status:** APPROVED, not started. Written end of s43 (2026-06-25) for a fresh, high-context session to build excellently.
> **Repo:** `chadchat` (the chat app). Prod deploys from `main`.
> **Read this top to bottom before writing code.** Every architectural decision below was deliberately made and approved by the (non-technical) user — don't relitigate them, build them. The user's bar: this must feel like an **expert** deliverable, not "a page of bullet points." Do not skimp.

---

## 1. What we're building (in one breath)

Chad can generate a **structured, multi-day meal plan** tailored to a user's goal and macro targets, saved automatically to a new **`/meal-plan` dashboard page**, where it's viewable, **editable**, and **downloadable as a PDF**, with **one-tap "log as planned"** flowing each planned meal into the existing food diary. Chad is aware of the active plan in chat and holds the user to it.

This is a **Pro-gated** feature (like nutrition dashboards / photo analysis).

## 2. The two hard constraints (these shaped the architecture — honor them)

1. **NO recipes, NO grocery list.** Explicitly dropped by the user. A plan is: days → named meals → food items (food + portion + macros) → per-meal & per-day totals vs target. Keep it focused.
2. **Macros must NOT be AI-estimated.** The AI may NOT invent grams/calories/macros. The model **designs** the plan (which foods, what gram portions); a **real nutrition database supplies the verified macros**, computed deterministically in code. This is the "fix accuracy at the data layer" principle (see user memory `chad-accuracy-fix-at-data-layer`). LLM-estimated macros run ~30% off — unacceptable here.

## 3. The core mechanic — how generation works (verified feasible)

There is **no autonomous agent loop.** Chad (Gemini) calls a tool; the tool's server-side `execute()` makes **one focused structured call to Opus 4.8**, then enriches the result with real macros. Two models, one user request.

**This pattern already runs in production** in this repo — `lib/ai/meal-analysis.ts:84-122` (`analyzeFoodPhoto`) is a server-side `generateObject({ model: getLanguageModel(...), schema, ... })` call returning schema-validated output. The meal-plan generator is the same shape with a different model id + schema. Also see `lib/ai/memory.ts` for another off-the-flagship-model server call.

**Confirmed:** `anthropic/claude-opus-4.8` is live on the Vercel AI Gateway (`https://ai-gateway.vercel.sh/v1/models`), and `getLanguageModel(modelId)` (`lib/ai/providers.ts:17`) is just `gateway.languageModel(modelId)` — any `"provider/model"` string routes. So `getLanguageModel("anthropic/claude-opus-4.8")` works directly.

### The generation pipeline (server-side)

```
1. Gather user context: active goal, nutritionTarget (or derive via Mifflin-St Jeor +
   protein floor if unset), latest weigh-in, memory profile, and the preferences
   (diet style, allergies, dislikes, meals/day, budget, cook-time).
2. Opus 4.8 generateObject call → returns a plan structure:
   days[] → meals[] → foodItems[] where each foodItem has:
     - name (human label, e.g. "Grilled chicken breast")
     - query (a clean canonical search term for the food DB, e.g. "chicken breast grilled")
     - grams (the portion the model chose to hit the target)
   The model is told the target macros and asked to choose foods+portions to hit them,
   honoring restrictions. It does NOT output final macro numbers (or if it does, we ignore them).
3. For each foodItem: query USDA FoodData Central, pick the best match, pull per-100g
   macros, scale by `grams`, compute cal/P/C/F in code. Store the matched FDC food id +
   description so the match is auditable/editable.
4. Sum per-meal totals and per-day totals in code. Compute actual-vs-target gap per day.
5. Save the fully-enriched plan to the `mealPlan` table.
```

**Honest caveat to handle:** matching the model's food name to an FDC entry is fuzzy. Use FDC's search endpoint, take the top reasonable match, **store the matched food id + description** so the user can see/correct it when editing. Real pro apps do exactly this.

**Macro accuracy stance:** real apps don't hit targets exactly either — they get close and disclose the gap. Show **actual vs target per day** honestly. v1 = one design pass + DB lookup; an optional second portion-adjustment pass is a phase-2 nicety, not v1.

## 4. Nutrition database — USDA FoodData Central

- **Why:** official US government DB, **free**, no ongoing cost, generous limits (~1000 req/hr on a free key), ideal for whole-food cooking which dominates these plans.
- **Setup (do first):** get a free API key at https://fdc.nal.usda.gov/api-key-signup.html. Add `USDA_FDC_API_KEY` to `.env.local` AND to Vercel prod env (team legion1) — note this in the handoff's "Prod env vars set manually" gotcha list so go-live doesn't forget it.
- **Endpoints:** `GET /v1/foods/search?query=...&api_key=...` (pick best match, prefer `dataType` SR Legacy / Foundation / Survey-FNDDS for generic foods), then read macros from the food's `foodNutrients` (Energy kcal #1008, Protein #1003, Carbs #1005, Fat #1004) per 100g and scale by grams.
- **Alternatives if FDC coverage feels thin on branded/restaurant foods:** Nutritionix (great NL + branded, paid tier) or Edamam. Don't switch unless FDC proves inadequate in testing — it's the free, no-lock-in default.
- **Caching:** cache FDC lookups by `query` (or matched food id) to cut latency and calls on regeneration. A simple in-DB or in-memory/runtime cache is fine.

## 5. Data model — new `mealPlan` table

Add to `lib/db/schema.ts` (then generate a Drizzle migration — this repo uses Drizzle + Neon; follow the existing migration workflow in `lib/db/`). Keep the existing `plan` table for TRAINING plans only; meal plans get their own home (their structure is fundamentally different from a markdown blob).

```ts
export const mealPlan = pgTable("MealPlan", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  userId: uuid("userId").notNull().references(() => user.id),
  title: text("title").notNull(),                 // "12-week cut — 2,200 kcal, 4 meals/day"
  status: varchar("status", { enum: ["active", "archived"] }).notNull().default("active"),
  source: varchar("source", { enum: ["user", "chad"] }).notNull().default("chad"),
  sourceChatId: uuid("sourceChatId"),
  // The targets this plan was built to hit (snapshot at generation time):
  targetCalories: integer("targetCalories"),
  targetProtein: integer("targetProtein"),
  targetCarbs: integer("targetCarbs"),
  targetFat: integer("targetFat"),
  // Generation inputs, so we can regenerate with the same constraints:
  preferences: json("preferences").notNull(),     // { dietStyle, allergies[], dislikes[], mealsPerDay, budget, cookTime, notes }
  coachIntro: text("coachIntro").notNull().default(""), // Chad's blunt voice intro / strategy explainer
  // The structured plan (DB-verified macros baked in):
  days: json("days").notNull(),                   // see shape below
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
export type MealPlan = InferSelectModel<typeof mealPlan>;
```

**`days` JSON shape** (define a Zod schema for this in `lib/validation/meal-plan.ts` and reuse it for both the generator output enrichment and edit validation):

```ts
days: [
  {
    label: "Day 1",                  // or "Training day" / "Rest day"
    meals: [
      {
        slot: "breakfast",           // breakfast | lunch | dinner | snack  (match existing MEAL_CATEGORIES)
        title: "Greek yogurt + berries + whey",
        foods: [
          {
            name: "Nonfat Greek yogurt",
            grams: 200,
            // macros below come from USDA FDC, computed in code — NOT from the model:
            calories: 118, protein: 20, carbs: 7, fat: 0,
            fdcId: 171284,           // matched USDA food, for audit/edit
            fdcDescription: "Yogurt, Greek, plain, nonfat",
          },
          // ...
        ],
        // per-meal totals (summed in code):
        totals: { calories: 350, protein: 35, carbs: 30, fat: 8 },
      },
      // ...
    ],
    // per-day totals + gap vs target (computed in code):
    totals: { calories: 2180, protein: 178, carbs: 190, fat: 70 },
  },
  // ...
]
```

**Plan length:** 7 days is the category standard. Generating 7 full days in one pass is the v1 target. If generation latency/output size is a problem in testing, fall back to generating day-by-day in a small loop (still one tool call from the user's perspective) — but try the single-pass first.

## 6. Queries (`lib/db/queries.ts`)

Mirror the existing plan/goal query patterns (owner-scoped with `and(eq(id), eq(userId))`):
- `createMealPlan(...)`, `getMealPlansByUserId(userId)`, `getActiveMealPlanByUserId(userId)` (latest active), `updateMealPlan(...)`, `deleteMealPlan(id, userId)`.
- The existing goal/plan queries live ~lines 942-1104 — copy their shape exactly.

## 7. The generator (`lib/ai/meal-plan.ts`)

New `"server-only"` module, modeled on `lib/ai/meal-analysis.ts`:
- `mealPlanDesignSchema` (Zod) — what Opus 4.8 returns (days/meals/foods with `name`, `query`, `grams`, NO trusted macros).
- `generateMealPlan({ userId, preferences, target, goalContext, memory })`:
  1. derive target if not provided (Mifflin-St Jeor BMR × activity; protein floor ~0.8–1 g/lb bodyweight; sensible carb/fat split),
  2. `generateObject({ model: getLanguageModel("anthropic/claude-opus-4.8"), schema: mealPlanDesignSchema, system: EXPERT_PROMPT, prompt: context })`,
  3. enrich every food via USDA FDC (new `lib/nutrition/fdc.ts` client), compute totals,
  4. also produce `coachIntro` (can be part of the same generateObject output — Chad's blunt voice, 2-4 sentences on the strategy),
  5. return the enriched `MealPlan`-shaped object (caller persists it).
- **`EXPERT_PROMPT`:** an expert sports-nutrition plan author. Demands exact gram portions, named meal slots, foods chosen to hit the target macros, respects diet style/allergies/dislikes, realistic and palatable, no repetition fatigue. Keep Chad's blunt voice only in `coachIntro`; the plan body is clean and professional. (See user memory `preserve-chad-edge` — don't soften Chad, but the plan tables themselves should read clean.)

## 8. Entry points — two, one generator

### a) In chat: `generateMealPlan` tool (`lib/ai/tools/generate-meal-plan.ts`)
- Mirror `lib/ai/tools/save-plan.ts`. Input schema = the preferences Chad gathered (or sensible defaults from memory/goal). `execute()` calls `generateMealPlan(...)`, saves via `createMealPlan`, returns `{ id, title, message: "Meal plan saved to your dashboard" }`.
- Register it in the chat route `app/(chat)/api/chat/route.ts`: add to `experimental_activeTools` (~lines 304-313) AND instantiate in the `tools` object (~lines 322-344), exactly like `savePlan`.
- **Latency:** generation + N FDC lookups takes time (likely 1-2 min). The tool call will sit "running" in chat — that's acceptable, but make sure the UI shows a clear in-progress state (Chad can say "Building your plan, give me a minute"). Confirm streaming/tool-call UI handles a long-running tool gracefully.

### b) On the dashboard: `/meal-plan` page with a "Generate plan" button + short preferences form
- New route `app/meal-plan/page.tsx` (Pro-gated, like `/nutrition`). Add to nav: `components/nav/standalone-header.tsx` `LINKS` array (~line 38) — e.g. `{ href: "/meal-plan", label: "Meal Plan", icon: <UtensilsCrossed/> }`. It auto-appears in desktop nav + mobile sheet + (optionally) the /today quick-actions grid.
- Preferences form (diet style, allergies, dislikes, meals/day, budget, cook-time) → server action → same `generateMealPlan(...)` → same table.
- Server actions in `app/meal-plan/actions.ts` mirror `app/nutrition/actions.ts` / `app/today/actions.ts` (use `requirePro()`, `revalidatePath`).

## 9. The viewer (`/meal-plan` + `components/meal-plan/...`)

A real document, not a cramped pop-up (learn from the s43 plan-viewer rebuild):
- Chad's `coachIntro` at the top.
- A day switcher (tabs or stacked cards) — each day shows its meals; each meal shows its foods (name · grams · macros), a per-meal macro line, and a per-day total **vs target** with a small bar/gap indicator.
- Honest "actual vs target" display per day.
- Reuse Streamdown only where free text is rendered (the intro); the plan body is structured React from the `days` JSON, not markdown.

## 10. Editing

- Edit any meal/food/portion. Editing a food's grams should re-pull/re-scale macros (or at least recompute from the stored FDC per-100g if cached). Owner-scoped server actions, like the goal/plan editors (`app/today/actions.ts` `updatePlanRecord` etc.).
- Allow archive/delete and "regenerate whole plan" (re-runs the generator with the saved `preferences`).

## 11. PDF download

- Extend the existing jsPDF exporter (`lib/pdf/goal-pdf.ts` → add `lib/pdf/meal-plan-pdf.ts` or a function alongside). Layout: cover (title + targets) → day-by-day tables (meal → foods → macros, day totals vs target) → footer branding. Same dynamic-import, client-side, "Chad" red branding pattern as the existing goal/plan PDFs.

## 12. One-tap "log as planned"

- A button on each planned meal writes a `mealAnalysis` row (`source: "manual"`, the right `meal` slot, `recordedAt` = today, title + macros from the planned meal) via the existing meal-create path (`app/nutrition/actions.ts` `logMealManually` / `createMealAnalysis`). This makes the plan flow straight into the food diary and the "Today's fuel" rings on `/today`. No new logging infra needed.

## 13. Chad prompt-awareness

- Summarize the active meal plan into Chad's system prompt like goals/plans already are (`lib/ai/memory.ts` `formatGoalsForPrompt` + injection in `app/(chat)/api/chat/route.ts` ~lines 225-231, and `lib/ai/prompts.ts` ~125-160). A compact summary: title, targets, today's planned meals. So Chad references it and holds the user to it. Keep it short (token budget) — full plan stays in the dashboard / `getDashboard` tool can fetch detail if needed.
- Add an "Ask Chad" deep-link button on the plan (`components/chad/ask-chad-button.tsx`) → `/?prompt=Adjust my meal plan...`.

## 14. Build order (suggested phases)

1. **Foundation:** USDA FDC key + `lib/nutrition/fdc.ts` client (search + macro extraction + caching), tested standalone. `mealPlan` schema + migration + queries.
2. **Generator:** `lib/ai/meal-plan.ts` (Opus 4.8 design call + FDC enrichment + totals). Test it produces a sane, accurate 7-day plan for a sample user from a script before any UI.
3. **Persistence + chat tool:** `generate-meal-plan` tool, registered in the chat route. Verify end-to-end in dev with the Pro test account that Chad can generate + save.
4. **Dashboard page + viewer:** `/meal-plan` route, nav entry, viewer rendering the structured days.
5. **Generate-from-dashboard form** + server actions.
6. **Edit, PDF, one-tap log, Chad prompt-awareness, Ask-Chad button.**
7. **Polish:** loading/in-progress states, mobile typography, empty states, error handling (FDC miss, generation failure → friendly message).
8. **Verify in dev (`:3100`, Pro test account — see memory `pro-test-account`), then VCPD-HN.**

## 15. Deferred to phase 2 (do NOT build in v1 — keep v1 shippable)

- Regenerate a **single meal** with auto-rebalance of the rest of the day.
- Second portion-adjustment pass to hit target more exactly.
- Weekly adaptive target recomputation (MacroFactor-style TDEE-from-trend).
- Branded/restaurant food coverage (Nutritionix/Edamam) if FDC proves thin.
- Training-day vs rest-day macro cycling (the `days[].label` field leaves room for it).

## 16. Key existing code to copy/lean on (proof patterns)

- `lib/ai/meal-analysis.ts` — **the** template for a server-side structured model call (`generateObject` + schema). Copy its shape for the generator.
- `lib/ai/providers.ts:17` `getLanguageModel` → `gateway.languageModel(id)`; `lib/ai/models.ts` for model-id conventions.
- `lib/ai/tools/save-plan.ts` + `save-goal.ts` — tool shape, registration, owner-scoping.
- `app/(chat)/api/chat/route.ts` ~225-344 — where context is fetched, prompt assembled, tools registered.
- `lib/ai/memory.ts` `formatGoalsForPrompt` + `lib/ai/prompts.ts` ~125-160 — prompt injection.
- `app/nutrition/page.tsx`, `app/nutrition/actions.ts`, `components/today/target-editor.tsx`, `components/today/macro-rings.tsx` — nutrition surfaces, target read/write, meal categories (`MEAL_CATEGORIES` / `MEAL_LABEL`).
- `components/today/plan-viewer.tsx` (s43 rebuild) — viewer/Streamdown patterns.
- `lib/pdf/goal-pdf.ts` — PDF export pattern (`downloadPlanPdf`).
- `components/nav/standalone-header.tsx` `LINKS` — where the new nav entry slots in.
- `components/chad/ask-chad-button.tsx` — deep-link button.

## 17. Setup checklist before coding

- [ ] Free USDA FDC API key → `USDA_FDC_API_KEY` in `.env.local` + Vercel prod (legion1) + add to handoff "prod env vars" gotcha.
- [ ] Confirm `anthropic/claude-opus-4.8` works from a quick `generateObject` smoke test (gateway already configured).
- [ ] Re-read user memories: `chad-accuracy-fix-at-data-layer`, `benchmark-against-pro-apps`, `stick-to-standard-patterns`, `preserve-chad-edge`, `copy-clear-not-punchy`, `pro-test-account`.
