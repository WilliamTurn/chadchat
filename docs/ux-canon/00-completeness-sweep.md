# UX Canon — Completeness Sweep (00)

Audit date: 2026-07-22. Auditor role: adversarial completeness check of the eight-file canon (1,213 principles) against independent maps of the product-UX field — not against the canon's own structure.

---

## (a) Method

1. Read all eight files in full (every heading, every principle skimmed, cross-reference and contested sections read closely).
2. Assembled six independent maps of the field:
   - **Tidwell, *Designing Interfaces* 3rd ed.** — full chapter/pattern TOC (from training knowledge; O'Reilly page 403'd).
   - **Cooper et al., *About Face* 4th ed.** — Part II/III chapter map (training knowledge).
   - **NN/g topic taxonomy** — fetched live from nngroup.com/topics.
   - **Apple HIG** section list (Foundations + Patterns + Components) and **Material 3** components/styles list (training knowledge; both sites are JS-rendered and unfetchable).
   - **Baymard research catalog** top-level categories — fetched live from baymard.com/research.
   - **Consumer-app simulation**: mentally built a complete consumer app (auth, onboarding, core loop, data entry, browsing, settings, billing, support, notifications, sharing, community, editor) and asked per surface: *which file owns the conventions here?* Also checked against this product's actual surfaces (workout logger, AI chat, dashboard, community templates, an editor).
3. For every topic in every map: located the owning file/section, or recorded a GAP. A topic covered under a different name counts as covered (mapping noted). Out-of-scope by design (research/testing process, org/design-ops, marketing outside the product, native-only conventions) was checked but not flagged.
4. Cross-checked the ~20 topics that appear in multiple files for contradictions (durations, capitalization, disabled states, validation timing, target sizes, Enter behavior, OTP handling, list loading).

Severity key: **MISSING** = no file owns it and a leading team would need it. **THIN** = mentioned but not enough to build from. **DELIBERATE-EXCLUSION-OK** = absent and defensibly so for this product class.

---

## (b) Coverage matrix

### Map 1 — Tidwell, *Designing Interfaces* 3rd ed.

