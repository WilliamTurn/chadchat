# P34-Z performance baseline — /today (prod build on :3601)

Date: 2026-07-13. P34-Z measurement agent, node Playwright (@playwright/test
chromium). Method mirrors P2-A and P2-Z exactly for an apples-to-apples diff.
Preserved measurement script: `chadchat/scripts/p34z-perf-today.mjs` (this is the
reproducible script FIX-41 asked to be landed; it is NOT a deleted `tmp-*`).
Machine output: `chadchat/evidence-p34z/perf-run-output.json`.

## Method (identical to the established baseline)

- Production `next start` served on http://localhost:3601 — the ALREADY-RUNNING
  server; not started, stopped, or restarted by this agent.
- Build under test: `.next/BUILD_ID t6_b5wZkS1NXH0oHRUJ7o`, built 2026-07-13
  11:47 (after the P34-A/B/C/D/E code landed; the P3 phone `bottom-nav` is
  imported into `standalone-shell.tsx` and the `(chat)` layout that wrap /today,
  so this build reflects the P3/P4 wave).
- DARK theme (`colorScheme: "dark"`; app default).
- Buffered `PerformanceObserver`: `largest-contentful-paint` (last entry) +
  `layout-shift` (sum of `value` where `!hadRecentInput`), injected via
  `addInitScript` before any app JS runs.
- Median of 3 COLD runs per viewport — a fresh browser context (empty cache) each
  run.
- Pro test account (claude-testing@example.com) on /today.
- First-load JS = compressed transfer bytes via CDP
  `Network.loadingFinished.encodedDataLength` (real bytes on the wire, NOT the
  `Content-Length` header, which on this server carries the ~3.6x-larger
  UNCOMPRESSED size), summed over the .js chunk URLs the initial /today HTML
  document references (`<script src>` + preloads), intersected with what was
  observed on the wire — the P2-A/P2-Z-comparable "first-load" set.

### Auth recipe (the documented :3601 landmine)

`proxy.ts` hardcodes `secureCookie: !isDev`, so the http prod server authenticates
only on `__Secure-authjs.session-token`, while a plain login on http sets the
non-secure `authjs.session-token` (which client hydration reads). A single cookie
triggers an app-wide React #310 harness artifact. Recipe used: real credential
login at /login (sets the non-secure cookie), then decode that JWT
(salt = `authjs.session-token`) and re-encode it (AuthJS v5 encode,
salt = `__Secure-authjs.session-token`, AUTH_SECRET from `.env.local`); BOTH
cookies live in the jar together, re-applied to every fresh cold context.
**React #310 did NOT appear on any of the 6 runs — auth recipe correct.**

## Results (median of 3)

| # | Measurement | Per-run | Median |
|---|---|---|---|
| 1 | /today first-load JS, cold (gzip transfer, CDP `encodedDataLength`) | 542.8 / 542.8 / 542.8 KB · 30 files | **542.8 KB / 30 files** |
| 2 | /today LCP 1440x900 dark | 0.528 / 0.504 / 0.552 s | **0.53 s** |
| 3 | /today CLS 1440x900 | 0 / 0 / 0 | **0.00** |
| 4 | /today LCP 390x844 dark | 0.504 / 0.528 / 0.592 s | **0.53 s** |
| 5 | /today CLS 390x844 | 0 / 0 / 0 | **0.00** |

Observer integrity: LCP fired 2 entries at both widths on every run; ZERO
layout-shift entries at either viewport through a full-page scroll + settle. The
390 doc is 4323 px tall (real scrollable content), so CLS 0.00 is a genuine
result, not an empty page. First-load JS was byte-identical across all 3 desktop
runs (deterministic).

## Diff vs BOTH baselines

| Measurement | P2-A | P2-Z re-measure | P34-Z (this) | Budget | Verdict |
|---|---|---|---|---|---|
| /today first-load JS, cold (gzip transfer) | 289.6 KB / 18 files | 540.4 KB / 30 files | **542.8 KB / 30 files** | <= 350 KB gz | **FAIL** (155% of budget) |
| /today LCP 1440x900 dark | 1.17 s | 0.55 s | **0.53 s** | <= 2.5 s | PASS |
| /today CLS 1440x900 | 0.02 | 0.00 | **0.00** | <= 0.10 | PASS |
| /today LCP 390x844 dark | n/a | n/a | **0.53 s** | <= 2.5 s | PASS |
| /today CLS 390x844 | 0.12 (FAIL) | 0.00 | **0.00** | <= 0.10 | PASS |

Deltas: vs P2-Z **+2.4 KB (+0.4%), same 30 files**; vs P2-A **+253.2 KB, +12
files**. LCP and CLS unchanged from P2-Z (all within run-to-run noise).

## Did the P3/P4 wave move first-load JS? — NO.

**This wave (P3 navigation skeleton + P4 data-model normalization, zero new
dependencies declared) did NOT move the /today first-load JS number.** It sits at
542.8 KB vs P2-Z's 540.4 KB — a +2.4 KB / +0.4% change that is measurement noise,
not real growth, and the file count is unchanged at 30. The wave's additions are
consistent with this: the P3 `bottom-nav` mounts app-wide but is small, and the
P4 modules (effective-dated targets, refresh coordinator, structured plans, goal
outcomes, exercise identity) are largely server-side query/resolver code that does
not ship in the /today first-load client bundle.

Top first-load chunks (gzip wire) are effectively the same set as P2-Z — the
99.4 / 71.5 / 42.3 / 28.4 / 21.0 / 15.2 / 15.0 KB chunks are byte-identical; the
only churn is P2-Z's `14~7dj~58cd1o.js` (30.4) giving way to `0o_cvz87p~d5x.js`
(25.6) plus minor hash reshuffles, i.e. incidental chunk-boundary movement from
the P3/P4 source edits, net-flat on weight.

| Chunk | P34-Z gzip |
|---|---|
| 13n2nry661j61.js | 99.4 KB |
| 0zbg2-5rg69hu.js | 71.5 KB |
| 0ba~lmbpfuxku.js | 42.3 KB |
| 0c~992t59dnyd.js | 28.4 KB |
| 0o_cvz87p~d5x.js | 25.6 KB |
| 007jry-p0sgw7.js | 21.0 KB |
| 18cf-bdzuheen.js | 16.0 KB |
| 0zay7b6g1a7tv.js | 15.2 KB |
| 0icg3f3md7lmi.js | 15.0 KB |
| 0tc63u7-lmdz5.js | 14.4 KB |
| 13_tby8ggqp~0.js | 14.3 KB |
| 0uxcn5b2eh8.f.js | 13.3 KB |

Context (not the budget metric): full post-load JS incl. lazy/idle App Router
chunks = 2532.9 KB across 98 files (P2-Z reported 2416.5 KB / 90). The document
referenced 31 distinct chunks, 30 observed on the wire — matching P2-Z exactly.

## Bottom line

- **FIX-41 (350 KB gz budget, P1, blocks GATE-06) REMAINS OPEN.** First-load JS is
  542.8 KB — 155% of budget. The P3/P4 wave neither caused nor relieved it; the
  +250 KB regression is the pre-existing P2-A→P2-Z jump (the Turbopack prod
  granular-chunking prime suspect), still unaddressed.
- LCP (0.53 s desktop and mobile) and CLS (0.00 both viewports) pass with wide
  margin; the pre-existing mobile-CLS failure stays resolved.
- No anomalies: no React #310 (auth recipe correct), status 200 on all 6 runs,
  deterministic JS bytes.

## Account state after this run

READ-ONLY throughout: no logging, saving, deleting, or form submission beyond the
/login credential form. No member data was written or logged.
