# Pre-Delivery Audit — P34-A (FIX-20 grouped nav + FIX-21 phone bottom nav)

Auditor: pre-delivery product auditor. Method: drove the running app on
http://localhost:3600 with node Playwright (touch emulation, 390x844, DSR 2),
logged in as claude-testing@example.com. Read-only against the shared prod DB
(no submit/save/delete; after-action propagation sweeps SKIPPED per read-only
constraint). Screenshots + JSON in `evidence-p34a/audit/`.

This audit is ON TOP of the existing 79/79 formal verify (`ours/verify-final.md`);
it does not re-run that matrix.

---

## VERDICT (FINAL, after re-verification): SHIP — 0 P1, 0 P2 open, 2 P3 notes

The original DO NOT SHIP was on P2-1 (chat disclaimer hidden behind the bar).
P2-1 and the P3-3 code hazards were fixed and re-verified live; see the
"Re-verification addendum" at the end of this report for the measurements.
Remaining open items are the two note-level P3s (P3-1 unlabeled chat sidebar
toggle, pre-existing; P3-2 redundant phone nav surfaces, owner call) — neither
blocks shipping.

## ORIGINAL VERDICT (superseded): DO NOT SHIP — 0 P1, 1 P2, 3 P3

One P2 blocked a clean ship: the chat AI/medical disclaimer was hidden behind
the bottom bar for unverified users (fixed, re-verified below). Everything else
is solid — the bar, sheets, grouping, route-active semantics, tap targets, and
close affordances are pro-grade in both themes.

---

## [P2-1] Chat "Chad is an AI / not medical advice" disclaimer is hidden behind the bottom bar

- **Surface:** `/` (Coach / chat) at 390px, any account showing the verify-email banner (i.e. every unverified / new trial account — a large share of signups).
- **Repro:** Log in as an unverified user, open `/`. The composer's disclaimer line ("Chad is an AI and can make mistakes. This isn't medical advice — double-check anything important.") is not visible; it renders at y 794–825, directly under the fixed bar (bar top = 784, bottom = 844). Screenshot `chat-bar-composer.png` shows the composer with the bar directly below it and no disclaimer between them.
- **What happens / root cause (confirmed, `rootcause` measurement):** The chat column carries `pb-tabbar` (measured 59.5px, correctly reserved). But the column is `h-dvh` (844px) and the `VerifyEmailBanner` sits ABOVE it, pushing it down 53px (colTop=53, colBottom=897). The column now overflows the viewport by 53px, the document scrolls (`docScrolls=true`), and the reserved tab-bar space is pushed below the fold — so the disclaimer lands under the opaque `bg-background/95` bar. The user can scroll the outer document ~53px to reveal it, but by default it is covered. For a verified user (no banner) the disclaimer sits flush at the bar's top edge (~784.5 vs 784) with essentially zero clearance, so the margin is fragile even in the best case.
- **What a pro app does:** ChatGPT / Claude mobile keep the "can make mistakes" disclaimer permanently visible above any bottom chrome. A legal/medical disclaimer must never be obscured by nav.
- **Fix direction:** make the chat shell height account for elements stacked above it (e.g. size the chat column to the remaining space rather than a flat `h-dvh` when the banner is present), or move the disclaimer so it always clears the reserved tab-bar band. `components/chat/shell.tsx:80` (`h-dvh ... pb-tabbar`) + `app/(chat)/layout.tsx:71` (banner above the `h-dvh` shell). Note: the rubric classifies "covered content" as P1; ranked P2 here only because it is recoverable by scrolling and the text is low-prominence.
- **Evidence:** `chat-bar-composer.png`, `chat.json` (disclUnderBar=true), `rootcause` output in this session log.

## [P3-1] Chat sidebar toggle is an icon-only button with no accessible name