| Tidwell chapter / pattern cluster | Owner | Notes |
|---|---|---|
| Ch1 What Users Do: Safe Exploration, Instant Gratification, Satisficing | 03 §15 (undo-first), 02 §7.73 (time-to-value), 04 §4.56 (scanning) | Covered under different names |
| Ch1: Changes in Midstream, Deferred Choices, Incremental Construction | 02 §16 (resumability), 02 §7.78 (defer asks), 03 §10–11 (drafts/autosave) | Covered |
| Ch1: Habituation, Spatial Memory | 02 §2.25 (never reorder nav), 05 §16.112 (consistent identification) | Covered |
| Ch1: Prospective Memory, Microbreaks | 02 §16.158–160, 06 §K.89 (interruption) | Covered |
| Ch1: Streamlined Repetition | **GAP (THIN)** | No file owns duplicate/repeat-last/copy-from-previous as a data-entry accelerator; 01 §B.21 (never re-enter known data) is adjacent only. See Gaps #9 |
| Ch1: Keyboard Only | 01 §J–K, 05 §6 | Covered exhaustively |
| Ch2 IA & App Structure: Feature-Search-Browse, News Stream, Dashboard, Settings Editor | 02 §1–2, §10; 08 §B9 | Covered |
| Ch2: Canvas-Plus-Palette, Many Workspaces | **GAP (THIN)** | Editor-class surfaces (canvas, palettes, zoom, workspaces) have no owner. See Gaps #5 |
| Ch2: Wizard, Alternative Views, Help Systems, Tags | 02 §8; 08 §B6 (density/columns); 08 §D; filter chips 08 §B2 | Covered; user-created tags/labels thin but niche |
| Ch3 Navigation: Clear Entry Points, Escape Hatch, Menu Page, Pyramid, Modal Panel | 02 §1.12, §2.30, §2 | Covered |
| Ch3: Deep Links, Breadcrumbs, Progress Indicator, Sitemap Footer, Annotated Scroll Bar | 02 §5, §3.37–38, §8.85; footer/scrollbar niche-web | Covered (annotated scrollbar OK to skip) |
| Ch4 Layout: Visual Framework, Center Stage, Grid of Equals, Titled Sections, Module Tabs, Accordion, Collapsible Panels, Progressive/Responsive Disclosure | 04 §2, §4; 01 §K.104–105; 02 §9 | Covered |
| Ch5 Visual Style | 04 §1–7, §10 | Covered |
| Ch6 Mobile: Vertical Stack, Filmstrip, Bottom Nav, Infinite List, Loading, Touch Tools | 06 §J–M; 02 §2.13–18; 08 §B3 | Covered |
| Ch7 Lists: Two-Panel Selector, One-Window Drilldown, Cards, Thumbnail Grid, Carousel, Pagination, Jump to Item, New-Item Row | 08 §B3–B7, §C6; 02 §2 | Covered |
| Ch8 Actions: Button Groups, Hover Tools, Prominent Done, Preview, Spinners, Cancelability | 01 §A; 04 §4; 02 §8.89 (review step); 03 §2, §14.105 | Covered |
| Ch8: **Multilevel Undo, Command History, Macros** | **GAP (THIN)** | Canon's undo = toast-undo + trash (01 §N, 03 §15). Editor-grade undo stacks, redo, history absent. See Gaps #5 |
| Ch9 Complex Data: Sortable Table, Datatips, Dynamic Queries, Small Multiples, brushing/zoom | 08 §B1–B2, §B10; 04 §8 | Core covered; advanced analytic interaction (brushing) OK to skip for consumer apps |
| Ch10 Forms: Forgiving Format, Structured Format, Input Hints/Prompt, Autocompletion, Dropdown Chooser, Good Defaults, Error Messages, Password Meter | 01 §B–F, §O, §R; 03 §6 | Covered exhaustively |
| Ch11 UI Systems / atomic design | Out of scope (design-ops) + project ds.css covers | OK |

### Map 2 — *About Face* 4th ed.

