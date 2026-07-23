# UX Canon 03 — Feedback, States, and System Status

Domain: everything about the app telling the user what is happening. Compiled 2026-07-22 from Nielsen Norman Group, Material 3, Apple Human Interface Guidelines, Vercel Web Interface Guidelines, GOV.UK Design System, WCAG 2.2, and offline-first/PWA guidance. Each principle: **rule** — plain-English explanation — [sources] — [mechanical] (checkable by inspection/test) or [judgment] (requires a design call).

## 1. Response-time thresholds

1. **Respond to every input within 0.1 seconds or the interaction stops feeling direct.** Under 100ms the user perceives the result as instantaneous cause-and-effect; no feedback indicator is needed beyond the result itself. Every tap, toggle, keypress, and hover must visibly react inside this window even if the real work takes longer. — [NN/g Response Times; Apple HIG Feedback] — [mechanical]
2. **Keep the user's flow of thought intact up to 1 second.** Between 0.1s and 1s the user notices the delay but stays in flow; show a subtle state change (pressed button, cursor) but no loading indicator. — [NN/g Response Times] — [mechanical]
3. **Show a loading indicator for anything that takes longer than about 1 second.** Past 1s users start to feel the machine is working on something; silence past this point reads as breakage. — [NN/g Response Times; Material 3 Progress Indicators] — [mechanical]
4. **10 seconds is the limit for keeping attention on the task at all.** Past 10s users mentally leave; anything that can take this long needs a percent-done progress indicator, an expected-duration estimate, and ideally the freedom to do something else while waiting. — [NN/g Response Times; NN/g Progress Indicators] — [mechanical]
5. **Never let feedback flash: delay indicators ~150–300ms and keep them visible ~300–500ms minimum once shown.** A spinner that appears and vanishes in 80ms reads as a glitch; a fast response should show no indicator at all, and one that does appear should stay long enough to be perceived. — [Vercel Web Interface Guidelines; NN/g Skeleton Screens] — [mechanical]
6. **Optimize perceived time, not just actual time.** Order of effectiveness: make it actually fast, then make it feel fast (skeletons, optimistic UI, progressive rendering), then make the wait tolerable (progress, entertainment). Never use loading theater to disguise a fixable slow path. — [NN/g; Vercel] — [judgment]
7. **Render something meaningful first; stream the rest.** Show the page shell, cached data, or above-the-fold content immediately rather than blocking the whole screen on the slowest query. — [Vercel; PWA guidance; NN/g] — [mechanical]

## 2. Loading indicators — which one, when

8. **Under ~1s: no indicator.** Quick flashes of skeletons or spinners make fast responses feel slower and jankier than showing nothing. — [NN/g Skeleton Screens; Vercel] — [mechanical]
9. **~1–10s with unknown duration: spinner or skeleton.** Indeterminate indicators say "working" without promising an ETA; they are correct only in this band. — [NN/g Progress Indicators; Material 3] — [mechanical]
10. **Over ~10s (or any known-length operation): determinate progress bar.** Show percent complete; add a time or step estimate for long operations. An indeterminate spinner running for 30 seconds is a broken promise. — [NN/g Progress Indicators; Material 3] — [mechanical]
11. **Prefer skeletons over spinners for loading content regions.** Research shows skeleton screens are perceived as faster and leave users happier than spinners for content loads; spinners draw attention to the wait itself. — [NN/g Skeleton Screens vs Progress Bars vs Spinners] — [mechanical]
12. **Skeletons must mirror the final layout exactly.** Same dimensions, same positions, same count of placeholder blocks as the real content, so nothing jumps when data arrives. A skeleton that doesn't match the final content is worse than a spinner. — [Vercel; NN/g Skeleton Screens] — [mechanical]
13. **Use one skeleton per region, not one per atom.** Skeletonize the meaningful content blocks (a card, a list row), not every icon and badge; excessive shimmer reads as noise. — [NN/g Skeleton Screens; Material] — [judgment]
14. **Animate skeletons with a slow, left-to-right shimmer or gentle pulse — or not at all.** Motion in skeletons is optional; if used it should be subtle and slow (fast pulsing increases perceived wait and can trigger vestibular issues). Respect `prefers-reduced-motion`. — [NN/g; Material; WCAG 2.3.3] — [mechanical]
15. **Use localized indicators, not full-screen ones, whenever only part of the screen is loading.** Block only the region that is actually waiting; keep the rest of the UI interactive. Full-page overlays/blocking spinners are a last resort for truly page-level operations. — [Material 3 Progress Indicators; NN/g] — [mechanical]
16. **Never show more than one loading indicator for the same operation.** One fetch, one indicator. Multiple spinners for one action reads as chaos. — [Material 3; general consensus] — [mechanical]
17. **Loading states must be accessible: announce busy state to assistive tech.** Use `aria-busy` on the loading region and a polite live region announcing "Loading" and completion; a silent visual spinner is invisible to screen-reader users. — [WCAG 4.1.3; Vercel] — [mechanical]
18. **Never fake progress.** Progress bars that crawl to 90% and stall, or fabricate motion unrelated to real work, destroy trust in every future indicator. If real progress is unknowable, use indeterminate — honestly. (Slight smoothing/easing of real progress is accepted.) — [NN/g Progress Indicators] — [judgment]
19. **On very long waits, say what is happening in words.** Step labels ("Uploading photos… 2 of 5", "Analyzing…") make long operations feel supervised rather than hung, and help support conversations. — [NN/g; Material] — [mechanical]
20. **Loading must not trap the user.** Navigation, back, and cancel remain available while content loads; a load state that locks the whole app for a single panel's fetch is a defect. — [NN/g; Apple HIG] — [mechanical]

