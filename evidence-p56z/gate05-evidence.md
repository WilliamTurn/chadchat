# GATE-05 Evidence — P56 Wave Close

- **Date run:** 2026-07-13 (fresh, independent; not reused from build sessions)
- **Target:** http://localhost:3601 — production `next start` of wave-final code (commit c9755bb), already running. Never started/stopped.
- **Method:** node Playwright (chromium) scripts run from `C:\Users\jon17\Desktop\chadchat-p56z-build`. Dual-cookie auth bootstrap copied exactly from `scripts/p34z-perf-today.mjs` (real login -> decode `authjs.session-token` -> re-encode with salt `__Secure-authjs.session-token` -> add both cookies).
- **Mode:** STRICT READ-ONLY. Only navigation, nav-link/PR-entry/range-segment clicks, and screenshots. No form submissions except login. No mutation of the live showcase account.
- **Accounts:** Body/Progress/Training/Nine-sections on the populated showcase account `stellarluxedecor@gmail.com` (id 94f4e0c1…); Today destinations on the Pro test account `claude-testing@example.com` (id c073b912…).
- **Scripts:** `scripts/gate05-evidence.mjs` (A–E main), `scripts/gate05-d3.mjs` (D3 focused), `scripts/gate05-a2.mjs` (A2 counts). Raw run log: `evidence-p56z/gate05/run-log.txt`.
- **React #310 / console errors:** NONE on any page, either account (dual-cookie setup correct). Console errors captured = 0 (showcase) and 0 (Pro).

---

## A. BODY PRESERVATION (showcase account) — PASS

**A1 — PASS.** `GET /progress/body` -> HTTP 200, final URL `/progress/body`, renders as the Body page (title "Progress / Body", "Pro feature"; subtitle "Track your weight, measurements, and progress photos over time."). react310=false. Screenshot: `A1-body-desktop-1440.png`.

**A2 — PASS (values coherent, one small live-data delta noted).** Actual values observed vs P56-A recorded:
| Metric | P56-A recorded | Observed 2026-07-13 | Verdict |
|---|---|---|---|
| Weight trend headline | ~208.8 lb | **208.8 lb** | match |
| Goal | 195 lb | **195 lb** | match |
| Progress to goal | ~48% | **48% there** | match |
| Measurements | 3 | **3** (Waist 36in −2.7, Chest 44in −0.5, Arms 16.25in +0.3) | match |
| History rows | 56 | **56** (DOM count exact) | match |

Additional coherent context on the page: "−6.1 lb change / last 30 days", "−1.9 lb/wk rate", "13.8 lb to goal (~Aug 26)", "23 of 30 days logged". Data is present, internally consistent, and matches P56-A within live-data tolerance. No drift observed on the headline figures.

**A3 — PASS (all three deep links).**
- `/progress/body#log-entry` -> URL preserved; the `#log-entry` anchor element exists (count=1) and the page scrolled to it (scrollY=123, i.e. not at top). Screenshot `A3-body-log-entry-anchor.png`.
- `/progress/body?range=3m` -> chart window state present in URL; **survives reload** (post-reload URL still `?range=3m`). Screenshot `A3-body-range-3m.png`.
- Custom `/progress/body?from=2025-01-01&to=2025-06-01` -> HTTP 200, URL state preserved, react310=false. Screenshot `A3-body-from-to.png`.

**A4 — capabilities present:**
| Capability | State |
|---|---|
| Weight chart with range control (1W / 1M / All segments) | SEEN |
| Measurements section (spots: Waist/Chest/Arms/Hips/Thighs/Shoulders/Neck) | SEEN |
| Progress photos section ("Tap to add a photo … JPEG or PNG") | SEEN |
| Methods / how-it-works content | SEEN — as explanatory copy: "The scale lies on a cut or a bulk; the tape doesn't. A shrinking waist with a steady scale means you're losing fat and holding muscle." (no literal "How it works" heading on this page; explainer copy fills the role) |
| Ask Chad hook | SEEN ("Ask Chad" affordance) |
| Data-entry affordance | SEEN ("Log an entry" form with date/weight/note/photo; "Log entry" button — NOT clicked) |

---

## B. AUTHENTICATED REDIRECTS — PASS

Logged in (showcase):
- `GET /weight` -> HTTP 200, final URL `/progress/body`, body content present (weight/body/measurement text), react310=false. Screenshot `B-redirect-weight.png`.
- `GET /body` -> HTTP 200, final URL `/progress/body`, body content present, react310=false. Screenshot `B-redirect-body.png`.

Both land on the Body page with content, not a login bounce. (Redirects defined in `next.config.ts` lines 28–29, temporary/302.)

---

## C. NINE PROGRESS SECTIONS (showcase) — PASS

`GET /progress` -> HTTP 200, react310=false. Screenshots `C-progress-desktop-1440.png` (1440) and `C-progress-mobile-390.png` (390). All nine sections present, each populated (none silently absent):
| # | Section | Observed state |
|---|---|---|
| 1 | Goals | POPULATED — "DROP TO 195 LB · 48% there · Trend weight 208.8/195 lb" |
| 2 | Body | POPULATED — "208.8 lb · −6.1 lb last 30 days · Goal 195 lb · 48% · 23 of 30 days logged" + sparkline |
| 3 | Training | POPULATED — "0 sessions this week · 22 personal records · 13 sessions last 30 days" + weekly bars |
| 4 | Nutrition | POPULATED — "18 of 23 days within target · avg 2,292 kcal · 28-day calendar" |
| 5 | Sleep | POPULATED — "7h 29m average last 14 nights" + chart |
| 6 | Hydration | POPULATED — "0 of 23 days at goal · 0% · 99 oz avg per logged day" |
| 7 | Consistency | POPULATED — "No active streak · 57 of 84 days logged · last 12 weeks" |
| 8 | Milestones | POPULATED — "Barbell Bench Press record · 268 lb est. 1RM · Jul 6" |
| 9 | Reports | POPULATED — rendered as **"WEEKLY REPORT"** heading: "Sent Jul 13 · Week 2: One heavy bench, six days missing". (Labeled "Weekly report", not the literal token "Reports" — present, not absent.) |

