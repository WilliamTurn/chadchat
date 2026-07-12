# Performance budget

Part of the Phase 1 contract layer (DSH-66). Later phases add charts, richer visuals, and cross-domain data to every page; without a budget, "visually rewarding" degrades into "slow and jumpy". These numbers are release criteria, measured, not vibes.

## 1. Core Web Vitals budgets (authenticated dashboard routes)

| Metric | Budget (p75) | Stretch target |
|---|---|---|
| LCP | <= 2.5s | <= 2.0s |
| CLS | <= 0.10 | <= 0.02 |
| INP | <= 200ms | <= 120ms |
| TTFB (Vercel, warm) | <= 800ms | <= 500ms |

## 2. Zero layout shift on data load (the CLS rule that matters here)

Dashboards load data after paint; the contract is that ARRIVING DATA NEVER MOVES THE PAGE:

- Every panel role reserves its height range (panels.ts heightRange) in its skeleton; the loaded panel lands inside the reserved box.
- Chart containers have a fixed height BEFORE the chart mounts (recharts renders client-side; the box exists first).
- Images (hero figure, meal photos) always carry explicit dimensions or aspect-ratio boxes.
- Fonts are preloaded/display-swap with metric-compatible fallbacks so text does not reflow.
- Week strips, badges, and toasts never push content when they appear; toasts overlay.

Check: a Playwright trace of first load + one mutation shows layout-shift score <= 0.02 on the dashboard.

## 3. Server data budget

- One parallel batch per page: the Today pattern (a single `Promise.all` of bounded queries) is the law. No sequential query waterfalls, no client-side fetch chains for first paint.
- Every dashboard query is bounded (LIMIT or windowed by date); "all history" queries are for depth-4 pages, paginated.
- Query count per dashboard render: <= 20 (Today currently ~16; new panels join the batch or share a query).
- Server render of Today (data + HTML, warm): <= 600ms p75.

## 4. Client JS budget

- Dashboard route first-load JS: **<= 350KB gzipped**, measured by `next build`'s route table. Phase 2 records the current baseline in its PR; later phases may not regress it by more than 10% without an owner-visible note.
- Charts and below-the-fold heavy modules load via dynamic import; the initial bundle carries at most the above-the-fold panels.
- No new client dependency > 30KB gzipped without a stated alternative considered.

## 5. Chart render budget

- A dashboard chart renders (mount to painted) in <= 50ms main-thread on a mid-tier device profile (Playwright CPU throttle 4x).
- Dashboard series are pre-aggregated server-side (daily buckets, bounded windows); raw-row processing in the browser is a violation.
- Charts below the fold render lazily (intersection-triggered) but their boxes reserve height from the start (rule 2).

## 6. Interaction budgets

- Tap feedback <= 100ms (motion contract); optimistic quick-adds commit UI-side immediately.
- Route transitions between dashboard pages <= 400ms to first content on warm navigation.
- No long task > 200ms during initial dashboard render.

## 7. How it is verified

- Phase 2 establishes the measured baseline (bundle sizes, LCP/CLS/INP on the fixture personas) and records it in the program tracker.
- Every later phase's QA slice re-runs the same measurements (Playwright traces + Lighthouse, driven by the delegated Opus testing agent per owner law) and diffs against baseline.
- P8 (GATE-06) requires the full table above green on production-like data before rollout.

## 8. Checkable rubric

- [ ] LCP / CLS / INP / TTFB within budget on the dashboard fixtures, both themes, desktop + 390px.
- [ ] Trace shows zero visible shift when data lands or a mutation completes.
- [ ] `next build` route table: dashboard first-load JS <= 350KB gz (or documented, owner-visible regression note).
- [ ] All dashboard queries bounded; one parallel batch per page.
- [ ] Charts height-reserved, lazily mounted below the fold, <= 50ms render on throttled profile.