## 3. Buttons and controls while pending

21. **A pressed button must instantly show it was pressed.** Visual pressed state within 100ms, before any network round trip. — [Apple HIG Feedback; NN/g 0.1s] — [mechanical]
22. **A button doing async work keeps its label and adds a spinner — it never turns into a bare spinner.** "Save" becomes "Save" + inline spinner (or "Saving…"), so the user still knows what is in flight. Replacing the label removes the context exactly when it matters. — [Vercel Web Interface Guidelines] — [mechanical]
23. **Disable or guard the trigger during the request to prevent duplicate submission.** Double-taps on Submit must not create two orders. Either disable with visible pending state, or make the server idempotent and swallow repeats — preferably both. — [NN/g; GOV.UK; Vercel] — [mechanical]
24. **Preserve the control's dimensions during its pending state.** The button must not change width/height when the spinner appears; reserve space so the layout is stable. — [Vercel; Material] — [mechanical]
25. **Show pending state on the thing the user touched, not somewhere else.** Feedback appears at the locus of attention: the row being deleted dims, the toggled switch shows in-flight state. A global spinner in a corner for a local action fails the "what did my tap do" test. — [Apple HIG; NN/g] — [mechanical]
26. **Pending is a real designed state for every interactive control.** Every button, toggle, and menu item that can hit the network has a designed in-flight appearance — not just default and done. — [Material states; Vercel "all states designed"] — [mechanical]

## 4. Optimistic UI

27. **Use optimistic updates when success is highly likely and the change is small and local.** Likes, toggles, renames, reorderings, checklist ticks: update the UI immediately, sync in the background. Reserve pessimistic (wait-for-server) flow for payments, irreversible actions, and low-confidence operations. — [Vercel; NN/g Optimistic UI consensus] — [judgment]
28. **Reconcile with the server response when it arrives.** The optimistic value is a prediction; when the authoritative result returns, silently converge the UI to it (IDs, computed fields, server-side ordering). — [Vercel] — [mechanical]
29. **On failure, visibly roll back or offer retry — never silently lose the change.** The user saw it succeed; if it actually failed they must see that too: revert the UI with an error message, or keep the item in a visible "failed, tap to retry" state. Silent rollback with no message is the worst outcome. — [Vercel; consensus] — [mechanical]
30. **Do not stack optimistic writes the user can't untangle.** If several optimistic operations are in flight, failure handling must identify which one failed; if you can't do that, queue them or go pessimistic. — [consensus] — [judgment]
31. **Never optimistically confirm what the user will act on next.** Don't optimistically show "Payment complete" or "Booked" — anything the user will walk away from or build on must be server-confirmed. — [consensus] — [judgment]

## 5. Success feedback — toasts and snackbars