- **Surface:** chat header (`/`) at all widths — the `PanelLeftIcon` toggle at `components/chat/chat-header.tsx:30-37`.
- **What happens:** the button has no `aria-label`/title; screen readers announce it as an unnamed button. (Pre-existing, not introduced by FIX-20/21, but it is in the audited chat surface and violates Excellence §0 "every icon-only control is labeled".)
- **Pro app:** every icon-only nav control carries a label (e.g. "Open sidebar").
- **Fix:** add `aria-label="Toggle sidebar"`. Trivial; flagging since the audit walked this surface.

## [P3-2] Redundant navigation surfaces at phone width

- **Surface:** standalone pages (e.g. `/today`) at 390px expose the SAME grouped destination list twice: the bottom **More** sheet and the top-right hamburger sheet (`standalone-header.tsx`). The chat surface likewise has both the bottom bar and the chat sidebar drawer leading to overlapping grouped nav.
- **What happens:** two controls open near-identical grouped lists. Not broken, but Instagram/YouTube-tier apps pick ONE primary nav at phone width (bottom bar) and reserve the top-right for search/account, not a duplicate of the same menu.
- **Fix direction (owner call):** consider dropping the phone hamburger on pages that already have the bottom bar + More, or slim it to account/theme only. Flagging as a parity observation, not a defect.

## [P3-3] Minor code hazards in `bottom-nav.tsx` (low risk, note only)

- `components/nav/bottom-nav.tsx:114` — on unmount the effect unconditionally `removeAttribute("data-vk-open")`. Two `BottomNav` instances exist (chat layout + standalone shell); they never mount simultaneously, but during a client transition between a chat route and a standalone route a brief double-mount could let one instance's unmount clear the attribute the other still wants. Very low risk.
- `components/nav/bottom-nav.tsx:105` — the `focusout` `requestAnimationFrame` can fire after the component unmounts (listeners already removed), calling `update()` on an unmounted component and re-adding `data-vk-open` after cleanup removed it, leaving a stale attribute. Harmless in practice (next mount re-syncs), but worth a cancel-on-cleanup guard.

---

## What was verified clean (coverage)

**Code read:** `bottom-nav.tsx`, `lib/nav-links.ts`, `app/(chat)/layout.tsx`,
`components/chat/shell.tsx`, `globals.css` (tabbar utilities), `next.config.ts`
(redirects), `standalone-shell.tsx`, `page-shell.tsx`, `standalone-header.tsx`,
`chat-header.tsx`, `drawer.tsx`.

**Sibling sweep @390px touch** (`sweep.json`, `sweep-*.png`) — /today, /nutrition,
/hydration, /sleep, /workouts, /progress, /goals, /account, /files, /quit-date,
/help, /meal-plan, /kitchen, /reports, /future-you:
- No horizontal overflow on any page (`scrollWidth <= clientWidth` everywhere).
- Bar present and consistent (top 784, height 60, z-40) on every standalone page.
- Scrolled each page fully to bottom: **no page content, sticky footer, or floating action is covered by the bar** — the in-flow spacer (`h-tabbar`) clears it on every page.
- No page renders its own conflicting bottom chrome.
- In-page validation/error toasts were not exercisable read-only (they require submitting data); noted as skipped. Sonner toaster is `position="top-center"`, structurally clear of the bottom bar.

**Route-active semantics** (`sweep.json`): Today active only on /today; Progress
only on /progress; Coach active on chat; **More is correctly active on all its
sheet destinations** (/nutrition, /hydration, /sleep, /workouts, /goals, /account,
/files, /quit-date, /help, /meal-plan, /kitchen, /reports, /future-you). /meal-plan
lights More (no Plan tab) — sensible. Nothing active that shouldn't be.

**Overlay / dead-end sweep** (`overlay-*.png`, `more-sheet-*.png`, `close.json`):
- Log and More sheets opened from top / mid / bottom scroll on a long page (/help): every time landed **in-viewport, opaque** (bg rgb(4,7,13)), and **scrollable** (More: 13 links, drawer scrolls, last items reachable).
- Close affordances all work: **Escape** closes, **X** button closes (47x47px, > 44px), **scrim tap** closes, drag handle present for swipe.
- Hamburger sheet then More sheet opened in sequence — no conflict; each opens/closes independently.