Note: automated token-match flagged "Reports" as ABSENT only because the section is titled "Weekly report" on the page; it is visibly present with content (see screenshot).

---

## D. TRAINING ANALYTICS — CANONICAL + SOURCE-LINKED (showcase) — PASS

**D1 — PASS.** `/progress/training` -> HTTP 200, react310=false. Screenshots `D1-training-desktop-1440.png` (1440) and `D1-training-mobile-390.png` (390). All required blocks render:
- Status band ("Workouts logged 32 · This week 4 planned 0 · Volume this week 0 lb · Next milestone 50th workout, 18 to go") — SEEN (rendered as the status stat band; literal word "status" not used).
- Range control (1W / 1M / All) — SEEN
- Training consistency calendar + 7-day strip ("13 sessions in range · 13 of 30 days · M W F Su Mo Tu We Th Fr Sa") — SEEN
- Plan adherence ("0 of 4 planned this week · Plan: 4 sessions a week") — SEEN
- Volume trend ("Training volume 23,533 lb latest day · daily volume + smoothed trend") — SEEN
- Muscle focus ("589 working sets · Legs 199/34% · Back 119/20% · Chest 95/16% …") — SEEN
- Records ("Exercise library" with top sets + est 1RM) — SEEN
- PR / milestone timeline ("RECORDS AND MILESTONES · 52 record sets last 30 days · 110 all time") — SEEN

**D2 — CANONICAL: PASS.** Records/exercise library shows canonical names with NO split/duplicate pairs:
| Canonical shown | Split form that must NOT appear separately | Result |
|---|---|---|
| Hip Thrust | Barbell Hip Thrust | canonical present; no separate split — OK |
| Barbell Back Squat | Back Squat | canonical present; no separate "Back Squat" token — OK |
| Barbell Bench Press | Bench Press | canonical present; no separate "Bench Press" record token — OK |
| Calf Raise | Standing Calf Raise | canonical present; no separate split — OK |
| Leg Curl | Seated Leg Curl | **neither** form appears in the visible top-8 library / recent records (exercise not in the top slice); no split/duplicate pair present — OK |

Exercise library (visible): Leg Press, Hip Thrust, Deadlift, Calf Raise, Barbell Back Squat, Romanian Deadlift, Barbell Bench Press, Barbell Row. Records timeline: Face Pull, Incline Dumbbell Press, Lat Pulldown, Overhead Press, Barbell Row, Barbell Bench Press, Bulgarian Split Squat, Hip Thrust, Front Squat … No duplicate/split pair observed anywhere in the list. ("Leg Curl" simply isn't among the surfaced records — not a duplicate, so no failure.)

**D3 — SOURCE-LINKED: PASS.** Clicked the "New record: Barbell Bench Press 230 lb × 5 · beat 225 lb · Jul 6" PR entry -> landed on source workout detail `/workouts/history/a09442cd-6a3f-427f-b4bb-706e08ebebc2`, HTTP 200, react310=false. The page is the real workout ("UPPER A · Mon, Jul 6 · 1h 11min · 20 sets · 23,533 lb moved") and shows the exact PR set: "Bench Press … 4  230 lb × 5  RPE 9", plus Barbell Row, Overhead Press, Lat Pulldown, Incline Dumbbell Press. Screenshot `D3b-source-workout-detail.png`. Went Back -> `/progress/training`. (Every PR row in the timeline links to its `/workouts/history/{id}` source — 13 such anchors found.)

---

## E. TODAY DESTINATIONS (Pro test account) — PASS

`GET /today` -> HTTP 200, react310=false. Screenshot `E-today-desktop-1440.png`. Progress-highlights band links verified by navigation (all HTTP 200, correct destination, react310=false, went Back each time):
| Band link text | href | Landed | Result |
|---|---|---|---|
| "Body progress →" | /progress/body | /progress/body | PASS |
| "Training progress →" | /progress/training | /progress/training | PASS |
| "Progress →" | /progress | /progress | PASS |

(Additional band links present on /today: "Log weight" -> /progress/body#log-entry; "Nutrition progress →" and "Recovery progress →" currently -> /progress overview.)

---

## SUMMARY

| Item | Result |
|---|---|
| A. Body preservation | **PASS** — 208.8 lb / goal 195 / 48% / 3 measurements / 56 history rows all confirmed; deep links (#log-entry, ?range=3m survives reload, custom ?from&to) work |
| B. Authenticated redirects | **PASS** — /weight and /body both -> /progress/body with content, HTTP 200 |
| C. Nine progress sections | **PASS** — all nine present and populated (Reports renders as "Weekly report") |
| D. Training canonical + source-linked | **PASS** — canonical names, no split/duplicate pair; PR entry -> real source workout page (HTTP 200) showing the exercise |
| E. Today destinations | **PASS** — body / training / progress band links all land correctly |

No React #310, no console errors, no page errors on any surface with the correct dual-cookie setup.

**Evidence file:** `C:\Users\jon17\Desktop\chadlatest\chadchat\evidence-p56z\gate05-evidence.md`
**Screenshots + run log:** `C:\Users\jon17\Desktop\chadlatest\chadchat\evidence-p56z\gate05\`