32. **If the result of an action is visible in place, no toast is needed.** The item appearing in the list IS the confirmation; a toast repeating it is noise. Toast only when the result happens off-screen or is otherwise invisible. — [NN/g Toasts; Material 3 Snackbar] — [judgment]
33. **Confirm actions whose result the user cannot see.** "Link copied", "Saved to your library", "Email sent" — when nothing on screen changes, a brief confirmation is required, not optional. — [NN/g; Material 3] — [mechanical]
34. **One snackbar/toast at a time.** A new message replaces the current one; never stack a column of toasts. (Some desktop notification centers stack; transient in-app snackbars do not.) — [Material 3 Snackbar] — [mechanical]
35. **Auto-dismiss transient toasts after roughly 4–10 seconds.** Material default is ~4s (short) to ~10s (long). Persist longer only for messages with actions. — [Material 3 Snackbar] — [mechanical]
36. **A toast carries at most one action, and never a critical one.** One optional action ("Undo", "View"), short label. If acting on the message is required, a toast is the wrong component — use a dialog or inline UI. — [Material 3 Snackbar; NN/g Toasts] — [mechanical]
37. **Anything reachable only via a toast must be reachable somewhere else too.** Toasts expire; if "Undo" or "View item" only ever existed in a 4-second toast, users who missed it are stranded. — [Material 3; NN/g] — [mechanical]
38. **A toast with an action must not auto-dismiss too fast for assistive tech.** Screen-reader and switch users need time to reach the action; use a long/indefinite duration (or persistent alternative) when an action is present. — [Material 3; WCAG 2.2.1] — [mechanical]
39. **Toasts must not cover the thing the user is working on.** Position where they don't block primary controls (bottom on mobile, avoiding FABs/input bars); they must never obscure the control the user just used or is about to use. — [Material 3; NN/g] — [mechanical]
40. **Never put errors that need action in a transient toast.** Failures the user must deal with go inline or in a dialog; a vanishing error is an unread error. Toast errors are acceptable only for background operations with a persistent record elsewhere. — [NN/g; GOV.UK] — [mechanical]
41. **Announce toasts politely to screen readers.** `role="status"` / polite `aria-live` for confirmations; do not steal focus. — [Vercel; WCAG 4.1.3] — [mechanical]
42. **Keep toast copy to one short sentence in the product voice.** State what happened, not celebration prose. — [Material 3; NN/g] — [judgment]
43. **Success feedback should be proportional to the achievement.** A saved setting gets a quiet tick; a completed workout can get a moment. Confetti for trivia devalues real milestones. — [Apple HIG; judgment consensus] — [judgment]

## 6. Error states — anatomy and placement