**Uninvited-behavior / autofocus** (`close.json`, `chat.json`): on every overlay
open (Log, More, hamburger, chat sidebar) `document.activeElement` is a non-editable
element (DIV) — no keyboard auto-summons.

**Chat surface @390** (`chat-390`, `chat-composer-focused`, `chat-sidebar-open`):
- Keyboard-safe hide works: focusing the composer sets `data-vk-open` and hides the bar; blur restores it (`chat.json` focus/blur).
- Chat sidebar drawer (z-50) fully covers the bar (z-40) with its scrim — **no bar peek-through**.

**Tap targets** (`p34a-audit-light`): each tab 77–79 x 60px, well above 44px.

**Pro-app parity** (`today-390-light.png`, dark shots): bar reads pro-grade in
both themes — active tab = brand-red icon + bold foreground label, Log = red
center-action circle, muted inactive tabs, light-theme frost is clean. Labels
(Today/Log/Progress/Coach/More; Log sheet rows; More groups) are all instantly
clear. No em-dashes in any nav copy.

**Redirects** (code-confirmed in `next.config.ts`): 14 aliases present
(/water→/hydration, /weight→/progress, /food→/nutrition, /workout→/workouts,
/settings→/account, /quit→/quit-date, etc.). Live redirect behavior was covered
by the existing formal verify (not re-run).

---

## Re-verification addendum (same session, after fixes)

Coordinator applied three fixes; all re-verified live on :3600 with node
Playwright (script `scripts/p34a-audit-refix.mjs`, data `refix.json`):
1. `app/(chat)/layout.tsx`: SidebarInset now `h-dvh overflow-hidden`; ChatShell
   Suspense fallback `min-h-0 flex-1`.
2. `components/chat/shell.tsx`: chat root is now
   `flex min-h-0 w-full flex-1 flex-row overflow-hidden pb-tabbar` (was h-dvh).
3. `components/nav/bottom-nav.tsx`: focusout rAF tracked and cancelled on
   unmount (`bottom-nav.tsx:99,106,114`); data-vk-open cleanup documented.

**A. Chat @390x844, verify banner present (`refix-chat-390.png`): PASS**
- Document no longer scrolls: `docScrolls=false`, docScrollHeight=844,
  chat column colTop=53, colBottom=844 (was 897).
- Disclaimer bottom **771.8** vs bar top **783.5** — 11.7px clear, fully
  visible above the bar (was 825 vs 784, i.e. covered).
- Composer fully visible (top 581, bottom 683) and clickable: tapping it
  focuses the TEXTAREA.

**B. Composer focused @390: PASS**
- `data-vk-open` set; bar rides fully off-screen via the CSS `translate`
  property (`translate: 0px 100%`, bar rect top = 844 = viewport height;
  note: Tailwind v4 `translate-y-full` sets `translate`, not `transform` —
  `getComputedStyle(...).transform` stays "none", which is expected).
- No dead gap: the chat root's `pb-tabbar` padding collapses **59.5px → 0px**
  while focused, and restores to 59.5px on blur with the bar returning
  (`data-vk-open` removed). Screenshot `refix-chat-390-focused.png`.

**C. Chat @1440x900 (`refix-chat-1440.png`): PASS**
- Header, suggestions, composer, disclaimer all visible in one viewport;
  no document/body scroll (no double scrollbar); bottom bar `display:none`.

**D. /today @390 regression (`refix-today-390.png`): PASS**
- Bar present at top 784 / bottom 844, no horizontal overflow.

No regressions found.

**Pre-existing note (not P34-A, surfaced by the fix):** the now-visible chat
disclaimer copy in `components/chat/shell.tsx:161-163` contains an em-dash
("This isn't medical advice — double-check..."), which the no-em-dashes law
bans in customer copy. Flagging for the COPY-1 purge queue; not a P34-A defect.

## FINAL VERDICT: SHIP — 0 P1, 0 P2 open, 2 P3 notes (P3-1, P3-2)
