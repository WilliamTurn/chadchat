# Weight Tracker / Dashboard Overhaul — Build Spec

> **For a fresh high-context build session.** This continues s44's groundwork — it does **not** start from scratch. s44 already added the charting engine and a working interactive POC; this spec turns that POC into the finished, reusable thing. Read it top to bottom, then build.
>
> Sibling spec for reference style: `meal-plan-feature-spec.md`. Backstory: `../chadlatest/handoff-archive.md` (s44 entry).

---

## 0. TL;DR

The weight tracker was "useless / not interactive" because every chart in the app is hand-drawn server-rendered SVG — no charting library, so hover/zoom/scrub were architecturally impossible. s44 fixed the foundation: installed **recharts 3.9.0** + the **shadcn chart primitive** (`components/ui/chart.tsx`) and shipped a verified interactive POC (`components/progress/weight-chart-interactive.tsx`).

**This session does two things:**
1. **Perfect the weight tracker** into a genuinely best-in-class trend view (benchmark: MacroFactor / TrendWeight / Happy Scale).
2. **Extract a reusable dashboard-chart pattern** so every other chart in the app (1RM, nutrition, water, `/today`) can be upgraded the same way without re-inventing it.

Ship #1 + #2 as one pass. Fanning the pattern out to the *other* dashboards is a deliberate follow-up session (see §8).

---

## 1. Current state (what s44 left)

