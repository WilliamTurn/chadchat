# UX Canon 05 — Accessibility and Inclusive Design

Domain: the app working for every user. Every operative WCAG 2.2 AA success criterion is translated here into a plain-English build rule, plus the consensus practice layer around the spec (screen readers, keyboard, low vision, motor, cognitive, motion, deaf/HoH, color blindness, situational impairment, aging, forms, authentication, and testing). Tagging: [mechanical] = pass/fail checkable; [judgment] = requires human evaluation. WCAG citations are to WCAG 2.2 (w3.org/TR/WCAG22); level shown where it maps to a criterion.

Legal context worth knowing (not a principle): the European Accessibility Act has applied to consumer-facing digital services in the EU since June 2025, and US ADA Title II web rules phase in from 2026; WCAG 2.2 AA is the de facto legal bar in both. Accessibility is now a compliance floor, not a nice-to-have.

## 1. Foundations: semantic HTML first

1. **Use the native HTML element that already means what you're building.** A `<button>` for actions, `<a href>` for navigation, `<input>` for entry, `<select>` for choice, `<table>` for tabular data, `<dialog>` for dialogs. Native elements ship with the name, role, keyboard behavior, and focus handling assistive tech expects; a styled `<div>` ships with none of it. [WAI, WebAIM, first rule of ARIA] — [mechanical]
2. **Use a link when it goes somewhere, a button when it does something.** Screen-reader users pull up separate lists of links and buttons and predict behavior from the role; a link that submits a form or a button that navigates breaks that prediction. [WAI APG, GOV.UK] — [mechanical]
3. **Never attach click handlers to non-interactive elements (`div`, `span`, `img`) without making them full controls.** If you must, add role, tabindex="0", keyboard handlers, and an accessible name — which is why you should have used a `<button>`. [WAI ARIA authoring rules] — [mechanical]
4. **The DOM order must match the visual and logical reading order.** Screen readers and sequential keyboard focus follow source order, not CSS position. Do not use CSS (`order`, `flex-direction: *-reverse`, absolute positioning) to visually reorder content away from its DOM order. [WCAG 1.3.2 Meaningful Sequence, A] — [mechanical]
5. **Convey structure with markup, not with looks alone.** Headings are `<h1>–<h6>`, lists are `<ul>/<ol>`, quotes are `<blockquote>`, emphasis is `<strong>/<em>` — not bolded paragraphs and bullet characters. Assistive tech exposes structure only when it is in the markup. [WCAG 1.3.1 Info and Relationships, A] — [mechanical]
6. **Data tables get real table markup with header cells.** `<th>` with `scope` (or `headers` for complex tables) and a `<caption>`. Never present tabular data as styled divs; never use tables for layout. [WCAG 1.3.1; WAI Tables tutorial] — [mechanical]
7. **Every page declares its language, and passages in another language are marked.** `<html lang="en">`; `lang` attribute on foreign-language phrases so screen readers switch pronunciation. [WCAG 3.1.1 A, 3.1.2 AA] — [mechanical]
8. **Content and functionality must survive with CSS and pointer input stripped away.** The document should read sensibly as plain HTML; this is the practical test that semantics, order, and text alternatives are real. [WebAIM; GOV.UK] — [judgment]

## 2. Names, roles, values, and ARIA discipline