44. **Every error message answers three questions: what happened, why (if useful), and what to do next.** "Something went wrong" answers none of them. Tell the user how to fix it or what will happen instead. — [NN/g Error Message Guidelines; Vercel; GOV.UK] — [mechanical]
45. **Write errors in plain human language — no codes, no jargon, no blame.** "Your card was declined — try another card" not "Error 402: transaction rejected." Keep technical detail behind a "details" affordance for support. — [NN/g; GOV.UK] — [mechanical]
46. **Never blame the user.** Say what the system needs, not what the user did wrong ("Enter a date after today" not "You entered an invalid date"). No "oops", no shouting, no humor in serious failures. — [NN/g; GOV.UK Error Message] — [judgment]
47. **Form-field errors go inline, next to the field, and persist until fixed.** Error text adjacent to the offending field, field visually marked (not by color alone), message stays visible while the user corrects it. — [NN/g; GOV.UK; WCAG 3.3.1] — [mechanical]
48. **On submit failure of a multi-field form, add an error summary at the top that links to each field.** List all errors in one place, each a link that moves focus to the field; move focus to the summary on render. — [GOV.UK Error Summary; WCAG] — [mechanical]
49. **Validate at the right moment: on blur or submit, not on every keystroke of an incomplete entry.** Premature validation yells at users mid-typing; late-only validation wastes a round trip. Validate a field once the user has finished with it; re-validate live once it has been in error. — [NN/g inline validation; Baymard consensus] — [mechanical]
50. **Never clear the user's input on validation failure.** All entered data survives an error, including on password fields where feasible per security policy, and on back navigation. — [NN/g; GOV.UK; WCAG 3.3.7] — [mechanical]
51. **Page-level errors (load failed, not found, no permission) get a designed full-region state with a way forward.** Illustration optional; required: plain statement, a retry or an exit path (home, back, search), and preserved chrome so the user isn't stranded. — [NN/g; GOV.UK] — [mechanical]
52. **Do not use error messages for ineligibility or permission problems.** If the user cannot fix it, don't frame it as an error to correct — take them to a page explaining the situation and what they can do instead. — [GOV.UK Error Message] — [judgment]
53. **Every failed network operation offers retry.** A "Retry" button on the failed region; never force a full-page manual reload as the only recovery. Retries should be safe (idempotent) to repeat. — [NN/g; PWA guidance; Vercel] — [mechanical]
54. **Auto-retry transient failures quietly with exponential backoff before bothering the user.** One blip should not surface an error screen; surface only after retries fail, then show the manual retry. Cap retries; never hot-loop. — [PWA/offline guidance; consensus] — [mechanical]
55. **Distinguish "your connection" from "our server" from "your input."** The user's next move differs completely for each; the message must say which it is ("You're offline" vs "We're having trouble" vs field error). — [NN/g; PWA guidance] — [mechanical]
56. **Error prevention beats error messages.** Constrain inputs (pickers, formatters, sensible defaults), disable-or-explain invalid actions, warn before destructive ones — every prevented error outranks the best-written message. — [NN/g Heuristic #5] — [judgment]
57. **But do not use disabled controls as silent error messages.** A dead button with no explanation is a mystery; either keep it enabled and explain on press, or pair the disabled state with visible reason text. — [NN/g; GOV.UK; contested edges, core is consensus] — [judgment]
58. **Log and aggregate client-side errors; the user report is not your telemetry.** Every user-facing error state should also emit diagnostics, so "it sometimes fails" is answerable. — [Vercel; engineering consensus] — [mechanical]
59. **An error state must not destroy surrounding context.** One widget failing shows its own error; it does not blank the page. Error boundaries isolate failures to the smallest region. — [React/Vercel consensus; NN/g] — [mechanical]
60. **Use `role="alert"`/assertive live region for errors that block the user; polite for advisories.** Errors must be announced to assistive tech at the urgency they warrant. — [WCAG 4.1.3; GOV.UK] — [mechanical]

## 7. Empty states

61. **Every list, feed, search, and dashboard has a designed empty state — blank is a bug.** An empty region with no explanation reads as broken. "All states designed" includes empty. — [NN/g Empty States; Vercel; Material] — [mechanical]
62. **First-use empty state: explain what will live here and give the primary action to create it.** One sentence of what this area is + a prominent CTA ("Log your first workout"). This is onboarding real estate, not dead space. — [NN/g Empty States] — [mechanical]
63. **User-cleared empty state: confirm the good news, keep it calm.** Inbox-zero style: acknowledge completion ("You're all caught up"), no CTA pressure, no sad iconography. — [NN/g Empty States] — [judgment]
64. **No-results empty state: restate the query, say nothing matched, and offer ways out.** Show the search term, suggest spelling/broader terms, offer to clear filters, and show which filters are active — never a bare "No results." — [NN/g; Baymard] — [mechanical]
65. **Error-empty state is not an empty state — never show "nothing here" when the truth is "we couldn't load it."** A failed fetch must show the error+retry state; showing the first-use empty state on failure lies to the user (and can prompt destructive "re-create" actions). This is one of the most common real-world state bugs. — [NN/g; Vercel; PWA guidance] — [mechanical]
66. **Filtered-to-empty shows the active filters and a one-tap clear.** When the user's own filters hid everything, say so and make undoing it trivial. — [NN/g; Baymard] — [mechanical]
67. **Empty states match the product's visual system — not a bare gray icon dropped in.** They're designed surfaces with the same typographic and spacing rhythm as populated ones; generic placeholder art is a defect. — [NN/g; Material] — [judgment]
68. **Consider sparse states, not just empty ones.** One item in a grid built for twenty also needs to look intentional; design the 1-item and 2-item render, not just 0 and full. — [Vercel "empty, sparse, dense, error"] — [judgment]

## 8. Offline and flaky-network behavior

69. **Detect and tell the user when they're offline — before they hit a failure.** A visible, non-blocking indicator (banner/badge) when connectivity is lost; don't let the first sign be a failed action. Listen for online/offline events plus real request failures (the browser flag lies both ways). — [PWA offline UX guidance; NN/g] — [mechanical]
70. **Offline is a state, not an error.** Going offline should degrade capability, not detonate the app: show cached content, allow reading, mark unavailable actions — not a full-screen dinosaur. — [PWA guidance; Apple HIG] — [judgment]
71. **Show cached/stale content in preference to nothing, and label it as such.** Last-loaded data with a "last updated" indication beats a blank error for reading-oriented surfaces. — [PWA guidance; NN/g] — [mechanical]
72. **Queue user writes made offline and sync when connectivity returns.** Actions taken offline (logging a set, composing a message) are stored and replayed — with visible "pending sync" status per item — rather than rejected. — [PWA/Background Sync guidance] — [mechanical]
73. **Tell the user what got queued and confirm when it syncs.** Pending items are visually marked (clock icon, "waiting for connection"); on reconnect they flip to synced state, with notification only if the user has navigated away. — [PWA guidance; Material] — [mechanical]
74. **Never let a flaky network double-apply a queued action.** Idempotency keys / dedupe on replay; the retry infrastructure must be exactly-once from the user's perspective. — [engineering consensus] — [mechanical]
75. **Design for slow as well as absent connectivity.** Timeouts with helpful messaging, small critical payloads, and interactivity that doesn't block on analytics or non-critical fetches. Lie-fi (connected but useless) is more common than offline. — [PWA guidance; NN/g] — [judgment]
76. **Recover automatically when connection returns.** On reconnect: dismiss the offline banner, retry failed loads, flush the queue — without requiring a manual refresh. — [PWA guidance] — [mechanical]

## 9. Data freshness and sync

77. **Show when data was last updated wherever staleness changes its meaning.** Dashboards, prices, live stats: a "Updated 2 min ago" (relative time) tells the user whether to trust what they see. Static content doesn't need it. — [NN/g; dashboard consensus] — [judgment]
78. **Use stale-while-revalidate: render cached data instantly, refresh in the background, then update.** The user sees content immediately and it quietly becomes current — the standard pattern for feed/dashboard surfaces. — [Vercel; PWA guidance] — [mechanical]
79. **Pull-to-refresh on mobile feeds and lists; a refresh affordance on desktop equivalents.** Users expect to be able to demand freshness on any feed-like surface; the gesture must show its own progress state. — [Apple HIG Refresh; Material] — [mechanical]
80. **Background refresh must not yank content out from under the user.** If new items arrive while the user is reading/scrolled, don't insert them at their scroll position — see §11 layout-shift rules; offer a "New items" affordance instead. — [NN/g; Twitter/Material pattern consensus] — [mechanical]
81. **On sync conflict, never silently discard either side.** Last-write-wins silently losing user work is a defect. Standard resolutions: automatic merge when safe, otherwise present both versions and let the user choose; at minimum, keep the losing copy recoverable. — [offline-first consensus; Google Drive/Docs patterns] — [judgment]
82. **Refetch on focus/reconnect for data that others can change.** Returning to a tab after an hour should not show hour-old shared data with no refresh; revalidate on window focus and network regain. — [SWR/React Query convention; Vercel] — [mechanical]

## 10. State persistence

83. **Drafts survive everything.** Text the user typed persists through navigation, refresh, tab close, session expiry, and crash — via continuous local persistence (and server autosave for long content). Losing typed input is among the most-hated failures in software. — [NN/g; GOV.UK; WCAG 3.3.7] — [mechanical]
84. **Back must return the user to what they saw, including scroll position.** Back/forward restores prior scroll and page state; a feed that resets to the top on back breaks the browsing loop. — [Vercel; NN/g Back Button] — [mechanical]
85. **Form state survives back navigation and validation failure.** Returning to a form finds it as the user left it; server-side validation errors re-render with all input intact. — [GOV.UK; NN/g] — [mechanical]
86. **Persist shareable view state in the URL.** Filters, tabs, search terms, selected item: encoded in the URL so refresh, share, and back/forward all work. App state that vanishes on refresh is a defect for anything a user might want to return to. — [Vercel Web Interface Guidelines] — [mechanical]
87. **Restore the user's place across sessions for multi-step or long content.** Reopening the app resumes the wizard step, the reading position, the half-done workout — with an explicit way to start over. — [Apple HIG (state restoration); NN/g] — [judgment]
88. **Remember user choices about the UI itself.** Dismissed banners stay dismissed; chosen sort orders, collapsed sections, and view modes persist. Re-asking every session teaches users their input is ignored. — [NN/g; consensus] — [mechanical]

## 11. Interruption handling — timeouts, expiry, autosave

89. **Warn before any session timeout, at least 2 minutes ahead, and let the user extend without losing work.** A dialog: time remaining, "Stay signed in" action; extension resets the clock. Silent expiry that eats a form is a WCAG 2.2.1 failure and a rage generator. — [GOV.UK timeout pattern; WCAG 2.2.1 Timing Adjustable] — [mechanical]
90. **If a session must expire, preserve the user's work across re-authentication.** After re-login the user returns to where they were, drafts intact. Data loss is never the punishment for stepping away. — [GOV.UK; WCAG 2.2.5 Re-authenticating] — [mechanical]
91. **Autosave continuously for any long-form input; show its status.** Save-as-you-type with a quiet "Saved"/"Saving…" indicator; an explicit Save button is optional on top, not the only safety net. — [NN/g; Google Docs convention] — [mechanical]
92. **The "Saved" indicator must be truthful and current.** Show "Saving…" while in flight, "Saved" only after confirmation, and an unmissable state if autosave is failing (e.g., offline) — a lying "Saved" is worse than none. — [consensus] — [mechanical]
93. **Warn before discarding unsaved changes — but only when there is something to lose.** Navigating away from a dirty form prompts (or auto-drafts); navigating away from an untouched form never prompts. — [NN/g; Apple HIG] — [mechanical]
94. **Handle interruption as a first-class flow on mobile.** Incoming call, app backgrounding, notification taps: the app returns to exactly its prior state, timers and in-progress operations correctly resumed or reconciled. — [Apple HIG; Android app lifecycle guidance] — [mechanical]

## 12. Real-time updates and layout stability

95. **Live updates must not cause layout shift under the user's pointer or reading position.** Reserve space for content that will arrive (images with dimensions, fixed-height slots for async data); values updating in place must not resize their containers and reflow the page. Cumulative Layout Shift is a measurable, budgeted defect. — [Vercel; Core Web Vitals; NN/g] — [mechanical]
96. **New items in a feed announce themselves; they don't shove.** While the user is scrolled into content, arrivals go behind a "N new items" pill; the list only moves when the user asks. At-top behavior may insert live. — [Material; consensus pattern] — [mechanical]
97. **Update live values calmly.** Subtle transition (brief highlight, count-up) for changed numbers; no blinking, no per-second flashing. Batch high-frequency updates to a human-readable cadence. — [dashboard consensus; Material motion] — [judgment]
98. **Show liveness state for real-time surfaces.** Connected/reconnecting/disconnected status for anything claiming to be live (chat, live stats); a dead websocket silently posing as live data is a lie. — [consensus] — [mechanical]
99. **Presence and typing indicators follow platform conventions.** If you show them, they must be accurate and promptly cleared; a stuck "typing…" erodes trust in all status. — [messaging-app consensus] — [judgment]

## 13. Multi-tab and multi-device consistency

100. **The same account's state converges across tabs and devices.** An action in one tab reflects in others (storage events / server push / focus revalidation) — at minimum on focus, ideally live. Two tabs showing contradictory truths is a defect. — [SWR/offline-first consensus] — [mechanical]
101. **Logout and login propagate to all tabs immediately.** A tab left open after logout elsewhere must not keep operating as the old user; auth changes broadcast across tabs. — [security consensus] — [mechanical]
102. **Guard against multi-tab edit collisions on the same record.** Detect concurrent edits (version stamps); on conflict apply §9's conflict rule — never silently overwrite the other tab's save. — [consensus] — [mechanical]

## 14. Long operations, background work, and cancelability

103. **Any operation past a few seconds runs in the background and frees the UI.** Export, upload, report generation: kick it off, let the user keep working, notify on completion. Never hold a screen hostage to a long job. — [NN/g 10s rule; Material; Apple HIG] — [judgment]
104. **Background work has a visible, findable status.** A progress affordance (upload tray, tasks panel, per-item badge) the user can check; work that vanishes into the void until an eventual toast fails visibility of system status. — [NN/g Heuristic #1; Material] — [mechanical]
105. **Long operations are cancelable wherever cancellation is meaningful.** Uploads, exports, searches: a cancel affordance that actually aborts the work and returns to the prior state. Say so if a step cannot be canceled ("Finishing up — can't cancel"). — [NN/g Progress Indicators; Apple HIG] — [mechanical]
106. **Report partial failure honestly in batch operations.** "47 of 50 imported — 3 failed" with access to which and why + retry-failed; never a bare success toast over a partial failure. — [consensus] — [mechanical]
107. **Completion of background work notifies proportionally to where the user is.** In-app and looking at it: inline state change. In-app elsewhere: toast/badge. Away: push/email only if the user opted in and the result matters. — [Material; Apple HIG notifications] — [judgment]
108. **Multi-step operations show which step they're on.** Determinate step indicators ("Step 2 of 4: Processing video") for compound jobs; a single opaque bar for a 5-phase pipeline reads as stuck at phase boundaries. — [NN/g; Material] — [mechanical]

## 15. Confirmations economy — confirm vs undo vs just do it

109. **Default to just doing it; make it undoable.** For routine, reversible actions, confirmation dialogs are friction that users learn to click through blindly. Undo (immediate, discoverable) is strictly better feedback than a pre-emptive "Are you sure?". — [NN/g Confirmation Dialogs; Material Snackbar+Undo; Vercel] — [judgment]
110. **Confirm only what is destructive, costly, and hard to reverse.** Deleting an account, sending to 10,000 people, overwriting work: confirmation earns its place only when the consequence is serious AND undo is infeasible. — [NN/g Confirmation Dialogs] — [judgment]
111. **A confirmation dialog states the specific consequence and names the object.** "Delete 'Leg Day — July 3'? This can't be undone." — never generic "Are you sure?". Buttons are verbs ("Delete", "Cancel"), not Yes/No. — [NN/g; Apple HIG; GOV.UK] — [mechanical]
112. **The destructive option is visually distinct and never the default/primary-styled action.** Red/destructive styling on the dangerous button; safe action gets default focus; Enter must not destroy. — [Apple HIG; Material] — [mechanical]
113. **For catastrophic irreversible actions, require typed confirmation or equivalent friction.** Type-the-name-to-delete for repos/accounts/all-data; a one-click path to catastrophe is a defect, not efficiency. — [GitHub/consensus pattern] — [mechanical]
114. **Undo windows must be long enough to act on and honest.** If offering "Undo" in a toast, delay the irreversible commit until the window closes; an Undo that sometimes doesn't work is worse than none. Provide a durable route (Trash, version history) for slower regret. — [Material; NN/g; Gmail pattern] — [mechanical]
115. **Never chain confirmations.** One decision, one dialog. Two "Are you REALLY sure?" layers signal the flow should have been undo-based. — [NN/g] — [mechanical]

## 16. Badging and unread state

116. **A badge must represent something specific, new, and actionable — and clear when it's seen or handled.** Badges that never clear, or that count things the user can't act on, train users to ignore all badges. Define exactly what increments and what decrements each badge. — [Apple HIG Notifications/Badging; Material Badge] — [mechanical]
117. **Numeric badges count items; dot badges signal "something new" — don't mix semantics.** Use a count where the number matters (unread messages), a dot where it doesn't (new feature flag); cap displayed counts ("99+"). — [Material Badge; Apple HIG] — [mechanical]
118. **Unread/read state is tracked per item and visually distinct without relying on color alone.** Weight/dot/background differentiates unread; marking read happens on actual view, with manual mark-read/unread controls in message-like surfaces. — [platform consensus; WCAG 1.4.1] — [mechanical]
119. **Never manufacture badge urgency for engagement.** Badging marketing content or re-badging seen items is a dark pattern that destroys the channel; badges are status, not advertising. — [Apple HIG; NN/g dark-pattern consensus] — [judgment]
120. **Badge counts stay consistent across surfaces.** The tab badge, nav badge, and in-list unread markers must agree; a "3" that opens onto zero visible unread items is a trust bug. — [consensus] — [mechanical]

## 17. Haptics and sound feedback

121. **Use haptics to confirm meaningful moments, not every touch.** Success/failure of a significant action, crossing a threshold, snapping into place — not every tap (buttons already have visual+system feedback). Overuse numbs the channel and drains battery. — [Apple HIG Playing Haptics; Material/Android haptics guidance] — [judgment]
122. **Use the platform's semantic haptic vocabulary consistently.** Success, warning, error, selection-change each have a system pattern (e.g., iOS UINotificationFeedback types); the same event always gets the same haptic. Custom buzz patterns for standard events confuse. — [Apple HIG; Android haptics] — [mechanical]
123. **Haptics accompany visual feedback; they never replace it.** Every haptic pairs with a visible state change — devices may have haptics disabled, silenced, or absent (and the web has almost no haptic access). — [Apple HIG] — [mechanical]
124. **UI sounds are off by default in productivity contexts and always accompanied by visuals.** Sound is appropriate for messaging/alerts per platform settings; apps respect the ringer/silent switch and system volume, and never rely on sound as the sole signal. — [Apple HIG Playing Audio; WCAG 1.1] — [mechanical]
125. **Respect system-level feedback settings.** Reduce Motion, system haptics off, silent mode: the app's feedback degrades gracefully along with them rather than overriding. — [Apple HIG; WCAG 2.3.3] — [mechanical]

## 18. Running timers, stopwatches, and live sessions

126. **A running timer derives from wall-clock timestamps, never from tick counting — so backgrounding, screen lock, and tab throttling cannot lose time.** Store start/target timestamps and compute remaining on every render; browsers throttle background intervals aggressively, and a timer that drifts or freezes when the screen locks has failed at its one job. — [Page Visibility/background-throttling behavior (web.dev, MDN); platform timer convention] — [mechanical]
127. **On return from background, the timer is already correct — including having completed.** Reopening mid-countdown shows true remaining time; if it elapsed while away, show the completed state (with time-since-elapsed where useful), never a frozen countdown resuming from where the eye left it. — [Apple HIG state restoration; §11.94] — [mechanical]
128. **Countdowns display remaining time in mm:ss, ticking once per second with zero layout shift.** Fixed-width display using tabular numerals (canon 04 §1.11), no container resize as digits change; sub-second display only where it genuinely matters. — [canon 04; §12.95] — [mechanical]
129. **Every rest/countdown timer offers pause, skip, and extend (+15/+30s) as visible one-tap controls, live, without restart.** The converged in-workout contract: pause for interruptions, skip when ready early, extend when not. Cancel-and-recreate as the only way to adjust a running timer is a defect. — [fitness-app convergence (Apple Fitness+, Strong/Hevy-class loggers); Apple HIG] — [mechanical]
130. **Timer completion signals through every appropriate channel at once — visual state change, sound, haptic — with sound honoring silent mode and ducking rather than killing the user's audio.** Users are mid-set, phone face-down, music playing: the cue must survive any single channel being unavailable (§17.123–124; canon 08 §C5.123). — [Apple HIG playing audio/haptics; fitness convergence] — [mechanical]
131. **When the app is backgrounded, completion arrives as a system notification — scheduled at timer start and cancelled if the user returns first or cancels the timer.** Native platforms schedule a local notification. On the web, scheduled notifications are not reliably available (Notification Triggers never shipped): keep-awake during the session plus an immediate correct state on return is the honest floor, with push-based completion only where the product already has push. A stale timer notification firing after cancellation is a trust bug. — [iOS/Android local-notification convention; web platform limits] — [mechanical]
132. **Keep the screen awake during an active timed session, and release the wake lock the moment the session ends or the surface is left.** Screen Wake Lock (`navigator.wakeLock.request("screen")`) on the web, idle-timer disable on native. Re-acquire on `visibilitychange` (the OS drops the lock when the page hides), handle denial gracefully (battery saver can refuse), and never hold a lock outside a user-started session — it's the user's battery. — [Screen Wake Lock API guidance (MDN, Chrome developers); Apple/Android idle-timer convention; canon 06 §O] — [mechanical]
133. **An in-progress session is a visible, persistent state across the whole app.** Navigating away from the timer/workout screen leaves a return affordance — pinned bar, pill, or Live-Activity-style surface — showing live state; an active session must never be findable only by remembering which screen it lives on. — [Apple Live Activities / media mini-player convention; NN/g visibility of system status] — [mechanical]
134. **Sessions and timers survive app death.** Persisted timestamps mean a crash, tab discard, or reboot recovers the session with correct elapsed time and offers resume (§10.87, §16.160-style choice when stale); a workout lost to a crash is data loss, not bad luck. — [§10–11; offline-first consensus] — [mechanical]
135. **Stopwatches follow the universal contract: start/stop toggles in place, lap while running, reset only when stopped, laps listed newest-first — and elapsed time keeps counting from timestamps while backgrounded (#126).** — [iOS/Android Clock-app convergence] — [mechanical]
136. **Auto-started timers (rest timer on set completion) are a setting-controlled convenience that visibly announces itself when it fires.** Auto-start is the fitness-logger norm and saves a tap per set, but it must show itself starting — never silently count in the background — and be one toggle to disable. — [fitness-logger convergence (Strong/Hevy-class)] — [judgment]
137. **Announce timer state accessibly and calmly: completion via a live region, never per-second announcements.** `role="timer"` semantics with throttled updates; a countdown that announces every tick drowns a screen-reader user (canon 05 §5.37, don't announce noise). — [ARIA timer role; canon 05] — [mechanical]

## Cross-references

- **Perceived performance engineering** (bundle size, caching, Core Web Vitals budgets) — performance/engineering domain; here we cover only what the user is shown while waiting.
- **Form validation UX** (label placement, input masking, field design) — forms/input domain; here only the error-feedback anatomy and timing.
- **Notification strategy** (push permission timing, notification content, channels/preferences) — communication/engagement domain; here only in-app status, badges, and completion signals.
- **Accessibility of live regions and focus management** — accessibility domain owns the full ARIA/focus canon; the specific live-region rules for toasts/errors/loading are duplicated here because they are inseparable from the components.
- **Dark patterns / trust** (fake urgency, confirm-shaming in dialogs) — ethics/trust domain; badge-abuse and fake-progress rules here overlap deliberately.
- **Motion design** (durations, easing, meaningful transitions) — visual/motion domain; here only motion as feedback (skeleton shimmer, value-change transitions, reduced-motion).
- **Onboarding** — first-use empty states (§7) are the boundary; guided tours and setup flows belong to onboarding.
- **Navigation** — back-button behavior and URL state (§10) border the navigation/IA domain.

## Contested / no-consensus

- **Skeleton screens universally better than spinners** — NN/g's own research nuances this: skeletons help most for content-shaped loads under ~10s and can perform *worse* when they flash or don't match final layout; some studies find no perceived-speed benefit. Direction (prefer skeletons for content regions) is consensus; "always skeletons" is not.
- **Exact indicator thresholds** — 1s vs 2s for showing a spinner, and whether skeletons take over from spinners at 1s or 2s, varies by source (NN/g says spinners for 2–10s in some articles, >1s in others). The 0.1/1/10 structure itself is uncontested.
- **Optimistic UI as default vs opt-in** — modern web guidance (Vercel, React ecosystem) pushes optimistic-by-default for likely-success mutations; conservative enterprise guidance still prefers pessimistic with fast servers. No cross-source rule for the boundary.
- **Disabled submit buttons on invalid forms** — GOV.UK and accessibility practitioners argue against disabling (invisible reasons, screen-reader confusion); much of industry still disables until valid. Genuine split.
- **Toast position and stacking on desktop** — Material mandates one snackbar at a time; several mainstream desktop apps (and libraries like Sonner) stack up to 3. Mobile single-toast is consensus; desktop stacking is contested.
- **Character/time thresholds for autosave debounce, undo-window length** (5s vs 10s vs 30s) — every product picks its own; only the existence of the mechanisms is consensus.
- **Read-on-view vs read-on-open for unread state** — feeds mark on scroll-past, inboxes on open; no universal rule, only per-genre convention.
- **Confetti/celebration moments** — Apple HIG and fitness-app convention endorse proportional celebration; minimalist design culture rejects it entirely. Proportionality principle stated here (§5.43) is the closest to consensus.
- **Cancel-button behavior on in-flight optimistic actions** (abort vs let-finish-then-revert) — no agreed pattern.
- **Countdown overrun behavior** — general-purpose timers (Clock apps) alarm until dismissed; in-workout rest timers converge on one cue then quiet (optionally showing overrun time). Genre-dependent; no cross-genre rule.