| About Face chapter | Owner | Notes |
|---|---|---|
| Pt I Goal-directed design, research, personas | Out of scope by directive | — |
| Ch8 Digital Etiquette (considerate, forgiving software) | 06 §S; 03 §15; 02 §13–14 | Covered |
| Ch9 Platform & Posture (sovereign/transient) | Partially 02 §2, 06 §N | Posture as a concept absent, but its consequences (modality rules, PWA) present. OK |
| Ch10 Optimizing for Intermediates (progressive expertise) | 02 §9; 01 §P (shortcuts); 08 §D2 | Covered via progressive disclosure + accelerators |
| Ch11 Orchestration & Flow; Ch12 Eliminating Excise | 01 §B.16/21; 02 §8.92; 05 §17.122 | Covered under "don't ask twice / minimum fields" |
| Ch13 Metaphors, Idioms, Affordances | 01 §A.2; 02 §2.29 (Jakob's law) | Covered |
| Ch14 Rethinking Data Entry (fudgeability) | 01 §E.47–48 (accept and normalize) | Covered |
| Ch15 Preventing Errors; Rich Modeless Feedback | 03 §6.56; 03 §1–5 | Covered |
| Ch16 Designing for Different Needs: accessibility | 05 (entire file) | Covered exhaustively |
| Ch16: **localization/globalization** | **GAP (THIN)** | Only 04 §11.141–143. No RTL, no name/address i18n, no locale calendars. See Gaps #4 |
| Ch17 Visual design integration | 04 | Covered |
| Pt III: Drag-and-drop, Selection, Controls, Menus, Toolbars, Dialogs, Errors/Alerts | 01 §H, §K, §M, §Q; 03 §6, §15 | Covered |
| Pt III: **Undo (multi-level, categories of undo)** | **GAP (THIN)** | Same as Tidwell Ch8 gap. See Gaps #5 |

### Map 3 — NN/g topic taxonomy (fetched)

| NN/g topic | Owner | Notes |
|---|---|---|
| Accessibility | 05 | Covered |
| AI / Agentic AI | 07 | Covered, current (agent logs, memory UIs) |
| Application Design, Web Usability, HCI, Behavior Patterns | 01–04, 06 | Covered |
| Branding | 04 §13 | Covered (voice boundaries) |
| Content Strategy, Writing & Content | 04 §11–12 | Covered |
| Ecommerce Design | 02 §12, 06 §R | Covered for checkout/subscription; product-page depth deliberately excluded (see Baymard) |
| **Email** | **GAP (THIN)** | Transactional/notification email design has no owner. See Gaps #7 |
| Information Architecture, Navigation, Search | 02 | Covered |
| **International Users** | **GAP (THIN)** | See Gaps #4 |
| Mobile & Tablet | 06 §J–N | Covered |
| Persuasive Design / dark patterns | 06 §S, 08 §A7 | Covered exceptionally |
| Psychology & UX | 08 §A (Fogg, goal-gradient, endowed progress, SDT) | Covered |
| **Social Media** (social features in-product) | **GAP (MISSING if community ships)** | See Gaps #2, #3 |
| Visual Design | 04 | Covered |
| Intranets, B2B, Non-profit, Analytics, Research Methods, UX Teams, Agile | Out of scope by directive | — |

### Map 4 — Apple HIG + Material 3

| HIG/M3 item | Owner | Notes |
|---|---|---|
| HIG Foundations: color, dark mode, icons, images, layout, motion, typography, writing, accessibility, privacy | 04, 05, 06 §P | Covered |
| HIG **Right to Left** | **GAP (THIN)** | See Gaps #4 |
| HIG Patterns: charting data | 04 §8, 08 §B10 | Covered |
| HIG **Collaboration and sharing** (share sheets, share previews) | **GAP (MISSING)** | See Gaps #2 |
| HIG: drag and drop, entering data, feedback, going full screen, loading, modality | 01 §M, §B–F; 03; 02 §2.30 | Covered; *which overlay container when* is thin — see Gaps #8 |
| HIG: **file management** / downloads | **THIN** | Upload owned (08 §C1), download-delivery barely (07 §G.57). Gaps #10 |
| HIG: launching, onboarding, managing accounts | 06 §G, 02 §7, §11 | Covered; multi-account switching = deliberate exclusion (consumer single-account) |
| HIG: managing notifications, offering help, ratings and reviews, settings, searching | 02 §14, 08 §D, 08 §D5, 02 §10, 02 §6 | Covered |
| HIG: playing audio / video / haptics | 08 §C4–C5, 03 §17 | Covered |
| HIG: **printing** | DELIBERATE-EXCLUSION-OK | Web app; plan printing is a nice-to-have |
| HIG: **undo and redo** | **GAP (THIN)** | Gaps #5 |
| HIG: **workouts** (live-activity, session UX) + timers | **GAP (MISSING for this product)** | Rest timers, stopwatches, session-in-progress state. Gaps #1 |
| M3 components: app bars, badges, buttons/FAB, cards, carousel, checkbox, chips, dialogs, lists, menus, nav bar/rail/drawer, progress, radio, search, sliders, snackbar, switch, tabs, text fields, tooltips | 01, 02, 03, 08 | All covered, most with full keyboard contracts (01 §K) |
| M3: **date pickers AND time pickers** | Date: 01 §F.52–53. **Time/duration: GAP** | Gaps #1 |
| M3: bottom sheets, side sheets (container choice, detents, drag handle) | **THIN** | Gaps #8 |
| M3 styles: color, elevation, motion, shape, typography | 04 | Covered |

### Map 5 — Baymard research catalog (fetched)

| Baymard category | Owner | Notes |
|---|---|---|
| Homepage & Category | 02 §1–3 | Covered |
| On-Site Search | 02 §6, 01 §R | Covered |
| Accessibility | 05 | Covered |
| Product List (& Filtering) | 08 §B2–B3, 02 §6.70 | Covered |
| **Product Page** (incl. user reviews display, variants, spec sheets) | Partial: 08 §C2 (galleries), 06 §R (price honesty) | DELIBERATE-EXCLUSION-OK for a non-commerce app — but if community templates get ratings, review-display conventions become a gap (Gaps #3) |
| Cart & Checkout | 02 §12, 06 §R | Covered |
| Accounts & Self-Service | 02 §11, 06 §Q, 08 §D | Covered |
| Mobile Web / Mobile App | 06 §J–N | Covered |

### Map 6 — Consumer-app simulation (surface-by-surface)

| Surface | Owner | Verdict |
|---|---|---|
| Auth, signup, reset, sessions, passkeys, 2FA | 02 §11, 06 §Q | Owned |
| Onboarding, first-run, permissions | 02 §7, §13; 08 §D2; 07 §P | Owned |
| Core loop: logging, engagement, PRs, streaks, goals | 08 §A; 01 | Owned (best-in-field depth) |
| **In-workout session: rest timers, duration entry, keep-awake, background timer continuation** | **Nobody** | **MISSING** (Gaps #1) |
| Data entry, forms, selection | 01 | Owned |
| Browsing, lists, tables, history, dashboard | 08 §B, 02 | Owned |
| **Scheduling / recurrence ("every Mon-Wed-Fri"), calendar views** | Nobody (02 §14 covers reminder timing only) | **THIN** (Gaps #6) |
| Settings | 02 §10 | Owned |
| Billing, paywall, cancel | 02 §12, 06 §R | Owned |
| Support, help, feedback | 08 §D | Owned |
| Notifications (push/email strategy) | 02 §14, 03 §16 | Owned; **in-app inbox anatomy THIN** (Gaps #11) |
| **Sharing: share sheet, share cards, link previews, invite/referral** | Nobody | **MISSING** (Gaps #2) |
| **Community/UGC: profiles, comments, report/block/moderation** | Nobody (08 §A6 = comparison ethics only) | **MISSING if the community-templates surface ships** (Gaps #3) |
| AI chat | 07 | Owned, current |
| **Editor surface (templates/embed editor in this repo): undo stack, save model, canvas** | Nobody | **THIN→MISSING for this product** (Gaps #5) |
| Media: photo, video, audio, galleries | 08 §C | Owned |
| Offline, sync, resilience, performance | 03 §8–9, 06 | Owned |
| Trust, privacy, dark patterns | 06 §P–S | Owned |
| Guest → account data migration | Nobody (02 §7.76 endorses guest mode, stops there) | **THIN** (Gaps #12) |

---

## (c) GAPS list

Count: **3 MISSING · 9 THIN · 6 DELIBERATE-EXCLUSION-OK** (deliberate ones listed at the end, not numbered).

1. **Timers, stopwatches, and time/duration entry — MISSING (product-core).**
   What: time-of-day pickers (M3 core component), duration entry (mm:ss), countdown/rest-timer conventions: visible remaining time, pause/skip/extend, continues in background and across lock, audio/haptic cue on completion honoring silent mode, keep-screen-awake during active sessions, notification-based completion when backgrounded.
   Why: this is the core in-workout loop of the product the canon serves, and time pickers are a first-class component in every platform map. 03 §11 covers *timeouts*, 08 §C5 mentions a rest-timer beep — nobody owns the timer itself.
   Absorb into: 01 §F (time/duration entry) + a new short section in 03 (running-timer/live-session status). No ninth file needed.

2. **Sharing and invites — MISSING.**
   What: native share-sheet usage vs custom share UI; share-card/OG-preview design (what a shared workout/achievement looks like off-platform); shared-link permissions (view-only, expiry, revocation); "copied link" affordances beyond a toast; invite/referral flow honesty (no contact spam — 06 §S.158 covers only the abuse case).
   Why: HIG has a whole "Collaboration and sharing" pattern; every fitness app's growth loop is share-an-achievement; the canon has exactly two glancing mentions (07 §G.56, 08 §A6.39).
   Absorb into: 08 (new section E, "Sharing and invites") — it borders engagement and media, both owned there.

3. **UGC/social surface conventions: report, block, moderate, reviews display — MISSING if the community surface ships, else deliberate-exclusion.**
   What: report-content and block-user affordances (an app-store *requirement* for UGC apps), moderation feedback loops ("we removed this, here's why"), comment-thread conventions, public-profile anatomy and privacy defaults, displaying user ratings/reviews (distribution bar, sort by helpful — Baymard Product Page territory).
   Why: this repo has a community-templates surface; the canon covers social *comparison ethics* (08 §A6) but not social *mechanics or safety*.
   Absorb into: 08 §A6 expansion, or a ninth file if community becomes a major surface.

4. **Internationalization beyond string mechanics — THIN.**
   What: RTL layout mirroring (HIG "Right to left"; which icons flip, which don't), name/address internationalization (no forced first/last split, no postal-format assumptions — partially implied by 01 §F.54–55), locale-aware calendars (first day of week), unit-system preference plumbing (kg/lb appears only as an example in 01 §H.75), translation completeness as a shipping gate.
   Why: NN/g "International Users" and About Face Ch16 both treat this as a top-level domain; canon has only 04 §11.141–143 (concatenation, expansion room, Intl formatters).
   Absorb into: 04 §11 expansion + 01 §F (names/addresses). For an English-only launch this is low-urgency, but the canon claims universality.

5. **Editor-class surfaces: multilevel undo/redo, save model, canvas — THIN (MISSING for this product's editor).**
   What: undo/redo stacks with standard bindings and history depth, what is and isn't undoable, version history/restore (Docs-style), canvas conventions (zoom, pan, selection, snap, palettes), workspace/tab management.
   Why: Tidwell (Canvas-Plus-Palette, Multilevel Undo, Command History), About Face Part III, HIG "Undo and redo" all rank this; canon's undo is only toast-undo + trash. The repo demonstrably contains an editor surface.
   Absorb into: 01 (new section after §N: "Editing surfaces — undo stacks and save models"); version history borders 03 §10.

6. **Recurrence and calendar-view UX — THIN.**
   What: recurrence input ("repeat every Mon/Wed/Fri", end conditions), editing one-occurrence-vs-series, week/month calendar view conventions, drag-to-reschedule.
   Why: plan scheduling is a plausible near-term surface of this product; recurrence is a famously easy-to-botch pattern with a strong platform convention (Google Calendar). Absorb into: 01 §F + 02 (flows).

7. **Transactional and notification email design — THIN.**
   What: subject-line and sender-name conventions, single-CTA layout, plain-HTML robustness, the reset/verify/receipt email as a designed surface, unsubscribe placement (mechanics exist at 02 §14.149), digest design.
   Why: NN/g has Email as a top-level topic; email is a user-facing product surface the canon routes around (02 §14.150 assigns email a role but no craft rules). Absorb into: 02 §14 expansion or a short "communications" appendix.

8. **Overlay-container selection and sheet mechanics — THIN.**
   What: decision rules for dialog vs bottom sheet vs side sheet vs popover vs full page (HIG Modality, M3 sheets); bottom-sheet specifics: detents, drag handle, expand-to-full, dismissal semantics.
   Why: canon has superb dialog *mechanics* (01 §K.93–94) and modality *escape* rules (02 §2.30) but never says which container to reach for; sheets are the dominant mobile container in 2026. Absorb into: 02 §2 (a "modality and containers" subsection).

9. **Repeat/duplicate accelerators — THIN.**
   What: "repeat last workout", duplicate-item, copy-from-previous, recents/templates as entry accelerators (Tidwell "Streamlined Repetition").
   Why: for a logging app this is the #1 entry accelerator; 01 §B.21 implies it but no rule owns it. Absorb into: 01 §B.

10. **Downloads/export delivery — THIN (minor).**
    What: file naming, progress, completion affordance ("where did it go"), web download vs share-sheet on mobile. 07 §G.57 and 06 §P.125 state that export must exist; nothing owns how it lands. Absorb into: 08 §C.

11. **In-app notification center/inbox anatomy — THIN (minor).**
    What: read/unread handling, grouping, clear-all, retention. One clause (02 §14.150) + badge rules (03 §16) exist. Absorb into: 02 §14.

12. **Guest-mode → account data migration — THIN (minor).**
    What: merging anonymous/local data into a new account without loss, and messaging it. 02 §7.76 endorses try-before-signup; the upgrade moment is unowned. Absorb into: 02 §11.

**DELIBERATE-EXCLUSION-OK** (checked, defensible for this product class; do not add unless the product changes): product-detail/commerce page depth beyond checkout (Baymard Product Page); maps/geolocation UI; printing; OS widgets/watch surfaces (out of scope by directive); multi-account switching; children/COPPA age gates (07 §N.105 covers the AI case); B2B admin/roles/permissions UIs.

---

## (d) Overlap and contradiction check

Real conflicts (should be resolved in the files):

1. **Enter-to-send vs Cmd+Enter-to-submit.** 01 §B.24 [mechanical]: "textareas submit with Cmd/Ctrl+Enter." 07 §C.23 [mechanical]: chat composer — "Enter sends, Shift+Enter newline" on desktop. Both are right in their contexts, but both are tagged mechanical, neither states the boundary, and a builder making any chat-adjacent multiline input (comment box, notes field) gets two contradictory lint rules. Fix: 01 should name the chat-composer exception and point to 07.
2. **OTP auto-submit.** 05 §14.101 [mechanical]: never auto-advance focus, never submit on change (WCAG 3.2.2). 06 §Q.133 [mechanical]: OTP fields "auto-submit on complete code." 01's contested section leans against auto-advance. This is a direct mechanical-vs-mechanical conflict at the OTP case. Fix: 06 should soften to "may auto-submit a single-field OTP only with visible submission feedback and an error path that restores the field," or defer to 05.
3. **Load-more vs infinite scroll: epistemic status mismatch.** 02's contested list: "no consensus; depends on task." 08 §B3.64 [mechanical]: "Default to Load More; it is the researched winner." Same question, one file calls it open, the other closed. Fix: align — 08's position with 02's task-dependence carve-out is the defensible merge.
4. **Disabled controls.** 01 §A.5, 02 §8.95, 03 §6.57 all push "prefer enabled + explain on press"; 08 §B8.88 prescribes "disable (with explanation) rather than hide" for inapplicable bulk actions. Not strictly contradictory (submit-gating vs action applicability) and 08 flags the debate, but no file states the boundary rule. Minor.
5. **Skeleton-vs-spinner tag mismatch.** 03 §2.11 tags "prefer skeletons" [mechanical]; 06 §B.17 tags the same rule [judgment]; both contested sections then qualify it. Harmonize the tag (judgment is correct given both files' own caveats).
6. **Text-size floor edge.** 04 §1.3 permits "~11–12px" for captions; 05 §8.59 says "never below 12px anywhere," and the project's owner order fixes 12px as permanent. 04's 11px lower bound should read 12px for this project.

Checked and consistent (no action): toast durations (03 §5.35 4–10s; 01 §N.130 undo 5–10s; 03 §15.114 commit-delay); validation timing (01/03/05 identical); touch targets 24/44/48 (01/05/06 identical); one-primary-action (01/04); sentence case (only 04 owns it; 07/08 silent); guest checkout (02/06 duplicated by declared cross-ref); permission priming (02/06/07/08 aligned); password/paste rules (01/02/05/06 aligned); pull-to-refresh (03 §9.79 requires it on feeds, 06 §M.99–100 governs its mechanics — complementary); focus-on-confirmation-dialog (01 §K.93–94 vs 03 §15.112 — aligned on least-destructive default).

Redundancy hygiene overall is unusually good: the eight cross-reference sections mostly declare their overlaps, and sampled duplicates agree on substance.

---

## (e) Verdict

The set is genuinely comprehensive — materially broader than any single published map it was diffed against.

<!-- verdict written pre-patch; see "Patched 2026-07-22" below for what has since been closed --> Roughly 90–95% of the territory named by Tidwell, About Face, NN/g, HIG/M3, and Baymard has a clear owning file, usually at build-from-able depth, with sourcing and mechanical/judgment tagging that most leading teams' internal guidelines lack. Engagement ethics (08 §A), accessibility (05), anti-dark-patterns (06 §S), and conversational AI (07) are ahead of the public state of the art. A team that actually adheres to these files operates at leading-team level for screen-level product craft; the failures it would still be exposed to are the unowned seams, not the owned centers. What must be added first, in order: **(1) timers and time/duration entry** — it is this product's core in-session loop and the single most surprising absence; **(2) sharing/share-card conventions** — the growth loop has no owner; **(3) UGC report/block/moderation** — mandatory the day the community surface ships; then resolve the two mechanical contradictions (Enter-to-send boundary, OTP auto-submit) so the lint layer can't give contradictory answers, and backfill i18n/RTL and editor-undo before those surfaces expand. No ninth file is required unless the community surface grows into a major domain; every other gap has an obvious host section.

---

## Patched 2026-07-22

All gaps and contradictions above were closed in a patch session on 2026-07-22. Canon grew from 1,213 to **1,311 principles** (+98). New per-file counts: 01 → 182, 02 → 189, 03 → 137, 04 → 168, 08 → 191 (05/06/07 counts unchanged; 06 and 07 received edits only).

### Gaps → CLOSED

1. **Timers/stopwatches/time-duration entry (MISSING, product-core)** → CLOSED at full depth (19 principles): 01 §S "Time and duration entry" (157–163: mm:ss entry, time-of-day picker with keyboard mode, presets/steppers, numeric keyboards, precision matching, format consistency, relative-time resolution) + 03 §18 "Running timers, stopwatches, and live sessions" (126–137: timestamp-derived timers, background/lock correctness, pause/skip/extend, multi-channel completion cues honoring silent mode, notification-on-complete with the web's scheduled-notification limits stated honestly, screen wake lock with visibilitychange re-acquisition, persistent in-progress-session affordance, crash survival, stopwatch contract, auto-start as setting-controlled [judgment], accessible announcements). Countdown-overrun behavior added to 03's contested list (genre-dependent).
2. **Sharing and invites (MISSING)** → CLOSED: 08 §E (163–173): native share sheet, designed share cards/OG previews, minimum-scope sharing, link permissions + revocation, copy-link honesty, no auto-posting, content-first landing + deep links, no contact harvesting, referral-term disclosure, invite-context landing, sender-side status without recipient nagging.
3. **UGC report/block/moderation + reviews display (MISSING-if-ships)** → CLOSED: 08 §F (174–187): report affordance everywhere (App Store Guideline 1.2 / Play UGC policy verified as the requirement floor), structured report flow, complete silent two-way block, published content rules, both-sides moderation feedback + appeals, profile privacy/preview, comment anatomy, attribution/dating of community content, mute-vs-block, and reviews display per Baymard (distribution histogram, helpful/recent sort + star filter, review context, one-tap rating, FTC 16 CFR 465 anti-fake-review rules).
4. **i18n beyond string mechanics (THIN)** → CLOSED: 04 §14 "Internationalization and RTL" (162–168: logical-property mirroring, icon-flip rules, bidi isolation, RTL testing, translation-completeness gate, script metrics, single formatting layer) + 01 §U (168–171: names, country-adaptive addresses, unit preference, locale calendars/week start).
5. **Editor undo/save/canvas (THIN→MISSING here)** → CLOSED: 01 §V (172–178): multilevel undo/redo with platform bindings, intent-sized undo units, undoability boundaries, visible toolbar undo, version history/restore, canvas pan/zoom contract, canvas selection contract.
6. **Recurrence and calendar views (THIN)** → CLOSED: 01 §T (164–167: preset-first recurrence builder with plain-English echo, day chips, end conditions, this/following/all edit scope) + 02 §18 (172–175: view granularity, Today, item state, drag-to-reschedule with explicit alternative).
7. **Transactional/notification email (THIN)** → CLOSED: 02 §19 (176–181): single-CTA design, subject/sender conventions, hostile-client robustness, why-you-got-this, expiring-link recovery, marketing/transactional stream separation.
8. **Overlay-container selection and sheet mechanics (THIN)** → CLOSED: 02 §17 (166–171): container-by-task-weight decision rule, modality restraint, bottom-sheet detents/drag-handle contract, gesture+visible dismissal, no nesting, cross-breakpoint container pairing.
9. **Repeat/duplicate accelerators (THIN)** → CLOSED: 01 §W (179–182): repeat-last, duplicate as first-class action, recents/templates-first creation, ghost-value prefill.
10. **Downloads/export delivery (THIN, minor)** → CLOSED: 08 §G (188–191): descriptive filenames, background-export contract, platform-matched delivery (browser vs share-sheet, webview detection), where-did-it-go confirmation.
11. **In-app notification inbox (THIN, minor)** → CLOSED: 02 §20 (182–185): inbox as durable record, per-item unread + badge agreement, item anatomy/grouping/deep-links, no-marketing + retention.
12. **Guest→account migration (THIN, minor)** → CLOSED: 02 §21 (186–189): lossless merge on signup, stated data handling, existing-account reconciliation, guest limits stated up front.

### Contradictions → RESOLVED

1. **Enter-to-send boundary** → RESOLVED: boundary notes added to BOTH 01 §B.24 and 07 §C.23 — chat composers send on Enter with Shift+Enter for newline; document/form multi-line textareas never submit on plain Enter (Cmd/Ctrl+Enter as optional submit); each note cross-references the other and states this is not a contradiction once scoped.
2. **OTP auto-submit** → RESOLVED: 06 §Q.133 retagged [contested] with the WCAG 3.2.2 tension (05 §14.101) cited inline and in 06's contested list; auto-ADVANCE stays rejected as-is (05 §14.101 unchanged); auto-SUBMIT flagged as needing a house decision, with the required feedback/error-path conditions if adopted.
3. **Load More vs infinite scroll** → RESOLVED: 02's contested-list entry replaced with the house rule adopted 2026-07-22 — default Load More (Baymard-evidenced), matching 08 §B3.64, with 08 §B3.65–66's feed/reference carve-outs; 08 left as-is.
4. **Skeleton-rule tag mismatch** → RESOLVED: 06 §B.17 retagged [judgment]→[mechanical] to match 03 §2.11 (show-delay, min-visible duration, and layout match are lint/test-checkable); the where-to-use boundary remains flagged in both files' contested lists.
5. **Text-size floor** → RESOLVED: 04 §1.3 rewritten to a 12px absolute floor with labels 13px+ on phones, cited to the owner's permanent standing order (2026-07-19) and noted as deliberately stricter than HIG 11pt / M3 11sp; now consistent with 05 §8.59.

(Item 4 of the sweep's conflict list — disabled-control boundary — was noted "Minor" with no assigned fix and was left as documented.)
