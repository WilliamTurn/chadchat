# `/today` Dashboard Overhaul — 4-Phase Plan (DSH-14)

> **Goal:** rebuild `/today` from a flat single-column stack into a premium,
> reference-grade dashboard — better *organized* (at-a-glance vital signs +
> equal-height card grids) and more *visually impressive* (domain colors, photos,
> goal body diagrams), using the real visual arsenal (`chadlatest/visual-capabilities.md`),
> NOT hand-rolled flat results.
>
> **Reference:** the user's mockup (`chadlatest/` desktop reference PNG) — a hero
> with 3 KPI chips, equal-height 3-up card rows, gauges everywhere, per-domain
> color, a brand hero figure, food photos, goal body diagram. We mirror its
> **organization + polish** but only for features we actually have (plus sleep,
> added in Phase 3). We skip: readiness score, achievements/medals, AI-coach-insight
> card, the unified "Today's Plan" timeline.
>
> **Process per phase:** screenshot the live `/today` (Pro test account at :3100)
> as ground truth → pull shadcn blocks / 21st Magic components → wire domain palette
> → Playwright screenshot-and-refine loop → tsc. **No** perfectionist/auditor agents
> (user opted out). Each phase is **one session**, shippable on its own (VCPDHN).

---

## Why phased

The user explicitly wants this split so no single session bloats its context. Each
phase below is self-contained, leaves the tree shippable, and is its own commit +
prod deploy + HN.

---

## Phase 1 — Global consistency (DSH-15) ✅ SHIPPED s75 (`c46b5b6`)

Pure consistency pass, no layout change — a clean base for the visual work.

- **US conventions:** `kcal` → `cal` across all dashboard / meal-plan / nutrition UI
  + the meal-plan PDF + the generated-title example; British → American spellings
  (`millilitres`→`milliliters`, `litres`→`liters`, `grey`→`gray`) in water-tracker
  aria-labels. **Deliberately left:** `lib/ai/*` (feeds Chad's context — changing it
  alters how Chad *speaks*, which is a prompt-wording change governed by the
  `preserve-chad-edge` rule; tracked separately, NOT silently changed here).
- **Nav fix:** `StandaloneHeader` desktop bar → a single non-wrapping **icon bar**
  (inactive = icon + tooltip/aria-label, active = icon + label inside the existing
  `layoutId` sliding pill). Was a `flex-wrap` full-label row that wrapped to a ragged
  second line at the page's narrow `max-w-4xl` width. Mobile sheet untouched.
- **Action-verb convention** (apply going forward on every card):
  **View** = navigate to a fuller screen · **Log** = add a data point ·
  **Edit** = change a target/setting · **Add** = create an entity (goal/plan) ·
  **Ask Chad** = AI. Fixed on `/today`: "All workouts" → "View all",
  "Log progress" → "Log weight". (Other pages adopt it as they're touched.)

## Phase 2 — Image pipeline + asset generation (DSH-16) ⬜

Front-loads every asset the visual phase consumes. Output is just a script + PNGs
in `/public` — zero UI risk.

- Add `OPENAI_API_KEY=...` to `chadchat/.env.local` (gitignored — never commit;
  the user pasted the key in plaintext chat, so flag a rotate-later).
- Create `scripts/gen-image.mjs` per the user's spec: `POST https://api.openai.com/v1/images/generations`,
  model **`gpt-image-2`**, reads key from `.env.local`, decodes `b64_json` → `.png`.
  Args: `node scripts/gen-image.mjs "<prompt>" out.png [size] [quality]`; env overrides
  `IMG_MODEL`, `IMG_TRANSPARENT=1`. Sizes 1024x1024 / 1536x1024 / 1024x1536.
- Generate + curate, on the blood-on-ink brand:
  - **Brand hero figure** for the header (lit muscular figure on ink, like the reference).
  - **4 goal body diagrams** — recomp / fat loss / muscle gain / maintenance — one
    consistent anatomical figure, recolored/annotated per goal (transparent cutouts).
  - **Food photos** for the meal-plan / nutrition cards (real-food, premium-lit).
- Map goal → diagram (the goal's `metric`/intent picks the figure for Phase 4's GoalList).

## Phase 3 — Sleep tracker (DSH-17) ⬜

The one genuinely net-new vertical (the user confirmed they want it). Ships as a
working card in the *current* layout; Phase 4 arranges it.

- **Schema + migration:** new `SleepEntry` table (user, date noon-UTC per `lib/date.ts`,
  minutes asleep, optional quality/score). Follow the Drizzle migration flow
  (`db:generate` → applied to shared Neon). **Coerce date columns to `Date`** — recall
  DSH-13: raw `sql<Date>` returns strings.
- **Query + action:** `getSleepSince` / latest; a log server action.
- **Card:** "Sleep & Recovery" — last night's hours + score + a 7-bar week chart, built
  on the existing `recharts` + `components/dashboard/chart-card` system (NOT hand-rolled SVG).
- **Activity integration:** union sleep into `getActivityDaysSince` so logging sleep
  keeps the streak alive (mirror the meal/workout/water/weigh-in pattern).
- Pro-gate consistent with the other tracked surfaces; US conventions (Phase 1) apply.

## Phase 4 — Dashboard reorg + visual overhaul (DSH-18) ⬜ — capstone

The organization + polish win, with everything from Phases 2–3 available. Done last so
it arranges the *final* card set in one pass.

- **KPI vital strip:** wire the already-built `components/today/stat-pills.tsx` (currently
  untracked WIP, real-data only — calories / weight-change / active-days) in under the hero.
  Extend/retone as needed (domain colors already use `--chart-*` oklch).
- **Regroup into equal-height grids:** collapse the three stacked full-width cards
  (Last workout, Meal log, Meal plan) + the Hydration/Weight pair into tidy 3-up rows
  like the reference, instead of a long ragged vertical stack. Lock per-row heights.
- **Visual polish:** broaden per-domain `--chart-1..5` accents (underused today); icon
  chips in colored rounded squares; brand hero figure in the header; **goal body diagram**
  in GoalList (Phase 2 asset, picked by goal type); **food-photo thumbnail** on the
  meal-plan card; day-pills on the training card.
- Keep surfaces dark/restrained — color is an *accent* (brand: blood `#a4161a` on ink).
- Honest empty states preserved (no invented metrics).

---

## Notes / guardrails

- **Stack:** Next 16 (Cache Components — wrap request-time data in `<Suspense>`, no
  `export const dynamic`), React 19, Tailwind v4, shadcn/ui, recharts 3.9, motion.
  Tremor npm pkg is v3-only → use copy-paste Tremor if needed.
- **Theme tokens:** `chadchat/app/globals.css` — `--chart-1..5` (violet/emerald/amber/
  purple/red) are the on-brand domain palette; use them, don't introduce a rainbow.
- **Verify** each phase e2e on the Pro test account (`claude-testing@example.com` /
  `12345678`) at :3100 (shared Neon — clear cookies first; clean up any seeded test rows).
- **Meal-plan title** "X kcal cut" is stored model output; only *new* plans pick up the
  `cal` example from Phase 1 — historical titles aren't rewritten.
