# P34-B / FIX-03: side-by-side grade vs the benchmark

Graded 2026-07-13 against the 15-point convention checklist in
`url-state-teardown.md` (Stripe Dashboard = URL architecture bar, Linear =
filter-tier discipline bar, nuqs/TanStack/Next = mechanics bar). Grade scale
per the FIX-40 rule: MATCH or better on every applicable line, or it fails.
Functional proof for the PASS claims: `verification.md` (Opus node-Playwright
run) + `tests/unit/url-state.test.ts`.

| # | Convention | Grade | How this implementation meets it |
|---|---|---|---|
| 1 | Every meaningful view is a shareable URL | MATCH | All 8 route families: filtered exercise catalog (`/workouts/exercises?q=press&muscle=chest`), diary day (`/nutrition?day=`), chart ranges (`?range=`, `?range=custom&from&to`), PR drill-down (`?pr=`), open report (`?report=`). Detail pages were already ID-addressable routes (`/workouts/history/[id]`, `/goals/[id]`, `/plans/[id]`) |
| 2 | Params omitted at defaults | MATCH | `enumParam`/`textParam`/`idParam` serialize `null` at the default; `applyParams` deletes on null. `?muscle=all`, `?metric=calories`, empty `?q=` never appear. Chart `range` stays explicit once touched because its default is data-dependent (the tightest preset holding >= minPoints), not a stable constant; a data-dependent default cannot be safely omitted (the same URL would mean different windows as data grows), matching Stripe keeping explicit date filters |
| 3 | Replace within a burst; push for view changes | MATCH | `useUrlParam` defaults to `replaceState`; search typing and range/filter/metric clicks never add history entries. Push is reserved for open-a-panel state (`?pr=`, `?report=`), so Back closes what the member just opened (the nuqs convention verbatim). Day paging on /nutrition is real Link navigation (data changes server-side), so Back walks days |
| 4 | URL write throttled, UI instant | MATCH | Exercise search: local state updates per keystroke, URL write debounced 350ms; verified zero history entries for a full typing burst |
| 5 | List -> detail -> Back restores filters AND scroll | MATCH | Filters/ranges rehydrate from the URL on back; scroll is Next.js-native and verified in `verification.md` (check 15). No virtualized lists exist on the wired routes, so the documented App Router clamp race does not bite; server-rendered list heights are deterministic |
| 6 | Cosmetic prefs stay out of the URL | MATCH | Weight unit, theme, report schedule remain account-level; collapsible day groups on /nutrition stay server-deterministic. Only the meaningful query travels (Linear's split) |
| 7 | Saved views with stable URLs | N/A | No saved-view feature exists in the product; ad-hoc filter URLs are the only tier. Noted for P5+ if Progress grows saved views |
| 8 | Readable tokens, not epochs | MATCH | Range tokens `1w/1m/3m/6m/1y/all` (the member-facing control labels), days as `YYYY-MM-DD`. Zero epochs in any URL (beats Stripe's own `created[gte]=` epochs, per the teardown's own note) |
| 9 | Arrays serialize readably | N/A | No multi-select filters on the wired routes; the grammar doc reserves comma-delimited lists for when one appears |
| 10 | Invalid params fail safe | MATCH | Every param goes through a codec: `?range=banana`, `?metric=%%%`, `?day=2026-02-31` (Date.parse rollover caught by round-trip check), `?pr=nonexistent` all render defaults; unit-tested (13/13) + browser-tested |
| 11 | One typed schema, single source | MATCH | `lib/url-state.ts` owns parse/serialize; no component reads raw strings for wired params. The two chart hooks compose through it |
| 12 | Shallow unless server data changes | MATCH | All filter/range/panel params write via `window.history` (no RSC round-trip, marker-verified in check 16); `/nutrition?day=` deliberately stays a real navigation because the diary's data is server-fetched per day |
| 13 | Mode/scope in the path | MATCH | DEC-02 applied: Progress categories are real routes (`/progress/body`), never `?tab=`; helpers read `usePathname()` at write time so category pages inherit the grammar unchanged when P5 builds them |
| 14 | Sensitive deep links minted server-side | MATCH | Nothing access-bearing was added to any URL; auth stays session-cookie-gated; share/quit links remain their existing server-minted routes |
| 15 | One canonical URL per state | MATCH | `applyParams` preserves existing param order, sets/deletes in place, omits defaults; revert-to-default restores the clean URL |

Verdict: MATCH or better on all 13 applicable lines (2 N/A: features the product does not have). The two teardown-flagged failure modes for Next.js dashboards — per-keystroke history pollution and list->detail->Back loss — are the two things explicitly machine-verified (checks 9 and 15 in `verification.md`).