**Installed / added (uncommitted in chadchat `main` working tree):**
- dep: `recharts@3.9.0`
- `components/ui/chart.tsx` — shadcn chart primitive (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartStyle`). Recharts-3 compatible. **Use this; don't re-add via CLI.**
- `components/progress/weight-chart-interactive.tsx` — the POC (client component).
- `app/progress/page.tsx` — swapped to use the POC (import + usage only).

**The POC already does:** EMA-less centered moving-average trend Area (brand blood `#a4161a` + gradient) over faint raw weigh-in Line+dots; hover-any-day tooltip; range toggle 1M/3M/6M/All; KPI header (Current / Change / Rate, toward-goal colored); dashed goal line + "X to go"; time-scaled x-axis.

**The POC's known gaps (this spec fixes all of them):**
- Trend uses a **centered SMA** — degrades at the right edge (most recent days, the part users care about most) and isn't gap-aware for irregular weigh-ins. → switch to gap-aware **EMA** (§4.2).
- Tooltip label↔value spacing is tight.
- `/progress` shows **two summaries** — the old page-level `SummaryCard` grid (Current / Since start / Entries) AND the chart's KPI header — with conflicting change numbers (raw −12.4 vs trend −6.3). → one source of truth (§5).
- No hover crosshair, no projection/ETA, no real empty/sparse states, no deliberate mobile pass.

**Test data:** 8 seeded weigh-ins exist on `claude-testing@example.com` (Apr 20→Jun 22 2026, 212.4→199.4 lb, descending w/ noise) in the shared Neon DB. Use them; delete via History rows when done if desired.

---

## 2. Definition of done (the bar)

A user opening `/progress` should, in under 3 seconds, understand: **where am I, which way am I going, how fast, and will I hit my goal.** Concretely:

- **One** clear KPI header (no duplicates), trend-based, toward-goal colored.
- A trend line that's **smooth and trustworthy at today's edge** (EMA), with raw weigh-ins visible but de-emphasized.
- **Scrub interaction**: moving the cursor (or finger) shows a crosshair + a tooltip reading that day's weigh-in and trend. Works on touch.
- **Range toggle** that only offers presets the data span supports; default to the most useful populated range (§4.4).
- **Goal awareness**: goal line + "X to go" + (when moving toward goal at a real rate) a **projected date** ("on track for 180 lb ≈ Sep 14").
- **Honest sparse/empty states** (§4.6) — never a broken or lonely single dot.
- **Mobile-perfect**: KPIs wrap cleanly, chart stays legible, scrubbing works by touch.
- Visually indistinguishable in quality from a paid fitness app. Dark "ink" theme is the primary surface; light must also be clean.

---

## 3. The reusable pattern (build this, not a one-off)

The real win is a **shared chart-card system** so weight, 1RM, nutrition, water all look and behave identically. Create:

**`components/dashboard/chart-card.tsx`** — the shell. Props:
```ts
{
  title: string;
  askChadPrompt?: string;          // renders the existing <AskChadButton> if set
  range?: RangeControlProps;        // optional segmented range toggle (renders only if presets exist)
  kpis?: ReactNode;                 // the KPI strip slot
  footer?: ReactNode;               // e.g. goal caption
  children: ReactNode;              // the chart itself
  className?: string;
}
```
Owns: the `rounded-2xl border border-border bg-card p-6` card chrome, the title row (+ optional Ask-Chad button), the KPI strip layout (wraps to 2-col on mobile), the range toggle styling, and consistent spacing. Every dashboard chart becomes `<ChartCard …><SomeRechartsThing/></ChartCard>`.

**`components/dashboard/kpi.tsx`** — the KPI stat (label + value + tone: `neutral|good|bad`, `tabular-nums`). Lift from the POC's `Kpi`.

**`hooks/use-chart-range.ts`** — range state + preset filtering. Input: the full series + `tFn`. Returns `{ range, setRange, presets, rows }`. Lift the POC's range logic; make it generic (operates on `{ t: number }[]`).

**`lib/chart/trend.ts`** — pure math: gap-aware EMA, rate-per-week, projection-to-target, range filtering. Unit-testable, no React. (§4.2)

**`lib/chart/format.ts`** — shared formatters (date tick, signed delta, rate string). Reuse `formatCalendarDayMs` from `lib/date.ts` (UTC-stable — important, see §9).

After this exists, `weight-chart-interactive.tsx` should shrink to: compute series → `useChartRange` → `<ChartCard>` wrapping a `<ComposedChart>`. That's the proof the abstraction is right.

---

## 4. Weight tracker — detailed UX

### 4.1 Layout (top → bottom, inside one ChartCard)
1. **Title row:** "Weight trend" + Ask-Chad button (keep existing prompt).
2. **KPI strip** (single source of truth — see §5): **Trend weight** (today's EMA, the headline number, big) · **Change** (over selected range, trend-based, toward-goal colored) · **Rate** (lb or kg per week, toward-goal colored) · **To goal** (remaining + projected date when applicable).
3. **Range toggle** (right-aligned with KPIs on desktop; below on mobile).
4. **Chart** (§4.3).
5. **Footer caption:** goal line legend / "goal reached 🎯" when hit.

### 4.2 Trend math (`lib/chart/trend.ts`) — the key accuracy upgrade
Use a **gap-aware exponential moving average** (what TrendWeight/MacroFactor do), not centered SMA:
```
tau = 10 (days)                       // smoothing time-constant; tune 7–14
trend[0] = weight[0]
for i>0:
  dtDays = (t[i] - t[i-1]) / DAY
  alpha  = 1 - exp(-dtDays / tau)
  trend[i] = trend[i-1] + alpha * (weight[i] - trend[i-1])
```
Why: EMA is defined right up to the latest weigh-in (centered SMA isn't), handles irregular spacing via `alpha`, and matches what serious fitness apps show. Expose:
- `ema(points, tau)` → trend series
- `ratePerWeek(rows)` → `(trendLast − trendFirst) / spanDays * 7`
- `projectToGoal(currentTrend, ratePerDay, goal)` → `{ days, dateMs } | null` (null if rate ≈ 0 or moving away)

### 4.3 Chart (Recharts `ComposedChart`)
- **Trend Area**: EMA, blood `#a4161a`, `strokeWidth 2.5`, gradient fill (lighten the POC's fill a touch — it reads heavy).
- **Raw weigh-ins**: faint Line (`var(--color-weight)` ≈ muted, opacity ~0.3) + small dots; active dot on scrub.
- **Goal**: dashed `ReferenceLine` (emerald), label "Goal {n} {unit}". Keep it inside the padded y-domain.
- **Axes**: `XAxis type="number" scale="time"` (keep — fixes uneven spacing), `minTickGap` to avoid crowding; `YAxis` padded domain incl. goal, ~5 ticks, thin.
- **Scrub**: enable hover crosshair (Recharts `Tooltip cursor` + a vertical reference). Tooltip: bold date (e.g. "May 18, 2026"), then "Weighed in: X" and "Trend: Y" with proper label↔value gap (fix the tight spacing — give the tooltip row `justify-between` breathing room / min-width).
- **Touch**: ensure tooltip/scrub works on touch (Recharts handles via touch events; verify on a mobile viewport).
- **Animation**: subtle on first mount, off on range change (avoid reflow jank). Respect `prefers-reduced-motion`.

### 4.4 Range default
Default to the **largest preset that contains ≥ ~8 points**, else "All". (Most users want recent-but-meaningful, not a 2-point zoom.) Only render presets whose window is < full span (POC already does this).

### 4.5 Units
Keep the existing lb/kg conversion in the page (`convert`, `displayUnit`). Chart stays unit-agnostic; label from prop.

### 4.6 States
- **0 weigh-ins:** keep the page's existing "Log a weight and your trend shows up here" prompt (don't render an empty chart).
- **1 weigh-in:** show the big current number + "Log again to see your trend" — no line, no rate.
- **2–4 weigh-ins:** show the chart + Change, but **suppress Rate/projection** (too noisy to be honest). Show a quiet "trend sharpens with more data" hint.
- **≥5:** full treatment.

---

## 5. Reconcile the duplicate summaries (do not skip)
- **Remove** the page-level `SummaryCard` grid in `app/progress/page.tsx` (Current / Since start / Entries) — the chart card's KPI strip replaces it.
- Single source of truth = **trend-based** numbers over the selected range. Drop the raw "Since start" (noisy). If you want an entries count, demote it to a small caption on the History section, not a headline stat.
- Result: one set of numbers, no contradiction.

---

## 6. Files

**Create:**
- `components/dashboard/chart-card.tsx`
- `components/dashboard/kpi.tsx`
- `hooks/use-chart-range.ts`
- `lib/chart/trend.ts`
- `lib/chart/format.ts`

**Edit:**
- `components/progress/weight-chart-interactive.tsx` — refactor onto ChartCard + EMA + scrub + states + projection. (Rename to `weight-chart.tsx` and delete the old static one **only after** confirming `today/page.tsx`'s usage is migrated or unaffected — see below.)
- `app/progress/page.tsx` — remove `SummaryCard` grid; pass the goal/projection data the KPI strip needs.

**Check / decide:**
- `components/progress/weight-chart.tsx` (old static SVG) — still imported by `app/today/page.tsx`. Either leave it for the follow-up session or migrate `/today`'s mini weight view to a compact `ChartCard` variant now. Recommendation: leave `/today` for the fan-out session to keep this PR focused.

**Keep untouched this session:** `components/workouts/exercise-trend-chart.tsx` (1RM) and `/nutrition`, `/workouts`, water — those are the fan-out (§8).

---

## 7. Tooling to actually use (don't design blind)
- **Playwright MCP** screenshot-verify loop on `:3100`, logged in as the Pro test account (`claude-testing@example.com` / `12345678`, clear cookies first; same Neon DB so the 8 seeded weigh-ins are there). Screenshot dark + light + a 390px mobile viewport after each meaningful change.
- **Magic MCP (21st.dev)** to generate candidate KPI-strip / card layouts if you want options before settling.
- **visual-quality-auditor** agent for a polish pass once it's functionally done — feed it the screenshots.
- Benchmark targets to mirror: MacroFactor (trend + rate + expenditure framing), TrendWeight (EMA + projection), Happy Scale (clean mobile scrub).

---

## 8. Rollout scope (phasing)
- **This session (A):** weight tracker perfected + the reusable `ChartCard`/`Kpi`/`useChartRange`/`trend`/`format` primitives. Shippable alone.
- **Follow-up session (B):** fan the pattern out — `exercise-trend-chart.tsx` (1RM), `/today` mini-charts (incl. the compact weight view), `/nutrition` macro charts, water. Each becomes a `<ChartCard>`.
- Don't try to do B inside A — A's value is the perfected weight view + a proven, reusable abstraction.

---

## 9. Gotchas (read before coding)
- **Tailwind v4, CSS-first (no `tailwind.config.js`).** Do **NOT** `pnpm add @tremor/react` — it's Tailwind-v3-only and will render unstyled / break the build. If you want Tremor's KPI/card looks, **copy-paste** the component source (Vercel-owned Tremor is copy-paste and v4-safe). The shadcn chart primitive + your own ChartCard already cover what's needed; Tremor is optional inspiration only.
- **Client component required.** Interactivity is impossible in the old server-SVG approach. Chart components must be `"use client"`. The page (`app/progress/page.tsx`) stays a Server Component fetching data inside `<Suspense>` (Cache Components is ON — no `export const dynamic/runtime`).
- **UTC date convention.** Picked days are stored at noon UTC and displayed in UTC. Use `formatCalendarDayMs` / `formatCalendarDay` from `lib/date.ts` for all ticks/tooltips — never raw `toLocaleDateString` (would shift the day by timezone). This is the systemic UTC bug; don't reintroduce it.
- **Data source:** `getProgressEntriesByUserId(userId)` returns `ProgressEntry[]` oldest-first; the page already maps to `points: {t, weight}[]` in `displayUnit`. `goalWeight` comes from `weightGoalTarget(goals, displayUnit)`.
- **Recharts 3 + React 19 + Next 16:** `ResponsiveContainer` is wrapped by `ChartContainer` already; pass `config` with literal colors (`#a4161a`) or CSS vars (`var(--color-blood)`), both defined in `globals.css`.
- **Don't bloat `/today`'s bundle** if you do touch it — the chat-adjacent routes are kept light.

---

## 10. Verify → ship
1. `pnpm exec tsc --noEmit` → exit 0.
2. Playwright loop: dark + light + mobile (390px), with the seeded data; confirm scrub/tooltip/range/empty-sparse states.
3. visual-quality-auditor pass on the screenshots; fix findings.
4. Then **VCPD-HN**: Verify, Commit, Push (`main`), Deploy (Vercel auto on push; confirm READY at app.chadcoach.ai), then HN. (chadchat prod deploys from `main`.)

## 11. Out of scope (don't gold-plate)
- No new DB columns (EMA is computed, not stored).
- No weight-entry UX changes (the log form is fine).
- No predictions beyond a simple linear rate projection.
- The other dashboards (that's session B).
