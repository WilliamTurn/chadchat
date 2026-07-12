# Motion and interaction-feel contract

Part of the Phase 1 contract layer (DSH-66). Pro apps feel alive because feedback is instant, motion is purposeful, and nothing surprises the member. This contract names that standard so "feels dead" and "feels janky" both become checkable failures.

## 1. Feedback latency (the feel budget)

- Every tap acknowledges within **100ms** (pressed state, optimistic value change, or skeleton). Nothing a member taps may sit inert.
- **Optimistic updates for low-risk logs**: quick-add water, checking off a set. The UI updates immediately; the server confirms behind it; failure rolls back with an error toast that keeps the value for retry. The hydration quick-add + Undo is the reference implementation.
- **Receipted updates for meaningful writes**: meal save, workout save, weigh-in. Show the success receipt with the concrete result ("Added 20 oz. 64 oz remaining today." / "Workout saved. 20 sets, 2 new personal records."), per the copy contract.
- After ANY successful log, every dependent surface on screen reconciles without a manual refresh (logger capability law; the full cross-surface refresh graph is FIX-10, Phase 4).

## 2. Motion tokens

- Standard transitions: **150 to 220ms**, ease-out for entrances, ease-in for exits.
- Progress bars/rings animate **once** to their value on load, then settle. No looping, no pulsing for ordinary states.
- Numbers may count up on first paint (<= 400ms) but land exactly and never re-animate on re-render.
- Celebrations (PR, streak milestone, goal reached): one short burst (<= 1.5s), never blocking input, always accompanied by text (never animation-only), fully suppressed under `prefers-reduced-motion`.
- Never animate alerts or negative states to demand attention (no pulsing red).

## 3. Loading states

- **Skeletons, not spinners, inside panels.** A skeleton reserves the panel's real height (performance-budget.md: zero layout shift on data arrival) and mimics the content shape.
- Page-level Suspense fallback is the composed skeleton page (TodaySkeleton is the pattern).
- Loading never renders zeros or empty-state copy. Loading, empty, and error are three different states (data-state contract).

## 4. Nothing starts uninvited (owner law)

- No timer, keyboard, autofocus, autoplay, or state change on page or dialog open. Every automatic behavior is a direct consequence of an explicit member action (rest timer starts when a set is checked off).
- Clarification vs section 2: a one-shot presentation animation of already-loaded values (a ring filling to its value, a number counting up once) is rendering, not an auto-start; it changes no state and demands no attention afterward.
- On every dialog/sheet open at mobile width: `document.activeElement` is NOT an input. Fixtures and the mobile auditor assert this.

## 5. Overlay decision tree (one rule, no per-card inventing)

| Need | Surface |
|---|---|
| Define a term, 1 to 3 sentences | Tooltip / "?" popover, dismissible |
| One-tap non-destructive quick action | Small popover, within viewport |
| Short form (2 to 5 fields), desktop | Dialog (focus-trapped, named title, visible close) |
| Short form, phone | Bottom sheet (safe-area padding, sticky primary action, close button) |
| Confirmation of a destructive act | Alert dialog naming the object + consequence |
| Data entry beyond a few fields, or any core feature | **A dedicated full page or full-screen flow with a back button.** Never a modal (owner law s168) |
| Meal logging, live workout | Full-screen focused flow |

The tiebreaker (gate ruling, 2026-07-12, encoding the s168 owner law): one-tap quick-adds may use popovers/inline controls; ANY multi-field domain logging (sleep, meal, weigh-in, measurement) is a dedicated full page or full-screen flow with a back button, NOT a dialog or sheet, unless the owner explicitly approves a sheet for that specific logger. "Short form, dialog/sheet" rows above cover non-logging forms (a rename, a goal-date change, a confirmation with one input).

Hard bans: dialog stacked on dialog; popovers floating over adjacent cards (the old sleep logger, DSH-59 class); popovers containing long forms; the same domain logging inline on one card and via popup on its neighbor (consistency is part of feel).

## 6. Destructive actions (DSH-63 class, structural rule)

- Every destructive action confirms with the named object and consequence, or provides an immediate Undo. One-tap unrecoverable deletes are a violation everywhere, including history rows.
- Confirm style: AlertDialog (the s177 goals-delete pattern is the reference).
- Undo toasts persist >= 5s and are announced to screen readers.

## 7. Navigation feel

- Every navigation lands somewhere named (route registry); back returns to the prior context with scroll/filter/date state (full restoration ships P3/FIX-03; new work must not make it harder).
- Anchors (`/nutrition#log-meal`) scroll to a visibly highlighted target, not vaguely near it.

## 8. Checkable rubric

- [ ] Tap-to-feedback <= 100ms on every interactive element (spot-check with the Playwright trace).
- [ ] Quick-adds are optimistic with Undo; meaningful saves show concrete receipts.
- [ ] All panel loading is skeleton-based, height-reserving; no spinners inside cards; no zeros during load.
- [ ] Transitions within 150 to 220ms; celebrations reduced-motion-safe and text-backed.
- [ ] No autofocus/auto-start on any open; asserted at 390px.
- [ ] Every overlay matches the decision tree row for its job; no stacked dialogs; no long-form popovers.
- [ ] Every destructive action confirms (named object) or offers Undo.
- [ ] After each fixture mutation, every dependent on-screen surface shows the new value without reload.
