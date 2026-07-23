# UX Canon 01 — Interaction and Input Mechanics

Domain: how users operate controls — buttons, forms, selection, keyboard/focus contracts, touch, destructive actions, text entry, shortcuts, bulk actions, search-as-you-type.
Sources: W3C ARIA Authoring Practices Guide (APG), WCAG 2.2, Vercel Web Interface Guidelines, Nielsen Norman Group (NN/g), GOV.UK Design System, Baymard Institute, Apple Human Interface Guidelines (HIG), Material 3 (M3).
Tags: [mechanical] = a lint/test could check it. [judgment] = needs human review.

---

## A. Buttons and controls — states and behavior

1. **Every interactive control has visible default, hover, focus, active, and disabled states.** A user must be able to tell, by look alone, that a thing is pressable and what state it is in right now. — [Material 3, Apple HIG, NN/g] — [mechanical]
2. **If it looks clickable, it must be clickable — and vice versa.** Affordance and behavior must match; underlined/colored text that does nothing, or invisible click zones, are defects. — [Vercel WIG, NN/g] — [judgment]
3. **Buttons trigger actions; links navigate.** Use a real `<button>` for actions and a real `<a>` for navigation so middle-click, Cmd/Ctrl-click, and "open in new tab" work. Never `<div onClick>` for navigation. — [Vercel WIG, APG] — [mechanical]
4. **Label buttons with the specific action, not "OK"/"Yes".** "Delete workout", "Save changes" — the label alone must tell the user what will happen, even out of context. — [NN/g, Apple HIG, GOV.UK] — [judgment]
5. **Prefer enabling the button and validating on press over disabling it.** Disabled submit buttons hide *why* the action is unavailable; if you must disable, explain the reason next to the control. — [NN/g, GOV.UK, Vercel WIG] — [judgment]
6. **Disabled controls must never be the only path to discovering a requirement.** A user staring at a grey button with no explanation is a dead end. — [NN/g] — [judgment]
7. **A pressed button that starts a network request shows a spinner and keeps its original label.** Replace-label-with-spinner-only loses the context of what is happening. — [Vercel WIG] — [mechanical]
8. **Keep submit enabled until the request starts; then disable to prevent double submission.** Disable-during-flight is the standard double-click guard; also make the operation idempotent server-side. — [Vercel WIG, Baymard] — [mechanical]
9. **One primary action per view; visually demote the rest.** Exactly one high-emphasis (filled) button per screen/dialog region; secondary and tertiary actions get lower-emphasis styles. — [Material 3, Apple HIG, NN/g] — [judgment]
10. **Place the primary action where the platform puts it and keep it consistent app-wide.** E.g., dialogs: confirming action on the trailing side (Material/web convention); whatever you pick, never flip order between screens. — [Material 3, Apple HIG] — [mechanical]
11. **Icon-only buttons need an accessible name and, on pointer devices, a tooltip.** An unlabeled icon is a guess; `aria-label` plus a delayed tooltip is the floor. — [APG, NN/g, Vercel WIG] — [mechanical]
12. **Menu/option labels that open a follow-up step end with an ellipsis (…).** "Export…" signals more input is needed; "Export" signals it happens immediately. — [Apple HIG, Vercel WIG] — [mechanical]
13. **A toggle button communicates its pressed state programmatically (`aria-pressed`) and visually.** Color alone is not enough; the pressed state must survive grayscale. — [APG Button pattern, WCAG 1.4.1] — [mechanical]
14. **Controls respond to activation within ~100ms or show progress.** Feedback beyond ~100ms feels laggy; beyond ~1s needs a progress indicator (spinner/skeleton — feedback timing itself is another domain's canon, but the button must never appear dead). — [NN/g response-time limits] — [mechanical]
15. **Never move or change a control while the user is about to press it.** Late layout shifts that swap a button's position under a moving finger/cursor cause wrong destructive taps. — [NN/g, Vercel WIG (CLS)] — [judgment]

## B. Forms — overall structure

16. **Ask only for what you need, when you need it.** Every field costs completion rate; defer optional data to after the core task. — [GOV.UK, Baymard, NN/g] — [judgment]
17. **Single-column form layout.** Multi-column forms cause skipped fields and wrong reading order; keep one field per row (short related pairs like City/Postcode are the accepted exception). — [Baymard, GOV.UK, NN/g] — [mechanical]
18. **Order fields in the order users think about them, and group related fields with visible grouping.** Name before address, address before payment; use `<fieldset>`/`<legend>` for groups like radio sets. — [GOV.UK, Baymard] — [judgment]
19. **Mark required vs optional explicitly — and prefer marking the minority.** If most fields are required, mark the optional ones "(optional)"; never rely on the asterisk alone without a key. — [Baymard, GOV.UK, NN/g] — [mechanical]
20. **Match field width to expected input length.** A 2-digit field (CVV, day) should be visibly short; a full-width postcode field misleads users about what is expected. — [Baymard, GOV.UK] — [judgment]
21. **Never make users re-enter data the system already knows.** Prefill from account data, previous steps, or detection (e.g., card type from number); repeated entry is a defect. — [NN/g, Baymard] — [judgment]
22. **Warn before navigation discards unsaved changes.** Dirty form + back/close = confirm-or-save prompt; silent data loss is one of the worst UX failures. — [Vercel WIG, NN/g] — [mechanical]
23. **Preserve user input across errors, refreshes, and back-navigation.** A failed submit or an auth timeout must never blank the form; restore every field the user filled. — [Baymard, NN/g, GOV.UK] — [mechanical]
24. **Forms submit on Enter from a focused text input; textareas submit with Cmd/Ctrl+Enter.** The implicit-submission contract; breaking it breaks muscle memory and password managers. Boundary note (2026-07-22): chat composers are the deliberate, scoped exception — there Enter sends and Shift+Enter inserts a newline (canon 07 §C.23). Document- and form-style multi-line textareas never submit on plain Enter; Cmd/Ctrl+Enter is the optional submit accelerator. Scoped this way, the two rules do not conflict. — [HTML spec, Vercel WIG] — [mechanical]
25. **Hydration must not eat focus or typed characters.** On JS-hydrated pages, a user who starts typing before hydration must not lose their input or caret. — [Vercel WIG] — [mechanical]
26. **Allow submitting an incomplete form so validation can surface everything at once.** Don't gate the submit button on completeness; let the attempt trigger the full error summary. — [Vercel WIG, GOV.UK] — [judgment]

## C. Labels and placeholders

27. **Every field has a visible, persistent label outside the field.** Placeholder-as-label vanishes on typing and fails recall and accessibility; labels stay visible at all times (floating labels are a [contested] partial fix — see end). — [NN/g, GOV.UK, Baymard, WCAG 3.3.2] — [mechanical]
28. **Labels are programmatically associated with their control (`for`/`id` or wrapping).** Clicking the label focuses the field; screen readers announce it; there is no dead zone between label and control. — [WCAG, Vercel WIG] — [mechanical]
29. **Position labels above the field (top-aligned) for scanning and mobile.** Left-aligned labels slow completion and break at narrow widths; top-aligned is the cross-source default. — [Baymard, GOV.UK, Material 3] — [mechanical]
30. **Placeholders show format examples, never instructions or labels, and end with … when truncatable.** e.g. label "Phone", placeholder "e.g. 07700 900123"; critical format rules go in persistent hint text below the label, because placeholders disappear. — [NN/g, GOV.UK, Vercel WIG] — [judgment]
31. **Hint/help text sits between label and input, before the user needs it.** Password rules, format requirements, and "why we ask" notes are shown up front, not revealed only as errors. — [GOV.UK, Baymard] — [mechanical]
32. **Use sentence-style, human labels; no internal jargon or database field names.** "Date of birth", not "DOB"; the label must be self-explanatory to a first-time user. — [GOV.UK, NN/g] — [judgment]

## D. Input types, keyboards, autofill

33. **Use the correct HTML `type` and `inputmode` for every field.** `type=email`, `tel`, `url`, `inputmode=numeric` etc. summon the right mobile keyboard; a numeric field showing a QWERTY keyboard is a defect. — [Vercel WIG, GOV.UK, Baymard] — [mechanical]
34. **Set standard `autocomplete` tokens and meaningful `name`s on every identity/address/payment field.** `autocomplete="given-name"`, `"postal-code"`, `"cc-number"`, `"one-time-code"` etc.; autofill compatibility is required by WCAG 1.3.5 and dramatically speeds checkout. — [WCAG 1.3.5, Baymard, Vercel WIG] — [mechanical]
35. **Never block paste, autofill, or password managers — anywhere, including confirm fields and OTP codes.** Blocking paste harms security (password managers) and accessibility; OTP fields must accept a pasted 6-digit code and support `autocomplete="one-time-code"` auto-fill. — [Vercel WIG, NN/g, NIST 800-63] — [mechanical]
36. **Disable autocorrect/autocapitalize/spellcheck on emails, usernames, and codes.** Autocorrect mangling an email address is a silent account-creation failure. — [Vercel WIG, Apple HIG] — [mechanical]
37. **Prefer `type=number` only for true quantities; use `inputmode=numeric` + pattern for codes.** `type=number` spinners and scroll-to-increment corrupt credit cards, ZIP codes, and phone numbers (leading zeros, length). — [GOV.UK, Baymard] — [mechanical]
38. **Use larger touch-friendly numeric entry (steppers) only for small adjustments; direct typing for arbitrary values.** A stepper for "reps: 8" is fine; a stepper as the only way to enter "weight: 225" is hostile — always allow tapping the value to type it. — [Apple HIG, NN/g] — [judgment]
39. **On mobile, input font-size ≥16px so iOS does not auto-zoom on focus.** The zoom-jump on focus disorients and often clips the field. — [Vercel WIG, Apple guidance] — [mechanical]
40. **Autofocus the single primary input on desktop; rarely autofocus on mobile.** On mobile, autofocus pops the keyboard over content the user hasn't read yet. — [Vercel WIG, NN/g] — [judgment]

## E. Validation — timing, placement, recovery

41. **Validate a field on blur or on submit — never on every keystroke before the user finishes.** "Premature" errors while typing (e.g. "invalid email" after one character) read as the app shouting at the user. — [Baymard, NN/g] — [mechanical]
42. **Once a field has erred, re-validate on every keystroke so the error clears the moment it's fixed.** The "reward early, punish late" pattern: lazy to show, eager to clear. — [NN/g, Baymard] — [mechanical]
43. **Errors appear inline, adjacent to (usually below or above per system) the offending field.** Never only in a toast, only at the top, or only in console; the message must be visually tied to the field. — [NN/g, GOV.UK, Baymard, Vercel WIG] — [mechanical]
44. **On submit with errors: show an error summary, move focus to the first error (or the summary), and link each summary item to its field.** GOV.UK's error-summary pattern; keyboard and screen-reader users must be routed to the problem, not left at a dead submit button. — [GOV.UK, WCAG 3.3.1, Vercel WIG] — [mechanical]
45. **Error messages say what is wrong AND how to fix it, in plain language.** "Enter a date after your start date", not "Invalid input" or error codes; never blame the user. — [NN/g heuristic 9, GOV.UK, WCAG 3.3.3] — [judgment]
46. **Error state uses more than color: icon + text, programmatically exposed (`aria-invalid`, `aria-describedby`).** Red borders alone fail color-blind users and screen readers. — [WCAG 1.4.1, APG] — [mechanical]
47. **Accept free-format input and normalize it; don't force the user to match your storage format.** Accept "  555 0100 ", "5550100", "(555) 0100" and trim/normalize spaces, dashes, case; be liberal in what you accept. — [GOV.UK, Baymard, Vercel WIG (trim values)] — [mechanical]
48. **Don't block typing to enforce format.** Rejecting keystrokes (e.g. refusing letters in a card field with no feedback) looks like a broken keyboard; validate after, or mask visibly (see K). — [Vercel WIG, Baymard] — [judgment]
49. **Positive/valid-state confirmation (green check) only where it genuinely helps.** Useful on hard fields (username availability, card number); noise on trivial ones. — [Baymard, NN/g] — [judgment]
50. **Never clear the whole form, or the erred field, on validation failure.** Deleting a mistyped 19-field form to "help" is catastrophic; preserve everything and mark only what failed. — [Baymard, NN/g] — [mechanical]
51. **Server-side errors surface with the same inline mechanics as client-side ones.** A 422 from the API must map back to per-field messages, not a generic "something went wrong" banner. — [Baymard, GOV.UK] — [judgment]

## F. Specific entry types — address, phone, date, payment, email, password

52. **Dates users know (birth dates): three separate labeled fields or one text field — never a calendar picker.** Nobody scrolls a calendar back 30 years; pickers are for choosing *nearby, unknown* dates (appointments, ranges). — [GOV.UK, Baymard, NN/g] — [judgment]
53. **Calendar pickers always allow typed entry as an alternative and support keyboard operation.** The APG date-grid keyboard contract (arrows move days, PageUp/Down months) applies; typing must never be locked out. — [APG, GOV.UK, Baymard] — [mechanical]
54. **Phone fields: one single field, national or international freely, no masks that fight pasting.** Auto-format visually if you like, but accept any spacing/punctuation; country-code selectors default from locale. — [Baymard, GOV.UK] — [judgment]
55. **Address entry: offer autocomplete/lookup (postcode or type-ahead) with a manual-entry fallback always available.** Address finders speed entry and cut errors, but some addresses aren't in any database — the manual path is mandatory. — [GOV.UK, Baymard] — [mechanical]
56. **Card number: single field, auto-spaced in groups of 4, auto-detected card brand, `inputmode=numeric`.** Never ask the user to pick their card type from radio buttons — detect it from the number. — [Baymard] — [mechanical]
57. **Expiry as MM/YY matching the physical card; CVV with a "what is this" affordance.** Mirror the card's own format; a small help popover for CVV location measurably reduces abandonment. — [Baymard] — [mechanical]
58. **Email fields: no confirm-email double entry; validate format leniently and check typos ("gmial.com" → suggest gmail.com).** Confirm fields get pasted anyway; typo suggestion catches more real errors. — [Baymard, NN/g] — [judgment]
59. **Password creation: show requirements up front, live-check them as the user types, and provide show/hide toggle.** A show-password toggle is now baseline on every major platform; masking with no reveal increases errors and password-reset load. — [NN/g, Baymard, NIST 800-63, GOV.UK] — [mechanical]
60. **Password entry (login): one field, show/hide toggle, paste allowed, `autocomplete="current-password"`.** Everything must cooperate with password managers, including the DOM structure (real form, real submit). — [NIST, Vercel WIG, Baymard] — [mechanical]
61. **Numeric quantity fields preselect their content on focus.** Focusing "1" in a quantity/weight/reps box should select it so typing replaces rather than appends ("18" bugs). — [Baymard, common platform behavior] — [mechanical]

## G. Multi-step forms and wizards

62. **Break long forms into steps of related questions; one thing per page on mobile-heavy flows.** GOV.UK's "one thing per page" beats mega-forms for completion and error rates on complex tasks. — [GOV.UK, Baymard] — [judgment]
63. **Show where the user is: step indicator with current position and total (or clearly-labeled sections).** Users tolerate length they can see; unbounded wizards feel endless. — [NN/g, Baymard] — [mechanical]
64. **Back always works and never loses data, in both the app's Back button and the browser's.** Every step is revisitable with previous answers intact; browser Back must not blow up the flow. — [GOV.UK, Baymard, Vercel WIG (URL state)] — [mechanical]
65. **A review/summary step before final commit on consequential flows, with per-item "Change" links that return the user to that answer and then back to review.** The GOV.UK "check answers" pattern; also the standard checkout review page. — [GOV.UK, Baymard] — [judgment]
66. **Save progress on long flows (auto-save or explicit "save and continue later").** Anything above ~5 minutes of entry, or anything users do on the phone in fragments, needs resumability. — [GOV.UK, NN/g] — [judgment]
67. **Don't gate later steps on optional earlier ones; branch instead of showing irrelevant questions.** Conditional reveal (ask follow-ups only when applicable) beats showing everyone every field. — [GOV.UK] — [judgment]

## H. Selection controls — choosing the right one

68. **Radio buttons for 2–5ish mutually exclusive visible options; show them all, don't hide them in a dropdown.** If the options fit on screen, exposing them beats a dropdown every time (fewer taps, full visibility). — [NN/g, GOV.UK, Baymard] — [judgment]
69. **Checkboxes for zero-or-more selections and for standalone binary opt-ins that take effect on save.** A checkbox states a fact the user asserts ("Email me receipts"); it doesn't perform an instant action. — [NN/g, Material 3, Apple HIG] — [judgment]
70. **Switches/toggles only for instant-effect binary state — flipping it applies immediately, no Save button.** A toggle that requires pressing Save is a checkbox wearing the wrong costume; this is the core toggle/checkbox distinction all platforms agree on. — [Material 3, Apple HIG, NN/g] — [judgment]
71. **A toggle's two states must be visually unmistakable and its label must describe the thing controlled, not the state.** Label "Notifications" + on/off position — never "Turn off notifications" (ambiguous: state or action?). — [NN/g, Apple HIG] — [judgment]
72. **Radios need a default or an explicit "none" option, and once selected can't be collectively deselected — design accordingly.** If "no choice" is valid, make it an option; don't rely on the un-uncheckable nature of radios. — [NN/g, GOV.UK] — [judgment]
73. **Dropdowns (selects) are a last resort: use for >5–7 options that need no comparison; never for 2–4 options or for data better typed.** Dropdowns hide options, cost extra taps, and are painful on mobile ("avoid dropdowns" is explicit Baymard/GOV.UK/NN/g consensus); prefer radios, steppers, segmented controls, or free text with validation. — [Baymard, GOV.UK, NN/g, Luke Wroblewski] — [judgment]
74. **Long lists (countries, exercises, foods) get a searchable combobox, not a plain 200-item select.** Type-ahead filtering is mandatory above roughly a dozen items. — [Baymard, GOV.UK accessible autocomplete, APG] — [judgment]
75. **Segmented controls for 2–5 short, always-visible, mutually exclusive view/filter options.** The exposed alternative to a dropdown for switching views (e.g. kg/lb, week/month). — [Apple HIG, Material 3] — [judgment]
76. **Sliders only for approximate, feel-based values (volume, brightness, effort); pair any precise slider with a numeric display and direct entry.** Sliders are notoriously imprecise on touch; for exact numbers, a field beats a slider. — [NN/g, Apple HIG, Baymard] — [judgment]
77. **Steppers (+/−) for small-range adjustments where values change by a step or two.** Quantity, sets, rest-timer minutes; combine with tap-to-type per #38. — [Apple HIG, Baymard] — [judgment]
78. **Native mobile pickers (wheels/sheets) beat custom desktop-style dropdowns on touch.** Use the platform's `<select>`/date UI on mobile unless you have a strong reason; custom scroll-in-scroll dropdowns on phones are error farms. — [Baymard, Apple HIG] — [judgment]
79. **Preselect sensible defaults wherever a safe default exists; never preselect consequential or consent choices.** Default the country from locale, the date to today; never pre-tick marketing consent or paid add-ons. — [NN/g, GOV.UK, GDPR practice] — [judgment]

## I. Commit models — instant apply vs explicit save

80. **Pick one commit model per surface and make it legible: either everything applies instantly, or nothing does until Save.** Mixing instant-apply toggles with save-required fields on one screen makes users unsure what has taken effect. — [NN/g, Material 3, Apple HIG] — [judgment]
81. **Settings and preferences: instant apply with feedback is the modern default; document-like content: explicit save or continuous autosave with visible status.** "Saved just now / Saving…" indicators are the contract for autosave surfaces. — [NN/g, Google/Apple platform convention] — [judgment]
82. **Explicit-save surfaces track dirtiness: Save disabled-or-neutral when clean, prominent when dirty, with discard protection.** The user must always be able to answer "have I saved?" at a glance. — [NN/g, Vercel WIG (unsaved changes)] — [mechanical]
83. **Instant-apply destructive or hard-to-reverse changes get an undo, not a confirm.** See section N; instant-apply only works when reversal is one tap. — [NN/g] — [judgment]
84. **Cancel/Discard must genuinely revert; a Cancel that keeps half the changes is a lie.** Modal edits either commit atomically on Save or revert atomically on Cancel/Esc. — [Apple HIG, NN/g] — [mechanical]

## J. Keyboard and focus — fundamentals

85. **Everything operable by pointer is operable by keyboard, with no traps.** Full task completion via keyboard alone is WCAG level A; a keyboard trap (can't Tab out) is an automatic failure. — [WCAG 2.1.1/2.1.2, APG] — [mechanical]
86. **Focus is always visible (`:focus-visible` ring) and never suppressed without an equal replacement.** `outline: none` with nothing else is banned; WCAG 2.2 also requires the focused element not be fully obscured by sticky bars/overlays. — [WCAG 2.4.7/2.4.11, Vercel WIG] — [mechanical]
87. **Tab order follows visual/reading order.** DOM order, not `tabindex` hacks; positive `tabindex` values are effectively banned. — [WCAG 2.4.3, APG] — [mechanical]
88. **Tab moves between widgets; arrow keys move within composite widgets (roving tabindex).** A radio group, tab list, menu, listbox, toolbar, or grid is ONE tab stop; arrows navigate inside it. This is the single most-violated APG rule in hand-rolled UI. — [APG fundamental keyboard pattern] — [mechanical]
89. **Focus is managed on every open/close/delete: opening a dialog moves focus in; closing returns it to the trigger; deleting an item moves focus to a sensible neighbor.** Focus falling to `<body>` strands keyboard and screen-reader users. — [APG, Vercel WIG] — [mechanical]
90. **Esc closes the topmost transient surface (dialog, menu, popover, tooltip) — one layer at a time.** And only the topmost; Esc in a nested menu closes the submenu, not everything. — [APG, Apple HIG] — [mechanical]
91. **Standard editing keys work everywhere text is edited: Home/End, word-jump, select-all, undo (Ctrl/Cmd+Z).** Custom inputs (tag editors, rich text) must not swallow platform text-editing shortcuts. — [Apple HIG, platform convention] — [mechanical]
92. **Never hijack browser/OS-level shortcuts (Ctrl/Cmd+L, T, W, R, F on find-able content).** Overriding find-in-page or tab shortcuts is hostile unless the surface is a genuine app-in-app editor with user expectation. — [Vercel WIG, NN/g] — [judgment]

## K. Per-widget keyboard/focus contracts (ARIA APG catalog)

Each widget below has an exact, standardized contract; deviating from it breaks assistive tech and muscle memory. All items in this section: [APG] — [mechanical] unless noted.

93. **Dialog (modal):** focus moves to an element inside on open (first sensible field, or the least-destructive button for confirmations); Tab cycles *inside only* (focus trap); Esc closes; on close, focus returns to the invoking element; background is inert (`aria-modal`/`inert`).
94. **Alert dialog (confirmations):** same as dialog, but initial focus goes to the least-destructive action; role `alertdialog` so the message is announced.
95. **Menu / menu button:** Enter/Space/ArrowDown on the trigger opens and focuses the first item (ArrowUp opens focusing the last); arrows move through items with wrap; Home/End jump; type-ahead jumps to items by first letter; Enter activates and closes; Esc closes and returns focus to the button; Tab closes the menu (focus leaves the widget). Menus are for actions — not for navigation links or form selection (that's a listbox/combobox).
96. **Tabs:** one tab stop for the tab list; Left/Right (or Up/Down when vertical) move between tabs; either activation-on-focus (automatic) or Enter/Space to activate (manual) — pick per cost of switching; Tab from the active tab goes into the panel, not to the next tab.
97. **Listbox:** arrows move selection/focus among options; Home/End jump; type-ahead by option name; Space toggles in multi-select; selection model (follows-focus vs explicit) must be consistent and announced.
98. **Combobox (select-only or autocomplete):** ArrowDown opens/moves into the list; Esc closes without changing the value, second Esc clears (autocomplete style); Enter commits the highlighted option; typing filters (autocomplete) or jumps (select-only); the input keeps DOM focus while `aria-activedescendant` tracks the highlighted option; Alt+ArrowDown/Up open/close without moving highlight.
99. **Slider:** arrows adjust by one step; PageUp/PageDown by a larger step; Home/End to min/max; the current value is always visible or announced (`aria-valuetext` for human units like "8 reps").
100. **Spinbutton (numeric stepper):** Up/Down arrows step; PageUp/Down big-step; Home/End to limits; typing a number directly always allowed.
101. **Switch:** Space (and usually Enter) toggles; announced as on/off, not checked/unchecked.
102. **Checkbox:** Space toggles; tri-state (mixed) cycles per contract; label click toggles too (#28).
103. **Radio group:** one tab stop; arrows move AND select (or move-without-select in rare manual variants); Space selects the focused one; arrows wrap.
104. **Disclosure ("show more", FAQ item):** Enter/Space toggles; `aria-expanded` reflects state; the trigger is a button, not a heading with a click handler.
105. **Accordion:** each header is a button in the Tab order; Enter/Space toggles its panel; (optionally arrows/Home/End move between headers).
106. **Tree view:** arrows navigate; Right expands / moves into children, Left collapses / moves to parent; type-ahead; Enter activates; one tab stop for the whole tree.
107. **Grid / data table interaction:** one tab stop; arrows move cell-to-cell; Home/End row boundaries, Ctrl+Home/End grid boundaries; PageUp/Down scroll rows; Enter enters an editable cell, Esc leaves it; sortable headers are buttons announcing sort state (`aria-sort`).
108. **Toolbar:** one tab stop; arrows move between the tools; delimits a group of buttons so Tab doesn't have to visit each.
109. **Tooltip:** appears on hover AND focus after a short delay; dismissible with Esc; never contains interactive content (that's a popover); content also hoverable (WCAG 1.4.13); first tooltip delayed, subsequent adjacent ones instant. — [APG, WCAG 1.4.13, Vercel WIG]
110. **Carousel:** rotation stops on hover/focus; visible prev/next buttons in Tab order; slide-pickers behave as tabs; auto-rotate has a pause control. — [APG, WCAG 2.2.2]
111. **Window splitter / resizable panes:** arrows resize; Enter toggles collapsed; keyboard users can reach every pane width a mouse user can.

## L. Touch mechanics — targets, spacing, gestures

112. **Touch targets at least 44×44pt (Apple) / 48×48dp (Material); web floor 24×24 CSS px (WCAG 2.2) with ≥44px strongly preferred on mobile.** If the visible glyph is smaller, expand the hit area invisibly (padding/pseudo-element); adjacent targets need spacing so fat fingers can't mis-hit. — [Apple HIG, Material 3, WCAG 2.5.8, Vercel WIG] — [mechanical]
113. **Label + control share one continuous hit target — no dead zone between a checkbox and its text.** The entire row of a settings toggle should flip it. — [Vercel WIG, Material 3] — [mechanical]
114. **Primary actions sit in the thumb zone on phones; destructive ones out of it.** Bottom-of-screen reachability governs placement of frequent actions; top corners are for rare/dangerous ones. — [Apple HIG, NN/g, Steven Hoober research] — [judgment]
115. **Every gesture has a visible alternative.** Swipe-to-delete needs an Edit/… menu path; pinch-zoom needs buttons; pull-to-refresh needs auto/manual refresh; gestures are accelerators, never the only route (WCAG 2.5.1 makes this normative). — [WCAG 2.5.1, Apple HIG, NN/g] — [mechanical]
116. **Use only platform-standard gestures; custom gestures need onboarding and are almost never worth it.** Users discover swipe/long-press by transfer from the OS and top apps; invented gestures are invisible. — [Apple HIG, NN/g, Material 3] — [judgment]
117. **Actions trigger on touch-release (up), not touch-down, so a drag-away cancels.** The universal escape hatch: press, slide off, release = no action. — [Apple HIG, platform convention] — [mechanical]
118. **Don't stack a tap action and a swipe action so tightly that scrolling triggers taps.** Distinguish scroll intent from tap intent (slop thresholds); require deliberate horizontal movement before revealing swipe actions. — [Apple HIG, Material 3] — [judgment]
119. **Respect the system back gesture / edges; don't put your own swipe targets in the OS gesture zones.** Edge-swipe conflicts with Android back and iOS back-swipe are top-tier mobile defects. — [Material 3, Apple HIG] — [mechanical]
120. **Never disable zoom (`user-scalable=no`, `maximum-scale=1`).** Pinch-zoom is an accessibility right; use `touch-action: manipulation` to kill double-tap zoom delay instead. — [WCAG 1.4.4, Vercel WIG] — [mechanical]
121. **`overscroll-behavior: contain` on modals/drawers so inner scroll doesn't chain to the page.** Scroll-bleed behind sheets is a polish-tier but universally-cited defect. — [Vercel WIG] — [mechanical]
122. **Keyboard-avoidance: the focused field must never sit under the on-screen keyboard.** Scroll the field into view above the keyboard; keep the submit button reachable while the keyboard is up. — [Apple HIG, Material 3, Baymard] — [mechanical]

## M. Drag and drop, swipe actions, long-press

123. **Drag and drop is always an enhancement over an explicit alternative (move-to menu, reorder arrows, cut/paste).** WCAG 2.5.7 requires a single-pointer non-drag alternative; keyboard users need one too (e.g. select + arrow keys or a Move dialog). — [WCAG 2.5.7, APG, GOV.UK] — [mechanical]
124. **Draggables signal draggability (handle affordance, cursor: grab) and drop targets highlight while dragging.** Invisible drag features go unused; during drag show a drag preview and highlight valid targets, dim invalid ones. — [NN/g, Material 3, Apple HIG] — [judgment]
125. **During drag: disable text selection, set dragged elements inert, auto-scroll near container edges, and animate the drop.** The mechanical hygiene that separates working drag from janky drag. — [Vercel WIG, platform convention] — [mechanical]
126. **Drag operations are cancelable: Esc, or drop outside a valid target, reverts.** Never commit a move because the user's finger slipped. — [Apple HIG, APG] — [mechanical]
127. **Swipe actions on list items follow the platform idiom: full-swipe = default action, partial swipe reveals labeled buttons; destructive full-swipe still gets undo or confirm.** Mail-style; icons in revealed buttons get text labels or must be instantly recognizable. — [Apple HIG, Material 3] — [judgment]
128. **Long-press reveals secondary actions/context menus — never the only path to a primary action.** Long-press is invisible; anything under it must also exist in a visible menu. — [Apple HIG, Material 3, NN/g] — [judgment]
129. **Reordering lists: provide drag handles (don't make the whole row the drag surface if rows also tap), plus a keyboard/menu alternative.** Whole-row drag fights scrolling on touch. — [Material 3, APG, GOV.UK] — [judgment]

## N. Destructive actions — confirmation vs undo

130. **Prefer undo over confirmation for frequent, individually reversible actions.** Confirm dialogs get blind-clicked ("dialog blindness"); undo (toast with Undo, ~5–10s, plus trash/archive recovery) protects without interrupting. — [NN/g, Apple HIG, Material 3, Vercel WIG] — [judgment]
131. **Reserve confirmation for rare, irreversible, high-stakes actions — and make the dialog state the specific consequence.** "Delete 'Push Day A' and its 14 logged sessions? This cannot be undone." Generic "Are you sure?" is worthless. — [NN/g, Apple HIG, GOV.UK] — [judgment]
132. **Confirmation buttons repeat the verb, never Yes/No/OK.** "Delete workout" / "Cancel" — the destructive one styled as destructive (red), and it is NOT the default-focused button. — [Apple HIG, NN/g, APG alertdialog] — [mechanical]
133. **For catastrophic scope (delete account, delete all data), add friction proportional to the loss: type-to-confirm, hold-to-confirm, or re-auth.** High-friction confirms are reserved for the top tier only; using them everywhere trains users to speed through. — [GitHub/industry convention, NN/g] — [judgment]
134. **Separate destructive controls spatially from routine ones.** Delete never sits adjacent to Save/Submit at the same visual weight; in menus it goes last, often after a divider, in the destructive color. — [Apple HIG, Material 3, NN/g] — [mechanical]
135. **Soft-delete by default where domain allows: archive/trash with a restore window beats hard delete.** "Deleted items" recovery converts most destructive mistakes into non-events. — [NN/g, industry convention] — [judgment]
136. **Never use a destructive verb for a safe action or vice versa ("Cancel order" vs dialog "Cancel" collision).** When "Cancel" is itself the destructive act, relabel the buttons ("Cancel order" / "Keep order"). — [NN/g, GOV.UK] — [judgment]

## O. Text input specifics — masking, counters, growing fields

137. **Input masking auto-formats as the user types (card spacing, phone grouping) but never blocks, reorders, or fights pasted input.** Masks are display sugar; store the raw value; cursor position must survive the mask. — [Baymard, NN/g] — [mechanical]
138. **Character counters appear when a limit exists, show remaining count near the limit, and never hard-stop typing without showing why.** Announce the limit to screen readers (`aria-describedby`, live region near the boundary); let users paste over-limit text and edit it down. — [GOV.UK character-count pattern, Material 3] — [mechanical]
139. **Textareas auto-grow with content up to a max, then scroll; never a fixed 2-line box for a paragraph-length answer.** Field size telegraphs expected length (see #20). — [GOV.UK, Material 3] — [mechanical]
140. **Show all constraints before violation, not after.** Max length, allowed characters, and format rules appear as hints (#31); discovering the rule by tripping on it is a design failure. — [WCAG 3.3.2, GOV.UK, Baymard] — [judgment]
141. **Voice dictation and IME composition must work: don't intercept keystrokes in ways that break composed input (CJK, autocomplete, dictation).** Keydown-based character filtering typically destroys IME input. — [platform convention, WCAG] — [mechanical]

## P. Shortcuts

142. **Provide keyboard shortcuts for the frequent actions of power users; follow platform conventions for the standard set.** Copy/paste/undo/find/save use their universal bindings; app-specific ones follow category leaders (J/K lists, Cmd+Enter send, `/` or Cmd+K for search/command). — [NN/g, Apple HIG, Vercel WIG] — [judgment]
143. **Shortcuts are discoverable: shown in menus/tooltips next to their actions, and a "?"-style cheat sheet or command palette lists them.** Undiscoverable shortcuts serve nobody; the command palette (Cmd+K) is the 2020s-standard discoverability layer for web apps. — [NN/g, industry convention] — [judgment]
144. **Single-letter shortcuts never fire while focus is in a text field, and all custom shortcuts are remappable-or-disableable where feasible.** WCAG 2.1.4 requires single-key shortcuts be off, remappable, or focus-scoped (speech-input users trigger them by accident). — [WCAG 2.1.4] — [mechanical]
145. **Shortcuts modify, they never replace: every shortcut action exists as a visible control too.** Keyboard-only features are invisible features. — [NN/g, Apple HIG] — [mechanical]

## Q. Multi-select and bulk actions

146. **Entering multi-select mode is explicit and obvious: checkboxes appear (or a Select button / long-press on mobile) and the UI shifts to a selection state.** A contextual action bar replaces or overlays the normal chrome, showing "N selected" and the bulk actions. — [Material 3, Apple HIG, NN/g] — [mechanical]
147. **Provide select-all (current page/scope), clear-all, and show the selection count at all times.** With large datasets, make the scope explicit ("All 24 on this page" vs "all 3,120 matching") — the Gmail pattern. — [NN/g, industry convention] — [judgment]
148. **Desktop list selection honors platform conventions: click selects, Shift+click ranges, Ctrl/Cmd+click toggles; checkbox-per-row is the touch-safe alternative.** Pick per input modality; checkbox rows work everywhere. — [Apple HIG, NN/g, APG listbox/grid] — [mechanical]
149. **Bulk actions apply only to the selection, confirm scope in the verb ("Delete 12 items"), and report partial failures item-by-item.** Never silently skip failed rows in a bulk operation. — [NN/g, industry convention] — [judgment]
150. **Selection survives sorting/filtering visibly or is explicitly cleared with notice — never silently half-kept.** Acting on a stale invisible selection is a data-loss trap. — [NN/g] — [judgment]

## R. Search-as-you-type and autocomplete mechanics

151. **Debounce input (~150–300ms) and never block typing on in-flight requests; results update without stealing focus.** The input stays responsive; late responses must not overwrite newer queries (race-condition guard). — [NN/g, Baymard, Vercel WIG] — [mechanical]
152. **Highlight the matched substring in suggestions and keep suggestions short (5–10), scannable, and keyboard-navigable per the combobox contract (#98).** ArrowDown into the list, Enter commits, Esc restores the typed text. — [Baymard, APG, NN/g] — [mechanical]
153. **Show recent searches / sensible suggestions on focus before the first keystroke; support query correction ("did you mean") and tolerate typos in matching.** Empty-input focus is a suggestion opportunity; exact-match-only search fails real spellers. — [Baymard, NN/g] — [judgment]
154. **Pressing Enter always runs the full search with the literal typed text — suggestions accelerate, never trap.** The user must be able to ignore the dropdown entirely. — [Baymard, GOV.UK] — [mechanical]
155. **Announce result counts to assistive tech (`aria-live`) and show a useful no-results state with recovery (clear query, spelling hint, browse links).** A silent empty dropdown is indistinguishable from a broken one. — [GOV.UK, APG, NN/g] — [mechanical]
156. **Filtering/search state is URL-reflected where the surface is shareable (deep-linkable filters).** Back/forward and share must reproduce what the user sees. — [Vercel WIG] — [mechanical]

## S. Time and duration entry

157. **Duration entry uses a dedicated mm:ss (or h:mm:ss) pattern, never a free-text field that guesses.** Segmented labeled boxes (min/sec), a duration wheel, or a masked single field that shows units as typed — and the entered value is echoed back in unambiguous units ("1:30 — 1 min 30 sec") so "90" can never silently mean the wrong thing. — [Material 3 time pickers, Apple HIG pickers, GOV.UK question patterns] — [mechanical]
158. **Time-of-day entry offers both a picker and direct keyboard entry, honoring the user's 12/24-hour locale setting.** M3's time picker ships dial and input modes for exactly this reason: a dial-only picker fails keyboard and precision entry, a text-only field fails casual mobile entry. AM/PM is an exposed two-option toggle, never a dropdown. — [Material 3 time picker, Apple HIG, APG] — [mechanical]
159. **Common durations get one-tap presets; arbitrary durations stay typeable.** Rest and interval timers offer chips or steppers at the values users actually pick (0:30, 1:00, 1:30, 2:00, 3:00) with ±15/±30s adjustment — and tapping the value always allows typing an exact one (#38). — [Apple HIG steppers, fitness-logger convergence (Apple Fitness, Strong/Hevy-class), Baymard mobile input] — [judgment]
160. **Duration and time fields summon numeric keyboards and never block paste.** `inputmode=numeric` on segments, no keystroke rejection (#48), and a pasted "1:30" is accepted and normalized (#47). — [Vercel WIG, GOV.UK, Baymard] — [mechanical]
161. **Ask at the precision the task needs; never force seconds where minutes carry the meaning.** A workout's length is minutes, a rest timer is seconds, a plan is days; over-precise entry slows the user and implies false accuracy. — [GOV.UK question protocols, NN/g] — [judgment]
162. **One duration format per quantity, app-wide, with the unit legible.** "1:30" here and "90 sec" there for the same quantity reads as two different things; bare colon formats state their meaning where ambiguous (mm:ss vs h:mm). Rendered durations use tabular numerals (canon 04 §1.11). — [NN/g consistency, canon 04] — [mechanical]
163. **Relative time entry ("in 10 minutes", "2 hours before") shows the resolved absolute result before commit.** Reminders and offsets confirm "That's 6:50 PM today" so AM/PM and off-by-one-day errors die at entry, not at the missed reminder. — [Google Calendar/platform reminder convention, NN/g error prevention] — [mechanical]

## T. Recurrence entry

164. **Recurrence input follows the calendar-app convention: simple presets first (daily, weekly on chosen days, monthly), with a custom builder behind them.** Users know Google Calendar's model; a novel recurrence grammar is a tax on every schedule. The built rule is echoed back as a plain-English sentence ("Weekly on Mon, Wed, Fri") before saving. — [Google Calendar/Outlook/Apple Calendar convergence, NN/g, Jakob's law] — [mechanical]
165. **Day-of-week selection is a row of always-visible toggle chips, not a multi-select dropdown.** All seven options exposed, multi-selectable, ordered by the locale's week start (see §U.171). — [Google Calendar convention, Material chips, #68] — [mechanical]
166. **Every recurrence has a visible end condition: never, until a date, or after N occurrences.** Silent forever-repeats and silent expiry both surprise; "never" is a fine default, but the choice exists at creation and edit. — [Google/Outlook convergence] — [mechanical]
167. **Editing or deleting a recurring item always asks scope: this one, this and following, or all.** The three-option prompt is the universal convention; applying an edit to an unstated scope corrupts the user's schedule and their trust in it. Skip the prompt only when one scope is possible. — [Google/Outlook/Apple Calendar convergence] — [mechanical]

## U. International names, addresses, and units

168. **Never force names into a first/last structure; prefer a single full-name field.** Many of the world's names have one part, several parts, or family-name-first order. Where split fields are unavoidable, only one part is required, and no length or character assumptions (hyphens, apostrophes, spaces, non-Latin scripts are all valid names). — [W3C i18n personal-names guidance, GOV.UK names pattern] — [mechanical]
169. **Address forms adapt to the selected country, chosen first.** Field set, labels (ZIP vs postcode), and required-ness follow that country's postal format; postal code is optional where countries don't use one; never validate the world against US-shaped assumptions. — [Baymard address research, GOV.UK, Google address-metadata practice] — [mechanical]
170. **Unit preference (kg/lb, km/mi) is a first-class setting applied everywhere, defaulted from locale.** Entry and display honor it on every surface, including history recorded under the other unit (convert on display, store canonically); a mixed-unit surface is a defect. — [Apple Health/Strava-class convention, i18n consensus] — [mechanical]
171. **Locale governs calendars and week structure, with an explicit override.** First day of week, date order, and number formatting come from the locale (Intl APIs, canon 04 §11.143), never hardcoded — a weekly-goal product that hardcodes Monday weeks misstates the week for part of the world; let users override week start where weeks carry meaning. — [Intl/CLDR consensus, canon 04 §11] — [mechanical]

## V. Editing surfaces — undo stacks, history, and canvas

172. **Editor-class surfaces get a real multilevel undo/redo stack with the platform bindings.** Ctrl/Cmd+Z undo, Ctrl/Cmd+Shift+Z (plus Ctrl+Y on Windows) redo, reliable through at least dozens of steps. Toast-undo (#130) covers destructive one-offs; it is not an editing undo model. — [Apple HIG undo and redo, About Face/Tidwell multilevel-undo canon, platform convention] — [mechanical]
173. **Undo units match user intent, not keystrokes or transactions.** One undo reverses one perceived action (a typed run, a move, a formatting apply); internally-grouped operations reverse together. — [About Face, Apple HIG] — [judgment]
174. **What is and isn't undoable is consistent and predictable — and selection/view changes don't consume undo steps.** Content changes are undoable; scrolling, zooming, and selecting are not (though undo may restore them as context). Any save/publish point that truncates the stack says so. — [About Face, platform convention] — [judgment]
175. **Undo/redo are visible controls on editing toolbars, not keyboard-only, and their disabled states reflect stack reality.** Touch users have no Cmd+Z; a greyed undo button honestly reports "nothing to undo" (#145). — [Material/HIG toolbars, #145] — [mechanical]
176. **Documents get version history with restore, not just undo.** Undo dies with the session; automatic (and optionally named) versions cover slower regret and multi-session work, and restoring creates a new version rather than destroying the interim. — [Google Docs/Figma convergence, NN/g] — [judgment]
177. **Canvas surfaces follow the universal spatial contract: drag/scroll pans, pinch and Ctrl/Cmd+scroll zoom toward the pointer, visible zoom controls with fit and 100%, and the zoom level shown.** Deviating from the contract users carry from Figma/Miro/Maps breaks transferred muscle memory. — [Figma/Miro/Maps convergence, Tidwell canvas-plus-palette] — [mechanical]
178. **On-canvas selection follows desktop conventions: click selects, Shift/Cmd+click adds, drag on empty space rubber-bands, Esc deselects, arrows nudge — with visible selection handles and a properties surface reflecting the selection.** — [design-tool convergence, APG] — [mechanical]

## W. Repeat and duplicate accelerators

179. **Frequent repeated entries get a one-tap "repeat last" / "copy previous" accelerator.** The #1 entry accelerator in logging apps: repeat last workout, copy last week's plan — prefilled and then editable, never blind-committed. — [Tidwell streamlined repetition, logging-app convergence, #21] — [mechanical]
180. **Duplicate is a first-class action on any user-built structured object.** Templates, workouts, routines: "Duplicate" in the item's menu, producing an editable copy with a derived name and focus in the name field. — [platform convention (Files/Figma/Notion-class), Tidwell] — [mechanical]
181. **Once the user has history, creation flows lead with recents and templates ahead of blank-slate entry.** Blank-first is right only for first use; after that, "start from recent/template" is the honest default order. — [NN/g recognition over recall, logging-app convergence] — [judgment]
182. **Prefill from the previous instance, but make carried-over values read as suggestions, not fresh entries.** Ghosted last-time values (previous weight/reps shown faint until confirmed or edited) prevent stale data from being silently logged as new truth. — [fitness-logger convergence (ghost previous-set values), NN/g] — [judgment]

---

## Cross-references (owned by other domains — noted, not duplicated)

- Loading/progress feedback timing, skeletons, spinners, optimistic UI reconciliation → feedback & system-status domain (only the button-level contract, #7–8, lives here).
- Toasts/snackbars placement, `aria-live` politeness levels → feedback domain (undo-toast mechanics referenced in #130).
- Color contrast, type sizes, motion-reduction, dark mode → visual/accessibility foundations domain (color-independence of states, #13/#46, referenced here only as it applies to control states).
- Navigation structure, back-stack behavior, deep linking → navigation/IA domain (#64, #156 touch it only as form/search state).
- Empty states, onboarding, permission priming → content & first-run domain.
- Copy tone and microcopy style beyond labels/errors → content/voice domain.
- Screen-reader semantics beyond widget keyboard contracts (landmarks, headings, alt text) → accessibility domain.
- Performance budgets (input latency targets beyond #14) → performance domain.
- Offline behavior and sync conflicts on form submission → resilience/offline domain.

## Contested / no-consensus (positions noted, not counted above)

- **Floating labels (Material filled/outlined text fields).** Material 3 ships them; Baymard and NN/g note reduced label legibility, placeholder confusion, and cramped hint space; GOV.UK explicitly rejects them for static top labels. Consensus exists only that placeholder-as-only-label is wrong (#27).
- **Inline validation on first entry (before first blur).** Live positive validation while typing is endorsed for hard fields (usernames, passwords) by some sources; Baymard warns premature errors hurt more than they help. #41–42 capture the agreed core; anything more aggressive is a per-field judgment.
- **Automatic vs manual tab activation (#96).** APG documents both as valid; sources disagree on the default when panel loading is cheap. Consensus is only "pick one per cost and be consistent."
- **Automatic focus-advance between OTP/date segment fields.** Common in practice; criticized (GOV.UK, accessibility community) because it breaks editing and surprises screen-reader users. Single-field with paste support (#35) sidesteps it.
- **Confirmation email double-entry.** Largely dead (see #58), but a minority of payment/identity contexts still defend it; no cross-source rule beyond "prefer typo-detection."
- **Select-on-focus for text (non-numeric) fields.** Universal for numeric quantity fields (#61); contested for text fields where users may intend to append.
- **Enter-to-submit inside multi-field composite widgets (tag inputs, chip fields).** Platform convention conflicts (Enter adds a chip vs submits the form); sources agree only that the behavior must be visible and consistent.
- **Hover-revealed actions on desktop rows.** Saves visual noise (Gmail, Linear) but hides functionality and has no touch equivalent unless mirrored in a menu; sources split on default-visible vs hover-revealed.
