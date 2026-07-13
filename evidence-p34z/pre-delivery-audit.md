# P34-Z Pre-Delivery Audit (DSH-66 / P3+P4 wave)

Date: 2026-07-13
Env: dev server http://localhost:3600 (reused, not restarted), shared prod Neon DB.
Method: node Playwright scripts (`scripts/p34z-audit-*`), read-only. Pro test account
claude-testing@example.com; showcase account stellarluxedecor@gmail.com used read-only
(no workouts saved, no member data mutated). Screenshots in `evidence-p34z/audit/`.
HEAD under test: `3728c74` (FIX-20 grouped nav + FIX-21 phone bottom nav), tip of the
P34 wave stack over `9e0cdb1` (P2-z close).

## FINAL VERDICT: SHIP

Every changed surface and its siblings pass. No P1 blockers. Two minor P3 findings and
one pre-existing owner-law (em-dash) finding that is NOT introduced by this wave and is
already scoped to the site-wide COPY-1 purge — none block the wave push.

---

## Per-surface verdicts

### 1. Desktop grouped nav (FIX-20) @1440, both themes — PASS
- Standalone shell sidebar (`/progress`) and chat sidebar (`/`) both render the
  registry-driven grouped nav: uncaptioned primary block (Dashboard, Chat), then
  captioned groups **TRACK** (Workouts, Calorie Tracker, Hydration, Sleep), **PLAN**
  (Goals, Meal Plan), **REVIEW** (Progress, Future You, Weekly Report), then an
  uncaptioned utility block under a hairline rule (Rate My Kitchen, Files, Plans & pricing).
- Group labels are 12px caps, muted; active row (Progress) shows the brand-red icon +
  emphasis. Matches the Stripe/Linear grouped-nav reference pattern in
  `evidence-p34a/benchmark-ranking.md`; indistinguishable-or-better bar met.
- Both themes: correct contrast, no overflow. Zero console errors on `/progress` and `/`
  in both themes. No sub-44px targets in the nav.
- Evidence: `desktop-standalone-nav-dark-1440.png`, `desktop-standalone-nav-light-1440.png`,
  `desktop-chat-nav-{dark,light}-1440.png`.

### 2. Mobile bottom nav (FIX-21) @390, dark+light — PASS
- 5 tabs: Today (active: red icon + bold label + `aria-current=page`), Log (prominent
  red filled plus-circle, slot 2), Progress, Coach, More. Fixed bottom, h≈60px bar,
  frosted (bg /0.95 + `blur(8px)`), z-40.
- Touch targets 77–79 × 60px — all ≥44px. Zero horizontal overflow at 390px, both themes.
- Log drawer: bottom sheet "What do you want to log?" with 5 options (meal, water, sleep,
  weigh-in, workout), Close affordance, drag handle, scrim. **No input autofocus** on open
  (active element is the dialog container DIV) — complies with "nothing starts uninvited."
- More sheet: same grouped structure as the desktop sidebar (TRACK/PLAN/REVIEW + hairline
  + utility), icon+label rows, Close. No autofocus.
- Matches the m.youtube tab-bar reference (56–60px frosted bar, icon+label, filled active
  glyph); our 13px labels clear the FIX-19 12px a11y floor. Pass bar met.
- Evidence: `mobile-today-{dark,light}-390.png`, `mobile-log-drawer-{dark,light}-390.png`,
  `mobile-more-sheet-{dark,light}-390.png`.

### 3. URL-state surfaces (FIX-03) — PASS (behavior-only, no visual regression)
- `/nutrition`, `/progress`, `/workouts` at 1440 dark: all resolve to their own URL, no
  horizontal overflow, no console errors, no visual regression vs the P2 system look.
- Deep-link / return-state behavior itself was torn down and verified green in P34-B
  (`evidence-p34b/verification.md`) and P34-Z return-state fresh run
  (`evidence-p34z/return-state-fresh.log`); this audit confirms no visual/console
  regression layered on top.
- Evidence: `urlstate-nutrition-dark.png`, `urlstate-progress-dark.png`,
  `urlstate-workouts-dark.png`.

### 4. Plan surfaces (FIX-28), showcase account, read-only — PASS
- `/workouts` plan section renders "CHAD'S TRAINING PLAN — 4-Day Upper/Lower Strength &
  Shred" with 4 day cards (per-day exercise counts + previews + Start actions), volume
  trend chart, personal records, recent workouts. Rich, panel-system-consistent.
