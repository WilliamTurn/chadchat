# P56-E audit findings -> fixes

Findings from `pre-delivery-audit.md` (SHIP-WITH-FIXES, 1 P2) and
`mobile-audit/report.md` (DO-NOT-SHIP, 1 P1 + 3 P2), each fixed same
session and re-verified live (see `ours/refix-verification.md`).

| # | Source | Finding | Fix | Status |
|---|---|---|---|---|
| 1 | pre-delivery P2-1 | New panel titles truncate ("MEAL ...", "TRAINING THIS ...") | `wrapTitle` on ALL SIX new mounts (training/meal/goal + 3 tiles), the whole class not just the five measured | FIXED |
| 2 | mobile P1 | /plans "Add a plan" dialog auto-focuses Title (keyboard rises uninvited; owner law) | `onOpenAutoFocus={preventDefault}` on the PlanEditor DialogContent | FIXED |
| 3 | mobile P2 | Highlight eyebrow labels paint into the header link at 320/360 (up to 50px) | ModuleHeader (shared, disclosed): header row may `flex-wrap`, link `shrink-0 ml-auto` so it drops to its own right-aligned line instead of colliding; hit-area negative-margin trick preserved | FIXED |
| 4 | mobile P2 | "All goals (N)" link 73x16px | 44px phone hit area (`min-h-11` + pulled-back margins, the ModuleHeader link pattern) | FIXED |
| 5 | mobile P2 | Dialog close (X) 34x34px | NOT fixed here: `components/ui/dialog.tsx` is the app-wide shared dialog primitive and every dialog in the app has this X (pre-existing class, P34-Z filed the same family for the MOB sweep). Mid-wave churn of a P2-owned primitive on a P56-E card-level packet is the wrong scope; FILED FOR P56-Z / MOB sweep with this note | FILED |
| 6 | mobile P3 | Eyebrow + chevron hierarchy weaker than Whoop/Hevy (wordy uppercase label + text link on one row) | Layout collision fixed (#3); the deeper re-hierarchy (shorter titles, chevron affordance) belongs to the dedicated design wave; FILED | FILED |
| 7 | mobile P3 | Centered modal vs bottom sheet on phone | Pre-existing PlanEditor dialog pattern (relocated, not redesigned); overlaps the MOB-20 popup-elimination sweep charter; FILED | FILED |
| 8 | mobile P3 / pre-delivery P3 | Em-dash in the New-plan textarea placeholder | Placeholder changed to hyphen (audit ran pre-fix) | FIXED |
| 9 | mobile P3 | Em-dash inside the meal-plan TITLE ("2,200 cal cut — 3 meals/day") | Member DATA, not system copy: the generator's own title example in `lib/validation/meal-plan.ts` teaches the em-dash form. Changing generation output mid-wave touches Chad-authored content; FILED for COPY-1/owner (fix the schema example + description) | FILED |
| 10 | pre-delivery P3 | /meal-plan day-panel total 2,135 vs its own tab 2,134 (rounding) | Pre-existing /meal-plan internal inconsistency the new metric SURFACES (my card matches the tab + the plan document totals); FILED | FILED |
| 11 | pre-delivery P3 | Stale goal values undated on lapsed persona | Parity with /progress (shared module); a dated-staleness treatment for goal outcomes is a shared-module change for the design wave; FILED | FILED |
| 12 | pre-delivery P3 | Rotation "next" matched by index not session id | Correct today by construction (verdict.session.position indexes the same sorted rotation array); hardening noted for a follow-up | FILED |
| 13 | pre-delivery P3 | Empty meal card: two differently-labeled links to /meal-plan (detail link + empty action) | Role contract requires the named detail link in every state; the empty action carries the actionable phrasing. Same-destination-different-label accepted and recorded | FILED |
| 14 | pre-delivery P3 | Basic member sees "Not logged" for the Pro-gated trend-weight outcome | Matches A's shipped /progress behavior (same shared module); the locked-outcome note treatment is already an OWNER ADJUDICATION queued by P56-A | FILED (dup of A's) |