9. **Every interactive control exposes an accessible name, a role, and its current state to assistive tech.** Name (what it's called), role (what it is), value/state (checked, expanded, selected, disabled) — and state changes are conveyed, not just repainted. [WCAG 4.1.2 Name, Role, Value, A] — [mechanical]
10. **No ARIA is better than bad ARIA.** Only reach for ARIA when no native element does the job; incorrect roles and states actively lie to screen-reader users, which is worse than silence. [W3C "first rule of ARIA"; WebAIM] — [judgment]
11. **If you build a custom widget, implement the complete ARIA pattern, not just the role.** A `role="tab"` without `aria-selected`, arrow-key behavior, and `tabpanel` wiring is a broken promise. Follow the ARIA Authoring Practices pattern exactly or use a proven library. (Keyboard contracts per widget: see cross-ref, agent 1.) [ARIA APG] — [mechanical]
12. **The accessible name must contain the visible label text.** Voice-control users say what they see ("click Submit"); if the programmatic name differs from the on-screen text, voice commands fail. Don't let `aria-label` diverge from the visible label. [WCAG 2.5.3 Label in Name, A] — [mechanical]
13. **Never use `aria-hidden="true"` on focusable or interactive content.** It creates ghost controls: focus lands on something the screen reader can't announce. Also never hide the currently focused element. [ARIA spec; axe rule] — [mechanical]
14. **Icon-only buttons always get a text name.** `aria-label` or visually hidden text ("Close", "Search", "Delete workout") — an unnamed icon button announces as "button" and is unusable. [WCAG 4.1.2; WebAIM] — [mechanical]
15. **Repeated controls get names that distinguish them.** Ten "Edit" buttons in a list must each expose which item they edit (e.g., "Edit Monday workout") via `aria-label` or hidden text, or screen-reader users hear ten identical buttons. [WAI; WebAIM link-text guidance] — [mechanical]
16. **Status information shown visually must also be programmatic.** Badges, color-coded states, "active" highlights, progress — expose them via text, `aria-current`, `aria-selected`, or state attributes, not styling alone. [WCAG 1.3.1, 4.1.2] — [mechanical]

## 3. Page structure: landmarks, headings, titles

17. **Every page has exactly one `<main>`, plus `<header>`, `<nav>`, `<footer>` landmarks.** Screen-reader users jump between landmarks the way sighted users' eyes jump between regions; a page without landmarks must be read linearly. Label duplicate landmarks (`<nav aria-label="Breadcrumb">`). [WAI Page Structure tutorial; WCAG 1.3.1] — [mechanical]
18. **Headings form a logical outline: one `<h1>` per page, no skipped levels, chosen by hierarchy, not font size.** Heading navigation is the #1 way screen-reader users explore a page (WebAIM surveys); a broken outline breaks their map of your page. [WCAG 1.3.1, 2.4.6; WebAIM SR survey] — [mechanical]
19. **Section headings and labels describe their topic or purpose.** "Your workout history", not "Section 2" or a vibe word; users navigating by headings decide whether to read a section by its heading alone. [WCAG 2.4.6 Headings and Labels, AA] — [judgment]
20. **Every page/screen has a unique, descriptive title, most-specific-first.** "Edit workout – Chad" not "Chad". It's the first thing announced on load and how users tell tabs apart. In SPAs, update `document.title` on route change. [WCAG 2.4.2 Page Titled, A] — [mechanical]
21. **Provide a "skip to main content" link as the first focusable element.** Keyboard users otherwise tab through the entire header and nav on every single page. It may be visually hidden until focused. [WCAG 2.4.1 Bypass Blocks, A] — [mechanical]
22. **Give users more than one way to find any page.** At least two of: navigation menu, search, site map, index, related links — unless the page is a step in a process. [WCAG 2.4.5 Multiple Ways, AA] — [mechanical]
23. **Link text makes sense out of context.** Screen-reader users skim a list of the page's links; "Read more" and "Click here" repeated are meaningless. The link's purpose must be clear from its text (plus, at minimum, its sentence). [WCAG 2.4.4 Link Purpose, A; GOV.UK] — [judgment]
24. **Iframes get descriptive `title` attributes.** An untitled iframe announces as "frame" with no clue what's inside. [WCAG 4.1.2; axe rule] — [mechanical]

## 4. Images and non-text content

25. **Every informative image has alt text that conveys its purpose, not its appearance.** Write what the image is FOR in context ("Bar chart: weight trending down 2 kg over 6 weeks"), not "chart" or "image of a graph". [WCAG 1.1.1 Non-text Content, A; WAI Images tutorial] — [judgment]
26. **Every decorative image is explicitly silenced.** `alt=""` (never a missing alt attribute) or CSS background — so screen readers skip it instead of reading the filename. [WCAG 1.1.1; WAI decision tree] — [mechanical]
27. **Functional images are named by their action, not their picture.** A magnifying-glass submit button's alt is "Search", not "magnifying glass". [WAI Images tutorial] — [mechanical]
28. **Never put real text inside images.** Text in images can't be resized, recolored, translated, or read by assistive tech reliably. Use actual text with CSS; logos are the only standard exception. [WCAG 1.4.5 Images of Text, AA] — [mechanical]
29. **Complex images (charts, diagrams, infographics) get a full text alternative nearby.** Short alt naming the image + a visible or linked long description / data table carrying the same information. (Chart-specific encoding rules: see cross-ref, data-viz.) [WCAG 1.1.1; WAI Complex Images tutorial] — [mechanical]
30. **Alt text does not start with "image of" / "picture of" and does not duplicate adjacent captions.** The role is already announced; duplication is read twice. [WebAIM alt-text guidance] — [mechanical]
31. **Icons that carry meaning get text; icons next to text get hidden.** A lone warning icon needs a name; an icon beside the word "Warning" is decorative. [WAI; WebAIM] — [mechanical]
32. **CAPTCHAs and visual puzzles get non-visual alternatives — or better, don't exist.** If you must gate, use methods that don't require perception in one sense (see §17 on authentication). [WCAG 1.1.1; 3.3.8] — [mechanical]

## 5. Dynamic updates and live regions

33. **Content that changes without a page load must announce itself.** Toasts, "saved" confirmations, async validation results, cart counts, timer updates: put them in a live region (`role="status"` / `aria-live="polite"`) or move focus to them — silently repainting the DOM tells a screen-reader user nothing. [WCAG 4.1.3 Status Messages, AA] — [mechanical]
34. **Use polite announcements for status, assertive only for urgent problems.** `aria-live="assertive"` / `role="alert"` interrupts whatever the user was hearing; reserve it for errors and time-critical warnings. [ARIA spec; WAI] — [judgment]
35. **Live regions must exist in the DOM before you populate them.** Injecting a node that already contains `aria-live` content is unreliably announced; render the empty container first, then set its text. [ARIA APG; WebAIM] — [mechanical]
36. **Loading states are announced, and completion is announced.** "Loading results…" then "12 results loaded" — a spinner that only spins visually leaves non-visual users in dead air wondering whether anything happened. [WCAG 4.1.3; GOV.UK] — [mechanical]
37. **Don't announce noise.** Live-region updates firing on every keystroke, progress tick, or list mutation drown users; throttle and summarize ("5 new messages", not five announcements). [ARIA APG; judgment consensus] — [judgment]
38. **Infinite scroll and client-side route changes need explicit focus/announcement handling.** On SPA navigation, move focus to the new page's heading or announce the new page title; otherwise the screen reader believes nothing happened. [WAI; consensus SPA practice] — [mechanical]

## 6. Keyboard-only use

39. **Every action a mouse can do, a keyboard alone can do.** All functionality operable via keyboard — no exception for hover menus, drag interfaces, sliders, custom dropdowns, canvas tools, or "swipe" patterns. [WCAG 2.1.1 Keyboard, A] — [mechanical]
40. **No keyboard traps: focus can always leave any component using standard keys.** Modals, embeds, and widgets must release focus with Tab/Escape; a user stuck in a widget has lost the whole app. [WCAG 2.1.2 No Keyboard Trap, A] — [mechanical]
41. **Tab order follows the visual and logical order of the page.** Focus must not jump around the screen. Achieve this with DOM order; never use positive `tabindex` values. [WCAG 2.4.3 Focus Order, A; WebAIM] — [mechanical]
42. **Only interactive elements are tabbable; everything interactive is tabbable.** Don't put `tabindex="0"` on static text (noise); don't leave custom controls out of the tab order (invisible). [WAI APG; axe rules] — [mechanical]
43. **Follow the standard key contract: Tab moves between widgets, arrows move within them, Enter/Space activates, Escape dismisses.** Users carry these expectations from every mainstream app; composite widgets (menus, tabs, radios, grids) use roving focus with arrow keys. (Full per-widget contracts: cross-ref agent 1 / ARIA APG.) [ARIA APG] — [mechanical]
44. **Single-character keyboard shortcuts must be avoidable.** If you bind bare letter keys (like "j/k"), provide a way to turn them off or remap them — speech-input and tremor users trigger them accidentally with catastrophic results. [WCAG 2.1.4 Character Key Shortcuts, A] — [mechanical]
45. **Anything revealed on hover must also be reachable by keyboard focus — and dismissible.** Tooltips and hover cards: appear on focus, dismiss with Escape, stay open while the pointer moves over them, and never block the content beneath. [WCAG 1.4.13 Content on Hover or Focus, AA] — [mechanical]
46. **Custom scroll areas and carousels are keyboard-operable.** Scrollable regions need `tabindex="0"` (with a role/label) so keyboard users can scroll them; carousels need focusable, activatable controls. [WCAG 2.1.1; axe scrollable-region rule] — [mechanical]
47. **Never remove or intercept native keyboard behavior without replacing it fully.** `preventDefault` on Tab, hijacked arrow scrolling, and Enter-suppressed forms break assumptions users depend on. [consensus; APG] — [judgment]

## 7. Focus: visibility and management

48. **Every focusable element shows a clearly visible focus indicator.** Never `outline: none` without a stronger replacement. The consensus indicator: at least a 2px outline with 3:1 contrast against the background, offset from the element so it reads at a glance. [WCAG 2.4.7 Focus Visible, AA; 2.4.13 informative] — [mechanical]
49. **The focused element is never completely hidden behind other UI.** Sticky headers, cookie banners, and chat bubbles must not fully cover the item that has focus; use `scroll-padding` to keep focus targets clear of sticky bars. [WCAG 2.4.11 Focus Not Obscured (Minimum), AA — new in 2.2] — [mechanical]
50. **Opening a dialog moves focus into it; closing returns focus to the trigger.** Focus is trapped inside while open (Tab cycles within), Escape closes. A modal that leaves focus on the page behind it is invisible to keyboard and screen-reader users. [ARIA APG dialog pattern] — [mechanical]
51. **When you delete or hide the focused element, place focus somewhere sensible.** Deleting a list item must not drop focus to `<body>` (which silently resets the screen reader to the top); move it to the next item or the list heading. [ARIA APG; consensus] — [mechanical]
52. **Focus never moves without the user causing it.** No stealing focus on load (except into a just-opened dialog), no yanking focus on timers or async completions mid-typing. [WCAG 3.2.1 On Focus, A; consensus] — [mechanical]
53. **Keyboard focus and screen-reader reading position are managed, not assumed.** After in-page actions (filter applied, step advanced, item added), decide deliberately where focus goes and what gets announced; "the DOM updated" is not an answer. [WAI; consensus SPA practice] — [judgment]
54. **Don't blur or auto-dismiss on focus loss in ways that destroy work.** Menus may close on blur; forms and editors must not discard input because focus moved. [consensus] — [judgment]

## 8. Low vision: zoom, reflow, and text resizing

55. **The page works at 400% browser zoom with no horizontal scrolling.** At 400% on a 1280px window (= 320px effective width), everything reflows into one column; two-dimensional scrolling is allowed only for content that inherently needs it (maps, data tables, diagrams). This is why fluid responsive design is an accessibility requirement, not just polish. [WCAG 1.4.10 Reflow, AA] — [mechanical]
56. **Text scales to 200% without loss of content or function.** Nothing clips, overlaps, or disappears when text alone is enlarged. Use relative units (rem/em) for font sizes; never fixed-height containers around text. [WCAG 1.4.4 Resize Text, AA] — [mechanical]
57. **Never disable zoom.** No `user-scalable=no`, no `maximum-scale=1` in the viewport meta tag. Pinch-zoom is the first tool every low-vision user reaches for. [WCAG 1.4.4; Apple/Material guidance] — [mechanical]
58. **Layouts survive user-forced text spacing.** Users override line-height (1.5×), paragraph spacing (2×), letter spacing (0.12×), and word spacing (0.16×); text must not clip or overlap when they do. Practically: don't hard-fix heights on text containers. [WCAG 1.4.12 Text Spacing, AA] — [mechanical]
59. **Respect OS/browser text-size settings.** On mobile especially, honor Dynamic Type / font scale rather than locking px sizes; a body-text floor around 16px (never below 12px anywhere) is the consensus baseline. [Apple HIG; Material; WCAG intent] — [mechanical]
60. **Don't communicate through fine visual detail only.** Thin hairline distinctions, tiny badges, and 1px state changes vanish at low acuity; pair them with text or position. [WAI low-vision requirements] — [judgment]
61. **Support high-contrast and forced-colors modes gracefully.** In Windows High Contrast / `forced-colors`, borders and focus indicators must survive; don't convey boundaries only with box-shadows and background images that get stripped. [consensus; MDN forced-colors] — [mechanical]

## 9. Contrast and color

62. **Body text contrasts at least 4.5:1 against its background; large text at least 3:1.** Large = 24px+, or 18.5px+ bold. This applies to text over images and gradients too — test the worst point. [WCAG 1.4.3 Contrast (Minimum), AA] — [mechanical]
63. **UI parts you must see to operate contrast at least 3:1.** Icons, form-field borders, focus indicators, checkbox marks, slider tracks, chart lines: the "non-text contrast" rule everyone forgets. A pale-gray input border on white fails. [WCAG 1.4.11 Non-text Contrast, AA] — [mechanical]
64. **Disabled-state styling is exempt from contrast rules — but use disabled states sparingly.** Grayed-out text is legally fine and practically unreadable; prefer enabled controls that explain why an action can't proceed. [WCAG 1.4.3 exception; cognitive consensus] — [judgment]
65. **Never use color as the only way to convey information.** Error = red AND an icon AND a message; chart series differ by label/pattern, not hue alone; "required fields in red" fails for the ~8% of men with color-vision deficiency. [WCAG 1.4.1 Use of Color, A] — [mechanical]
66. **Links inside body text are distinguishable by more than color.** Underline them (or provide 3:1 contrast against surrounding text plus a non-color cue on hover/focus). [WCAG 1.4.1; WebAIM] — [mechanical]
67. **Design for the common color-blindness confusions: red/green, and blue/purple.** Check palettes through a CVD simulator; prefer redundant encodings (shape, position, text) over "safe palettes" alone. [consensus; dataviz cross-ref] — [judgment]
68. **Maintain contrast in both light and dark themes, and in every state.** Hover, selected, visited, and placeholder states each need to pass on their own; dark mode is not exempt and placeholder gray is the most common failure. [WCAG 1.4.3/1.4.11 applied; consensus] — [mechanical]
69. **Don't rely on pure white-on-black at maximum contrast for long text either.** Extreme contrast causes halation for some low-vision and dyslexic readers; slightly softened pairs that still pass AA are the consensus sweet spot. [WAI low-vision docs; typography consensus] — [judgment]

## 10. Motor: targets, pointers, drag, and gestures

70. **Touch/click targets are at least 24×24 CSS px with no overlap — and 44–48px is the real bar.** WCAG 2.2 AA sets 24px as the floor (or equivalent free space around smaller targets); Apple demands 44pt and Material 48dp, which is what best-in-class apps ship. Inline text links are exempt. [WCAG 2.5.8 Target Size (Minimum), AA — new in 2.2; Apple HIG; Material] — [mechanical]
71. **Put space between adjacent tappable things.** Dense icon rows and stacked list actions cause wrong-target taps for tremor, large-finger, and moving-vehicle users; ~8px minimum gap is the practical consensus. [WCAG 2.5.8 spacing exception logic; Material] — [mechanical]
72. **Everything achievable by dragging is achievable without dragging.** Reorder lists, sliders, kanban moves, map pans: provide single-tap/click alternatives (move up/down buttons, tap-to-select then tap-destination, +/- steppers). [WCAG 2.5.7 Dragging Movements, AA — new in 2.2] — [mechanical]
73. **Everything achievable by multipoint or path-based gestures has a single-pointer alternative.** Pinch-zoom gets +/- buttons; swipe actions get visible buttons; two-finger anything gets a one-finger path. [WCAG 2.5.1 Pointer Gestures, A] — [mechanical]
74. **Actions fire on release (up-event), not on press — so a slip can be cancelled.** Users must be able to abort by sliding off the target before releasing; no down-event triggers except where essential (e.g., piano keys). [WCAG 2.5.2 Pointer Cancellation, A] — [mechanical]
75. **Nothing requires device motion (shake, tilt) as the only input, and motion-triggered actions can be turned off.** Shake-to-undo needs a button equivalent; accidental triggering harms tremor users. [WCAG 2.5.4 Motion Actuation, A] — [mechanical]
76. **No precision demands: no double-click-only, no long-press-only, no hover-only, no tiny drag handles.** Every fine-motor interaction gets a coarse alternative; this is the umbrella habit behind 72–75. [consensus; inclusive design principles] — [judgment]
77. **Place primary actions within one-handed thumb reach on phones.** Bottom-of-screen primary actions, top-corner for rare/destructive; a stretched grip is a motor issue for everyone. [Apple/Material; situational-impairment consensus] — [judgment]

## 11. Timing

78. **Never impose a time limit the user can't turn off, adjust (to 10×), or extend (with 20s warning).** Session timeouts warn before expiry and offer "keep me signed in"; quizzes/checkouts allow extension. Exceptions only for real-time events and auctions. [WCAG 2.2.1 Timing Adjustable, A] — [mechanical]
79. **Anything moving, blinking, scrolling, or auto-updating for more than 5 seconds has a pause/stop/hide control.** Carousels, tickers, auto-advancing content: users who read slowly, or who are distracted by motion, must be able to stop it. Consensus goes further: don't auto-advance carousels at all. [WCAG 2.2.2 Pause, Stop, Hide, A] — [mechanical]
80. **If a session can expire, warn users up front about data loss and preserve their input.** Re-authenticating must not destroy a half-completed form. [WCAG 2.2.1; GOV.UK; cross-ref forms agent] — [mechanical]
81. **Never make success depend on reaction speed.** Toasts with action buttons that vanish in 3 seconds, offers that expire mid-read, "hold for 2 seconds" interactions: all fail slow-moving users. Auto-dismissing messages must also be available somewhere persistent. [WCAG 2.2.1 intent; consensus] — [judgment]

## 12. Motion, animation, and vestibular safety

82. **Honor `prefers-reduced-motion` — every non-essential animation is removed or reduced when it's set.** Parallax, zooming route transitions, springy overshoot, auto-playing background video: swap for fades or nothing. Wire it once at the app level, not per-animation as an afterthought. [WCAG 2.3.3 informative but universal practice; MDN; Apple/Material] — [mechanical]
83. **Nothing flashes more than 3 times per second.** Larger bright flashes can trigger seizures; this is an absolute, no-preference-needed rule. [WCAG 2.3.1 Three Flashes or Below Threshold, A] — [mechanical]
84. **Avoid large-area parallax, scroll-hijacking, and zoom/scale transitions as core navigation.** These are the top vestibular triggers (dizziness, nausea) even for users who never find the reduced-motion setting; keep motion small, brief, and user-initiated. [WAI; consensus from vestibular-disorder literature] — [judgment]
85. **Animation communicates, it doesn't decorate at cost.** Motion should indicate origin/destination or state change, run ~150–300ms, and never block input while it plays. (Motion craft details: cross-ref visual/interaction agent.) [Material motion; consensus] — [judgment]
86. **Background video and animated imagery autoplays only if subtle, silent, pausable, and reduced-motion-aware.** Otherwise don't autoplay it. [WCAG 2.2.2; consensus] — [mechanical]

## 13. Media: deaf and hard-of-hearing users

87. **Every prerecorded video with speech has accurate captions.** Not auto-generated-and-forgotten: names, terminology, and speaker changes corrected; sound effects noted [door slams]. [WCAG 1.2.2 Captions (Prerecorded), A] — [mechanical]
88. **Live video/audio streams have live captions.** [WCAG 1.2.4 Captions (Live), AA] — [mechanical]
89. **Audio-only content gets a transcript; video gets audio description or a descriptive transcript.** Podcast pages ship transcripts; videos where visuals carry meaning get audio description of what's on screen. [WCAG 1.2.1 A, 1.2.3 A, 1.2.5 AA] — [mechanical]
90. **No sound plays automatically for more than 3 seconds, and any audio can be paused/muted independently of system volume.** Autoplaying audio also wrecks screen-reader users, who can't hear their reader over it. [WCAG 1.4.2 Audio Control, A] — [mechanical]
91. **Every sound cue has a visual equivalent.** Success chimes, error dings, notification sounds: pair each with a visible signal, because deaf users, muted phones, and noisy gyms all miss them equally. [inclusive design principles; Apple/Material] — [mechanical]
92. **Don't rely on audio quality alone for comprehension: keep background music well below speech in produced media.** [WCAG 1.4.7 AAA — cited as practice, not requirement] — [judgment]
93. **Prefer captions on by default when sound is off.** Mainstream behavior (social feeds) and deaf users benefit identically; most mobile video is watched muted. [consensus; situational framing] — [judgment]

## 14. Forms

94. **Every input has a visible, programmatically linked label.** `<label for>` or wrapping label; clicking the label focuses the field (bigger target for free), and screen readers announce it. No orphan inputs, ever. [WCAG 1.3.1, 3.3.2, 4.1.2; WAI Forms tutorial] — [mechanical]
95. **Placeholder text is never the label.** It vanishes on typing (memory load), fails contrast rules, is skipped by some assistive tech, and looks like a filled field to cognitive and low-vision users. Use it only for format examples — or not at all. [WCAG 3.3.2; GOV.UK; Nielsen Norman] — [mechanical]
96. **Instructions and format requirements appear before the user types, attached to the field.** Password rules, date formats, character limits: shown up front and linked via `aria-describedby`, not revealed as a surprise error after submit. [WCAG 3.3.2 Labels or Instructions, A] — [mechanical]
97. **Required fields are marked explicitly (and not by color or asterisk alone).** Say "required" (or mark the few optional ones "optional" when most are required — GOV.UK pattern); expose it programmatically with `required`/`aria-required`. [WCAG 3.3.2; GOV.UK] — [mechanical]
98. **Every field that collects known-about-the-user data declares its purpose with `autocomplete`.** `autocomplete="email"`, `name`, `tel`, `street-address`… — this powers browser autofill (motor + memory relief) and lets assistive tech add its own affordances. [WCAG 1.3.5 Identify Input Purpose, AA] — [mechanical]
99. **Use the right input type and keyboard.** `type="email"`, `inputmode="numeric"`, date inputs: mobile keyboards adapt, validation comes free, and dictation works better. [consensus; Apple/Material] — [mechanical]
100. **Group related fields with `<fieldset>` and `<legend>`.** Radio groups and checkbox groups especially — without a legend, a screen-reader user hears "Yes" and "No" with no question attached. [WAI Forms tutorial; WCAG 1.3.1] — [mechanical]
101. **Don't auto-advance focus between fields, and don't submit on change.** Jumping to the next box when a field "looks full" breaks screen readers, dictation, and anyone who types unevenly; changing a select must never navigate by itself. [WCAG 3.2.2 On Input, A; consensus] — [mechanical]
102. **Accept human input formats.** Spaces in card numbers, parentheses in phones, upper/lower case, trailing whitespace: normalize in code rather than bouncing the user. (Deeper form UX: cross-ref forms/flows agent.) [GOV.UK; inclusive design consensus] — [judgment]
103. **Long forms are broken into steps with progress shown, and input is preserved across steps and errors.** Working-memory load is the top cognitive barrier in forms; never clear a form on a validation failure. [GOV.UK; COGA; cross-ref forms agent] — [judgment]

## 15. Errors and error tolerance

104. **When validation fails, say which field, what's wrong, and how to fix it — in text.** Error identified in text next to the field AND in an announced summary; screen-reader users must be able to find every error from the message alone. [WCAG 3.3.1 Error Identification, A; 3.3.3 Error Suggestion, AA] — [mechanical]
105. **Move focus to the error experience on failed submit.** Standard pattern: focus an error summary at the top that links to each failing field; each field carries `aria-invalid` and its message via `aria-describedby`. [GOV.UK error-summary pattern; WAI] — [mechanical]
106. **Error messages are polite, specific, and jargon-free.** "Enter a date after today", not "Invalid input (ERR_422)". Never blame the user; never show raw system errors. [WCAG 3.3.3; GOV.UK content guide] — [judgment]
107. **For legal, financial, or data-destroying actions: user can review, correct, and confirm — or undo.** Checkouts get a review step; deletions get confirmation or (better) undo. [WCAG 3.3.4 Error Prevention, AA] — [mechanical]
108. **Prefer undo over confirm.** Confirmation dialogs get click-throughed on autopilot; undo forgives the error after it's noticed, which is when humans actually notice. (Cross-ref core-interaction agent.) [consensus: Nielsen, inclusive design] — [judgment]
109. **Validate at the right moment: on leaving a field or on submit, not on every keystroke.** Premature "this field is wrong" while the user is mid-typing punishes slow typists and screen-reader users hardest. [consensus; forms cross-ref] — [judgment]

## 16. Cognitive accessibility and plain language

110. **Write for roughly a 9th-grade reading level or below.** Short sentences, common words, front-loaded key information, one idea per sentence. This is the single highest-leverage cognitive-accessibility act and helps every stressed, tired, or non-native reader. [WCAG 3.1.5 AAA cited as practice; GOV.UK content guide; COGA] — [judgment]
111. **Explain abbreviations, jargon, and idioms on first use — or don't use them.** [WCAG 3.1.3/3.1.4 AAA as practice; plain-language consensus] — [judgment]
112. **Navigation, controls, and terminology stay in the same place with the same names on every screen.** Repeated components appear in the same relative order; the same action never has two names ("Delete" here, "Remove" there). [WCAG 3.2.3 Consistent Navigation, AA; 3.2.4 Consistent Identification, AA] — [mechanical]
113. **Help, contact, and support links appear in the same place on every page that has them.** [WCAG 3.2.6 Consistent Help, A — new in 2.2] — [mechanical]
114. **Nothing changes context without an explicit user action.** No surprise new windows, no auto-redirects on focus or input, no popups that steal the user mid-task; if a link opens a new tab, warn in its name. [WCAG 3.2.1, 3.2.2; consensus] — [mechanical]
115. **Minimize what users must remember: recognition over recall.** Show previous choices, keep relevant info visible across steps, summarize what was entered — don't make users memorize a code on one screen to type on the next. [COGA "Making Content Usable"; Nielsen heuristic #6] — [judgment]
116. **One primary task per screen; cut every element that competes with it.** Cognitive load scales with on-screen options; progressive disclosure (details on demand) beats dense completeness. (Layout hierarchy: cross-ref visual agent.) [COGA; GOV.UK "one thing per page"] — [judgment]
117. **Numbers, dates, and times are shown in unambiguous, localized, human formats.** "22 July 2026", "in 3 days" with absolute on demand; never bare epoch-ish or ambiguous 03/04/05 formats. [consensus; COGA] — [judgment]
118. **Don't punish interruption.** Users get distracted mid-flow (ADHD, caregivers, commuters): preserve state, allow resume, never expire a cart or draft silently. [COGA; inclusive design principles] — [judgment]
119. **Icons never stand alone for critical navigation or actions without labels.** Icon comprehension varies enormously; pair icons with text labels for anything that matters, in nav especially. [COGA; Nielsen; Material nav specs] — [judgment]

## 17. Accessible authentication and redundant entry

120. **Never make login depend on a cognitive test: no memorized transcription, no puzzles, no "type the 3rd/5th/7th characters of your password".** Password fields must allow paste and password managers; email/magic links, passkeys, and OAuth all qualify. Object-recognition CAPTCHAs are barely tolerated at AA and banned at AAA — prefer invisible bot defense. [WCAG 3.3.8 Accessible Authentication (Minimum), AA — new in 2.2] — [mechanical]
121. **Never block paste, autofill, or password managers anywhere — especially auth and OTP fields.** Blocking paste is both a WCAG 3.3.8 failure and (per NCSC/NIST) worse for security. [WCAG 3.3.8; NIST 800-63B] — [mechanical]
122. **Don't ask for the same information twice in one process.** Auto-fill or offer to reuse anything already entered this session (shipping = billing checkbox is the canonical form). Memory and motor cost of re-entry is the point of the rule. [WCAG 3.3.7 Redundant Entry, A — new in 2.2] — [mechanical]
123. **Support passkeys/biometric/SSO as lower-effort paths, with an accessible fallback for each.** Biometrics fail for some disabilities (no fingerprint, facial differences); every "easy" factor needs an alternative that is also easy. [WCAG 3.3.8 intent; FIDO/consensus] — [judgment]
124. **OTP codes: use `autocomplete="one-time-code"`, accept paste of the whole code, and never split into six separate inputs without paste handling.** Split-box OTP without paste is a top real-world motor/cognitive failure. [consensus; WCAG 3.3.8 intent] — [mechanical]

## 18. Touch + assistive tech coexistence

125. **Custom touch gestures must not collide with screen-reader gestures.** VoiceOver/TalkBack own swipe navigation; when they run, your swipe-to-delete and edge-swipes are unreachable, so every gesture needs a visible-control equivalent (same rule as 72–73, doubled in importance on mobile). [Apple/Material accessibility; WCAG 2.5.1] — [mechanical]
126. **Web content must work with mobile screen readers' explore-by-touch, not just desktop Tab.** Mobile SRs navigate by swipe/element, not Tab order — `tabindex`-only fixes don't help them; correct roles and DOM order do. [Apple/Material; WAI mobile] — [judgment]
127. **Interactive elements remain operable when "activated" differently.** Assistive tech fires clicks programmatically: controls that only respond to `touchstart`/`mousedown`/`pointerdown` sequences break under switch access, voice control, and SRs. Use real `click` handlers. [consensus; Apple accessibility docs] — [mechanical]
128. **Don't override or suppress system accessibility settings.** Font scale, bold text, reduced transparency, increased contrast: inherit them; never render your own fake cursor or selection that ignores OS settings. [Apple HIG; Material] — [mechanical]
129. **Test with at least one mobile screen reader flow for any mobile-primary product.** (See §20.) The desktop-SR-only test misses the majority of real assistive-tech usage in 2026, which is mobile. [WebAIM SR survey; consensus] — [judgment]

## 19. Situational, temporary, and aging users (why this is for everyone)

130. **Design every accessibility feature as a mainstream feature, because disability is a spectrum every user visits.** One arm in a cast, holding a baby, bright sunlight, a loud gym, a concussion, low battery + old phone: temporary and situational impairments mean captions, contrast, big targets, and calm language serve 100% of users some of the time. [Microsoft Inclusive Design; inclusivedesignprinciples.info "comparable experience"] — [judgment]
131. **Sunlight test: the app is usable at half brightness outdoors.** This is contrast, target size, and not-color-alone restated as a physical test; a fitness app in particular lives outdoors and in gyms. [situational consensus] — [judgment]
132. **One-handed, thumb-only operation covers the core flows.** Reach, target size, and no-precision rules restated for the commuter with a coffee — and permanently for one-armed users. [Apple/Material ergonomics; inclusive framing] — [judgment]
133. **Aging users get the defaults, not a mode.** Slightly larger defaults, generous targets, strong contrast, no memory tests, forgiving timing — designed in for everyone rather than segregated in a "senior mode," which stigmatizes and goes unfound. [inclusive design consensus; WAI older-users guidance] — [judgment]
134. **Offer choice of ways to complete a task, and let the user's chosen method be equal, not a downgrade.** Keyboard vs. pointer, gesture vs. button, voice vs. touch: alternatives must reach the same outcome with comparable effort ("give control; offer choice"). [inclusivedesignprinciples.info] — [judgment]
135. **Add value with device capabilities, don't require them.** Voice input, haptics, camera scanning are enhancements with manual fallbacks, never sole paths. [inclusivedesignprinciples.info "add value"] — [judgment]
136. **Prioritize content: the same information and priority order for every user on every input.** The screen-reader user, keyboard user, and mouse user get the same content, same order, same capability — never a stripped "accessible version" ghetto page. [inclusivedesignprinciples.info; WCAG conformance intent] — [mechanical]

## 20. Testing practices

137. **Automated scanners catch only ~30–40% of accessibility issues; never claim accessibility from a clean axe run.** axe/Lighthouse/WAVE find missing alts and contrast math, not whether alt text is meaningful, focus order is logical, or the SR experience makes sense. Automated + manual is the only credible verification. [Deque axe-core studies; WebAIM; 2026 industry consensus] — [mechanical]
138. **Run an automated axe pass in CI on every surface, and treat violations as build failures.** Cheap 30–40% is still the cheapest 30–40%; catching regressions automatically is table stakes. [Deque; BrowserStack/industry 2026 practice] — [mechanical]
139. **Do a full keyboard-only pass on every changed flow: unplug the mouse.** Tab through the whole flow checking reachability, visible focus, logical order, no traps, and operability of every control. This single manual test finds more real blockers than any tool. [WebAIM; GOV.UK testing guidance] — [mechanical]
140. **Do a screen-reader pass with at least one real SR per platform class.** NVDA or JAWS + browser on Windows, VoiceOver on macOS/iOS, TalkBack on Android; listen to the page with the screen off: does it make sense linearly, are updates announced, are controls named? [WebAIM SR survey; GOV.UK] — [judgment]
141. **Test at 200% and 400% zoom, and with a forced 320px-wide viewport, on every changed surface.** Reflow failures are the most common low-vision defect and are trivially catchable in DevTools. [WCAG 1.4.10 test procedure] — [mechanical]
142. **Verify reduced-motion, dark mode, high-contrast/forced-colors, and largest-text settings as first-class test states.** Each is a one-toggle check; each represents real users' permanent environment. [consensus 2026 practice] — [mechanical]
143. **Include disabled users in research and usability testing — "nothing about us without us."** Paid testers with disabilities find what neither tools nor empathetic simulation finds; simulating (blindfolds, one hand) educates the team but never substitutes. [GOV.UK; industry consensus] — [judgment]
144. **Maintain an accessibility statement and a working feedback channel, and fix reported barriers fast.** Legally required under EAA/public-sector rules; practically, users who hit a barrier need a route that isn't a dead end. [EU EAA; GOV.UK] — [mechanical]
145. **Accessibility is a definition-of-done item on every ticket, not an audit phase.** Retrofit audits cost multiples of building it in; the consensus 2026 workflow is: semantic components in the design system once, then per-feature keyboard/SR/zoom checks. [industry consensus; Deque ROI data] — [judgment]
146. **When using component libraries, verify their accessibility claims — don't inherit them on faith.** Many popular libraries ship broken ARIA; test the shipped composition (your props, your overrides), because accessibility is a property of the final page. [consensus; axe/Deque guidance] — [judgment]

## Cross-references (owned by other agents)

- **Per-widget keyboard interaction contracts** (menus, comboboxes, tabs, grids, dialogs — exact key maps): agent 1 / ARIA APG; this file owns only the universal keyboard rules (§6–7).
- **Form flow design beyond accessibility** (multi-step structure, validation timing strategy, input affordances): forms/flows agent; this file owns the accessibility-specific form rules (§14–15).
- **Visual hierarchy, typography scale, spacing rhythm**: visual design agent; this file owns floors (contrast, sizes, spacing survivability), not aesthetics.
- **Motion craft and interaction feedback timing**: interaction agent; this file owns reduced-motion, flash limits, and vestibular safety (§12).
- **Chart/data-visualization encoding** (palettes, series labeling, table fallbacks): dataviz; this file owns the not-color-alone and complex-image-alternative rules (§4, §9).
- **Performance as accessibility** (old devices, slow networks disproportionately hit disabled and low-income users): performance agent.
- **Notification/permission etiquette and dark-pattern avoidance** (cognitive-load adjacent): trust/ethics agent.

## Contested / no-consensus (excluded from the numbered canon)

- **Accessibility overlay widgets** (accessiBe-style one-line "fix" scripts): actively rejected by the accessibility community and named in lawsuits; the anti-consensus is itself near-universal — do not use them. Listed here only because vendors market them as consensus.
- **WCAG 3.0**: still a working draft in 2026; its scoring model (bronze/silver/gold) is not a build target yet. Track it; build to 2.2 AA.
- **`tabindex="-1"` + programmatic focus vs. `aria-live` for SPA route announcements**: two competing patterns, both accepted; no single winner.
- **Separate "accessibility settings" screens in-app** (beyond honoring OS settings): some argue for in-app toggles (text size, motion), others say OS settings should be the single source; no consensus.
- **Dyslexia-specific fonts** (OpenDyslexic etc.): evidence does not show benefit over ordinary clean sans-serifs with good spacing; offering them is harmless but not a standard.
- **`title` attribute tooltips**: widely discouraged (inaccessible to touch and keyboard) but still emitted by many frameworks; the discouragement is near-consensus, the replacement pattern varies.
- **Exact automated-detection percentage** (30% vs 40% vs 57% "of common issues"): figures vary by study and denominator; the operative consensus (automation is necessary but far from sufficient) is solid, the number is not.
- **AAA criteria as targets** (sign language, extended audio description, 7:1 contrast, reading-level formalized): universally acknowledged as good, not consensus as requirements; individual AAA items (plain language, no-cognitive-test auth) have crossed into practice and appear above marked as practice.