- `/plans/44f24cb2-…` detail page renders the FIX-28 **Weekly schedule** section:
  adherence line "0 of 4 sessions done this week", 4 session cards with per-exercise
  sets×reps · rest targets and "Not done yet" pairing labels, and the **"Up next" badge**
  correctly on Day 1 (0 completions → first of rotation, per `lib/plans/up-next.ts`).
  Below it, the full plan document renders too (Training/Current badges, OVERVIEW / DAY /
  PROGRESSION, Edit + Delete + Run-in-logger + PDF + Discuss actions) — DEC-06 dual render
  correct. No overflow, no console errors, no em-dash in this content.
- Empty/document-only path: the schedule section returns null for document-kind plans by
  design (verified in code + adapter path check `evidence-p34z/plan-structured-path-check.md`).
- Evidence: `plan-workouts-section-dark.png`, `plan-detail-schedule-dark.png`,
  `plan-detail-schedule-light.png`.

### 5. Auth forms after the method="post" fix — PASS
- `/login`, `/register`, `/forgot-password` (and `/reset-password` by code) all carry
  `method="post"` on the form element (confirmed live: login/register `POST`,
  forgot-password `post`), so a pre-hydration native submit can never GET credentials into
  the URL. Visuals polished and consistent (cinematic montage panel, Google button, Terms
  gate on register, password reveal toggle). No console errors, no overflow, no em-dash.
- Email field autofocuses on all three — this is the pre-existing login autofocus pattern
  (reported, not a fail).
- Evidence: `auth-login-dark.png`, `auth-register-dark.png`, `auth-forgot-password-dark.png`.

### 6. Cross-cutting
- **Em-dashes:** found on `/progress` and `/today` (see F-1). None on `/nutrition`,
  `/workouts`, plan detail, or any auth form.
- **Labels:** all instantly clear (Calorie Tracker, Weekly Report, "Log a weigh-in",
  "Start any session from the Workouts page", etc.).
- **AA contrast:** both themes spot-checked on nav, cards, and group labels — acceptable;
  P2-z already raised light muted text to AA.
- **44px targets:** nav tabs 77–79×60; no sub-44 controls flagged on audited surfaces.
- **Nothing auto-starts / autofocuses:** Log drawer and More sheet open with focus on the
  dialog container, not an input — compliant. Email autofocus on auth is pre-existing.
- **Destructive actions:** plan Delete and workout delete are confirm/receipt gated
  (verified green in `evidence-p34z/p1-fix-verification.md`).

### 7. Console
- Desktop nav, chat sidebar, URL-state routes, plan pages, auth forms: **0 console errors.**
- Documented pre-existing noise (useActionState transition warning, SessionMiniBar
  hydration mismatch) did not even surface on the audited pages this run.
- New a11y warning on the FIX-21 mobile sheets — see F-2.

---

## Findings

### F-1 — P2 (owner-law, PRE-EXISTING, non-blocking for this wave)
Visible em-dashes in member-facing copy on audited pages:
- `/progress` Body measurements explainer: "The scale lies on a cut or a bulk — the tape
  doesn't…" and "— it's the single best non-scale signal of fat loss…"
  (source `components/progress/measurements-section.tsx`).
- `/today` + meal-plan copy: "2,200 cal cut — 3 meals/day"
  (source `components/meal-plan/generate-form.tsx`).
- `/today` uses a bare "—" as the empty-value glyph on the Weight-change stat.

Violates the "No em-dashes ever" owner law. **Not introduced by this wave** — none of the
source files are in the `9e0cdb1..HEAD` diff. Already in scope for the site-wide COPY-1
purge. Surfaced here per the cross-cutting brief; does not block the P34 wave push.

Repro: log in Pro, open `/progress` (Body measurements card) and `/today`.

### F-2 — P3 (a11y console warning, this-wave surface)
Opening the mobile Log drawer or More sheet (FIX-21) fires, 4×:
`Warning: Missing 'Description' or 'aria-describedby={undefined}' for {DialogContent}.`
Radix wants a `Description`/`aria-describedby` on the sheet content. Cosmetic to sighted
users but a real a11y gap on the new bottom-nav overlays. Add a visually-hidden description
(or `aria-describedby`) to the Log and More sheet content.

Repro: 390px, `/today`, tap Log (then More); watch the console.

### F-3 — P3 (note, pre-existing)
Bare "—" empty-value placeholder (F-1 third bullet) is the standard "no data" glyph but is
technically an em-dash under the owner law; fold into the COPY-1 sweep (e.g. use "–" or
"No data").

---

## Verdict recap
SHIP. FIX-20, FIX-21, FIX-03, FIX-28, and the auth method="post" fix all pass on desktop
and mobile in both themes, graded against the captured references. Findings: F-1 (P2,
pre-existing em-dash copy, COPY-1, non-blocking), F-2 (P3, Dialog aria-describedby on the
new mobile sheets), F-3 (P3, "—" empty glyph).
