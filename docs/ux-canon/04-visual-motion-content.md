# UX Canon 04 — Visual Design, Motion, and Content

Domain: everything users see and read — typography, spacing/layout, color, hierarchy, elevation, radii, icons, imagery, data viz, motion, dark mode, UX writing, content structure, brand voice.

Tag key: **[mechanical]** = checkable by rule/tool with no taste required. **[judgment]** = requires a human (or design-trained) eye, but the direction of "better" is agreed.

Sources abbreviated: RUI = Refactoring UI (Wathan/Schoger); M3 = Material Design 3; HIG = Apple Human Interface Guidelines; NN/g = Nielsen Norman Group; VWIG = Vercel Web Interface Guidelines; BPT = Butterick's Practical Typography; WCAG = WCAG 2.1/2.2.

---

## 1. Typography

1. **Use a deliberate type scale, not ad-hoc sizes** — pick 6–9 fixed sizes (e.g. 12/14/16/18/20/24/30/36/48) and use only those; arbitrary per-screen font sizes destroy rhythm and consistency. [RUI, M3 type scale] [mechanical]
2. **Body text is 16px or larger** — 16px is the effective web floor for paragraph text; smaller body copy measurably hurts reading speed and comfort on every device class. [BPT, VWIG, NN/g] [mechanical]
3. **Never render text below 12px — an absolute floor, no exceptions** — captions and legal text bottom out at 12px, and labels run 13px+ on phones; anything smaller is illegible on real devices regardless of how "secondary" the content is. House rule (owner standing order 2026-07-19, permanent), deliberately stricter than HIG's 11pt / M3's 11sp; the floors live as tokens in app/globals.css (ds.css port landed, W2 2026-07-24). [owner order 2026-07-19; HIG, M3 as the looser platform floors] [mechanical]
4. **Inputs are ≥16px on mobile** — any `<input>` below 16px triggers iOS Safari auto-zoom on focus, which reads as a broken page. [VWIG, HIG] [mechanical]
5. **Line length 45–75 characters** — measure outside this band forces re-reading (too long) or choppy saccades (too short); constrain text columns with max-width (~65ch ideal), never let prose span a wide viewport. [BPT (45–90), RUI, NN/g] [mechanical]
6. **Line height scales inversely with size** — body text needs ~1.4–1.6 leading; large headings need tight leading (~1.1–1.25). Using one line-height token for both is a visible defect. [RUI, BPT, M3] [mechanical]
7. **Tighten letter-spacing on large display text, never on body** — headings above ~24px benefit from slight negative tracking; body text tracking should stay default or barely positive at small sizes. [RUI, M3, HIG] [judgment]
8. **Hierarchy comes from weight and color before size** — differentiate text with two or three weights (400/500/700) and two or three grey tones; if every distinction is a size jump, the scale explodes. [RUI] [judgment]
9. **Don't use more than two typefaces** — one is usually enough; a second only for a clearly distinct role (display vs. UI, or mono for code/data). Three or more reads as amateur. [BPT, RUI] [mechanical]
10. **Pair fonts by contrast of role, not similarity** — if pairing, the two faces must be obviously different in function (e.g. serif display + sans UI); near-identical sans pairs look like a mistake. [BPT, RUI] [judgment]
11. **Use tabular (fixed-width) figures for any numbers that align or update** — timers, prices, counters, table columns: `font-variant-numeric: tabular-nums` so digits don't jitter or misalign as values change. [VWIG, BPT, M3] [mechanical]
12. **Right-align numeric table columns** — numbers compare by magnitude; right alignment (with tabular figures) makes column scanning possible. Text columns stay left-aligned. [BPT, NN/g] [mechanical]
13. **Never fake secondary text with opacity alone on colored or imagery backgrounds** — secondary text on tinted backgrounds needs a hand-picked color of the same hue, not white/black at low opacity, which turns muddy. [RUI] [judgment]
14. **Don't center long text** — center alignment is for 1–3 short lines (headings, empty states); paragraphs are left-aligned (in LTR locales). [RUI, BPT] [mechanical]
15. **Avoid justified text on the web** — browsers lack good hyphenation; justification creates rivers. Use left-aligned ragged-right. [BPT, NN/g] [mechanical]
16. **Use real typographic characters** — curly quotes (" "), real ellipsis (…), en/em ranges where locale-appropriate, non-breaking spaces between values and units (`10 MB`, `Cmd K`). [VWIG, BPT] [mechanical]
17. **All-caps only for short labels, with added tracking** — uppercase is a legitimate style for tiny overline labels and tags, but needs +2–5% letter-spacing and must never be used for sentences. [RUI, BPT, M3] [mechanical]
18. **Don't rely on browser-default font rendering choices** — set `text-rendering`/font smoothing deliberately, load fonts with `font-display` strategy that avoids invisible text and layout shift (size-adjusted fallback metrics). [VWIG, web.dev consensus] [mechanical]
19. **Underline is reserved for links** — never underline for emphasis; conversely, in body prose, links should be visually distinct (underline or clear color + weight), not color-only. [BPT, NN/g, WCAG 1.4.1] [mechanical]
20. **Truncate with ellipsis only when the full value is recoverable** — a truncated string must be expandable, wrappable, or visible on hover/tap somewhere; truncation that destroys information is a bug. [NN/g, HIG] [judgment]

## 2. Spacing and Layout

21. **Use a fixed spacing scale** — all margins/paddings/gaps come from one geometric-ish scale (4/8/12/16/24/32/48/64…); arbitrary pixel values are the #1 source of "slightly off" UI. [RUI, M3 (4dp grid), HIG] [mechanical]
22. **Start with too much white space, then remove** — dense-by-default layouts read as cluttered; design generous and tighten only where the task demands density. [RUI] [judgment]
23. **Proximity encodes relationship** — space between groups must be visibly larger than space within groups (label sits closer to its own field than the previous field). Violations make forms unparseable. [RUI, Gestalt/NN/g] [mechanical]
24. **Align to a small number of vertical edges** — every screen should resolve to a few strong left edges; elements that almost align (off by a few px) look broken. [RUI, NN/g] [mechanical]
25. **Layouts are fluid between breakpoints, not designed at magic widths** — use max-widths, flexible grids, and content-driven wrapping so every width from 320px up is correct, not just the widths you tested. [VWIG, responsive-design consensus] [mechanical]
26. **Content determines width; don't stretch to fill** — forms, prose, and dialogs get max-widths appropriate to their content even on huge screens; full-bleed 100%-width form fields on desktop are a defect. [RUI, NN/g] [mechanical]
27. **Grids are a tool, not a religion** — use column grids for page scaffolding, but let components size to their content; forcing everything into 12 columns produces awkward fits. [RUI] [judgment]
28. **Establish consistent gutters and page margins per breakpoint** — one page-margin token per breakpoint (e.g. 16px phone, 24px tablet, 32px+ desktop) applied everywhere; per-screen margins drift. [M3 layout, HIG] [mechanical]
29. **Respect safe areas and system insets** — content and touch targets must clear notches, home indicators, and browser chrome (`env(safe-area-inset-*)`). [HIG, VWIG] [mechanical]
30. **Never allow horizontal page scroll** — the page body must not scroll sideways at any width; wide content (tables, code, charts) scrolls inside its own container. [VWIG, NN/g] [mechanical]
31. **Reserve space for async content** — images get explicit dimensions, skeletons mirror final layout exactly; content must not jump when data arrives (CLS ≈ 0). [VWIG, web.dev CWV] [mechanical]
32. **Make optical adjustments over mathematical ones** — icons, play triangles, and rounded shapes need nudging to *look* centered/aligned; trust the eye over the box model for glyph-level alignment. [RUI, HIG] [judgment]
33. **Vertical rhythm: consistent section spacing** — the space between repeated sections (cards, list items, page sections) is one token, applied identically; alternating gaps read as sloppy. [RUI] [mechanical]
34. **Offer density appropriate to the job — and keep it consistent** — data-heavy tables can run compact (smaller paddings, 13–14px text) while marketing surfaces run airy, but each surface picks one density and applies it throughout. [M3 density, enterprise-DS consensus (Carbon, Fluent)] [judgment]
35. **Design empty, short, and overflowing states of every layout** — a layout is only done when it survives zero items, one item, and 10× the expected content (long names, large numbers, many tags). [NN/g, RUI] [judgment]
36. **Avoid more than ~2 levels of visual nesting/containment** — boxes inside boxes inside boxes waste space and confuse hierarchy; use spacing and typography to group instead of drawing another border. [RUI] [judgment]

## 3. Color

37. **Build the palette as semantic tokens, not raw hex references** — components consume `--color-text-secondary` / `--color-surface` / `--color-danger`, never `#6B7280` directly; this is what makes theming, dark mode, and consistency possible. [M3 color roles, VWIG, DS consensus] [mechanical]
38. **Restrain the palette: one brand hue, a grey ramp, and a few functional colors** — most best-in-class apps are mostly grey/neutral with one accent; every added hue costs hierarchy. [RUI, HIG] [judgment]
39. **You need more shades than you think — define ramps up front** — each hue gets a 8–10 step ramp (50–900) chosen in advance; picking one-off lighter/darker variants ad hoc produces mismatched tints. [RUI, M3 tonal palettes] [mechanical]
40. **Don't use pure black or pure white for text** — near-black on near-white (e.g. #111 on #FAFAFA-ish) reduces harshness; pure #000-on-#FFF vibrates, and greys should often be subtly saturated toward the brand hue. [RUI, M3] [judgment]
41. **Meet WCAG contrast minimums: 4.5:1 body text, 3:1 large text and UI parts** — large = 24px+ regular or 18.7px+ bold; icons, input borders, and focus indicators need 3:1 against adjacent colors. [WCAG 1.4.3, 1.4.11] [mechanical]
42. **Never let color be the only carrier of meaning** — error/success/selected states also get an icon, label, weight, or shape change; ~8% of men can't distinguish your red/green. [WCAG 1.4.1, NN/g, dataviz consensus] [mechanical]
43. **Fix a semantic state palette and never repurpose it** — red = destructive/error, green = success, amber/yellow = warning, blue = information, and these hues are then off-limits for decoration on the same surface. [M3, HIG, DS consensus] [mechanical]
44. **Interactive states get visible color/contrast deltas** — hover, active, focus, selected, and disabled each look different from rest, and hover/active have *more* contrast, not less. [VWIG, M3 state layers] [mechanical]
45. **Disabled ≠ invisible** — disabled controls stay legible enough to read (don't drop below ~3:1 into ghost territory), and consider whether disabling is right at all vs. enabled-with-explanation. [HIG, NN/g] [judgment]
46. **Colored text on colored backgrounds: same-hue, adjusted lightness** — e.g. dark blue text on light blue banner, not grey-on-blue or white-at-50%-opacity. [RUI] [mechanical]
47. **Large surfaces get muted color; small elements may be saturated** — a saturated hue that works on a 16px icon is oppressive as a full-screen background; drop saturation as area grows. [RUI, M3] [judgment]
48. **Check the palette under color-blind simulation and in greyscale** — the UI must remain fully operable with deuteranopia simulation and hierarchy must survive a greyscale pass. [WCAG, NN/g, dataviz consensus] [mechanical]
49. **Prefer perceptually uniform color math for generated palettes** — when deriving ramps/tints programmatically, use OKLCH/LCH (or APCA-checked results), not HSL lightness, which is perceptually wrong especially for yellows/blues. [VWIG (APCA), modern CSS consensus] [mechanical]

## 4. Visual Hierarchy

50. **One primary action per view** — exactly one visually dominant button per screen/dialog; secondary actions are outlined/ghost/text style. Two solid primary buttons side by side is a defect. [RUI, HIG, M3, NN/g] [mechanical]
51. **De-emphasize to emphasize** — you usually make the hero stand out by muting everything else (greyer, smaller, lighter), not by making the hero bigger/louder. [RUI] [judgment]
52. **Three text emphasis levels are enough** — primary (dark, medium/bold), secondary (grey), tertiary/disabled (lighter grey); more levels than that are indistinguishable. [RUI, M3 on-surface/variant] [mechanical]
53. **Labels are the de-emphasized element, values are emphasized** — in data displays, "Bench press — **225 lb**": the datum carries the weight, the label recedes; many UIs get this backwards. [RUI] [mechanical]
54. **Often you can drop the label entirely** — when format makes meaning obvious (janedoe@gmail.com, $19.99, "3 sets"), a label is noise; keep labels where values are ambiguous. [RUI] [judgment]
55. **Pass the five-second test** — a first-time viewer glancing for five seconds must correctly name what the screen is for and what the main action is; if not, hierarchy has failed. [NN/g, usability-testing consensus] [judgment]
56. **Design for the F/Z scanning pattern, front-load the left edge** — users scan, not read; the first two words of every heading, link, and list item carry the scent. [NN/g eyetracking] [mechanical]
57. **Visual weight must match importance, including destructive de-emphasis** — dangerous actions (delete) are visually quieter than the safe path until the moment of confirmation, where they turn explicit red. [HIG, NN/g, M3] [mechanical]
58. **Don't let semantics dictate size** — a page's h1 doesn't have to be the visually biggest thing; heading levels are for structure/assistive tech, visual size is for hierarchy. [RUI] [judgment]
59. **Group actions by meaning, not symmetry** — button rows order and position by convention (platform-consistent placement of confirm/cancel) and by relatedness, not to make the row look balanced. [HIG, NN/g] [mechanical]
60. **Every screen answers "where am I, what changed, what now"** — page title, state feedback, and next action are each visually findable within the first viewport. [NN/g] [judgment]

## 5. Elevation, Shadows, Borders, and Radii

61. **Define a closed elevation scale and use nothing else** — 3–5 shadow levels (e.g. raised / overlay / modal), each a named token; one-off `box-shadow` values guarantee inconsistency. [RUI, M3 elevation, DS consensus] [mechanical]
62. **Elevation must map to meaning** — higher shadow = closer to user = more temporary/interactive (menus above cards above page); decorating a static element with a huge shadow lies about the z-order. [M3, HIG] [mechanical]
63. **Layer shadows: ambient + direct** — realistic shadows use at least two layers (a tight dark one plus a soft spread one), consistent with a single implied light source from above. [RUI, VWIG] [mechanical]
64. **Use light-from-above consistently** — inset vs. raised is communicated by which edge is dark; wells (inputs) can read inset, buttons raised, and the light direction never flips mid-app. [RUI] [mechanical]
65. **Don't use both a strong border and a strong shadow on the same element** — pick the separation strategy per elevation level; doubling up looks heavy. Hairline semi-transparent borders may accompany shadows for edge definition on light-on-light. [RUI, VWIG] [judgment]
66. **Borders are the last resort for separation** — prefer spacing first, then background-color difference, then a border; border-happy layouts turn into grids of boxes. [RUI] [judgment]
67. **One radii system, nested radii computed** — a small set of radius tokens (e.g. 4/8/12/full) applied by component class; and inner radius = outer radius − padding so nested rounded corners look concentric, not clashing. [RUI, HIG (concentricity), DS consensus] [mechanical]
68. **Radius is a brand voice decision — commit to one personality** — sharp corners read serious/technical, large radii read friendly/casual; mixing personalities across sibling components is a defect. [RUI] [judgment]
69. **Overlays get scrims, not just shadows** — modal layers use a semi-opaque scrim to force focus and establish depth; floating a dialog on an un-dimmed page reads ambiguous. [M3 scrim, HIG] [mechanical]

## 6. Iconography

70. **One icon family, one weight, one optical size** — all icons from a single set (or drawn to identical stroke width, corner style, and grid); a mixed-source icon sheet is instantly visible as sloppy. [HIG, M3, RUI] [mechanical]
71. **Icons are drawn on a consistent grid with consistent optical sizing** — 16/20/24px grids; don't freely scale icons up (they get blobby) or down (they get muddy) — use size-specific variants for large use. [RUI, HIG, M3] [mechanical]
72. **Icon-only is allowed only for universally learned symbols** — search, close, settings-gear, play, back-arrow; everything else gets a visible text label. "Users will learn it" is not an exemption. [NN/g, HIG] [judgment]
73. **Icon-only controls still get accessible names and (on desktop) tooltips** — `aria-label` always; tooltip on hover for pointer devices. [VWIG, WCAG 4.1.2] [mechanical]
74. **Never use the same icon for two meanings, or two icons for one meaning** — one-to-one icon-to-concept mapping across the whole product. [NN/g, DS consensus] [mechanical]
75. **Align icons optically with their text** — vertically center to the x-height/cap-height as looks right, match icon color to text color (or one step lighter), and size roughly to cap height in inline lockups. [RUI, VWIG] [mechanical]
76. **Filled vs. outlined carries state, not whim** — if outlined = inactive and filled = active (e.g. tab bars), apply that rule everywhere; don't mix filled and outlined decoratively. [M3, HIG] [mechanical]
77. **Don't use icons as bullet decoration for prose** — icons must earn their place by aiding recognition or state; a checkmark icon in front of every marketing sentence is noise. [RUI, NN/g] [judgment]

## 7. Imagery and Illustration

78. **Photos need treatment before text goes on them** — text over images requires a scrim/gradient overlay, a solid text block, or heavy image treatment; raw photo backgrounds make text randomly unreadable. [RUI] [mechanical]
79. **Enforce one illustration/photography style** — one illustration system (consistent palette, stroke, character style) and one photo treatment (color grade, crop style) across the app; mixed styles read as stock-asset soup. [RUI, brand-design consensus] [judgment]
80. **Never stretch, squash, or auto-crop faces** — images keep aspect ratio; use `object-fit: cover` with sensible focal points; letterbox rather than distort. [RUI, VWIG] [mechanical]
81. **User-generated images get containment** — unknown images sit on a defined background with fixed aspect containers and (in light UI) a subtle inner border to handle white-on-white edges. [RUI, DS consensus] [mechanical]
82. **Every meaningful image has alt text; decorative images have empty alt** — `alt=""` for decoration so screen readers skip it; real descriptions for content images. [WCAG 1.1.1] [mechanical]
83. **Don't use low-quality or generic stock/AI imagery as filler** — an image that adds no information subtracts credibility; prefer no image, or real product UI/data. [NN/g (decorative images ignored in eyetracking), RUI] [judgment]
84. **Serve images responsively and reserve their space** — `srcset`/modern formats, explicit width/height to prevent CLS, lazy-load below the fold only. [web.dev CWV, VWIG] [mechanical]
85. **Empty states get purposeful illustration or none** — an empty state is guidance (what this is + how to fill it + CTA); illustration there is fine if on-system, but must not replace the instructions. [NN/g, M3, DS consensus] [mechanical]

## 8. Data Visualization

86. **Chart type follows the question** — trend over time → line; comparison across categories → bar; part-of-whole (few parts) → stacked bar or pie ≤ ~5 slices; distribution → histogram; correlation → scatter. Don't pick charts aesthetically. [NN/g, Few/Tufte consensus] [mechanical]
87. **Bar charts start at zero; line charts need not** — truncating a bar axis lies about proportion; line charts may zoom the y-range to show variation but must label the axis clearly. [dataviz consensus (Few, NN/g)] [mechanical]
88. **Keep axes honest: no dual-y tricks, no uneven intervals, no inverted axes** — consistent tick spacing, clearly labeled units; dual y-axes only with strong justification and explicit color-matching of axis to series. [Few/Tufte, NN/g] [mechanical]
89. **Label data directly instead of using legends where possible** — put series names at line ends, values on/next to bars; legends force back-and-forth eye travel and break down for colorblind users. [NN/g, Few, dataviz consensus] [mechanical]
90. **Maximize data-ink: remove gridlines, borders, and 3D you don't need** — light or no gridlines, no chart borders, never 3D or skeuomorphic depth on data. [Tufte, RUI] [mechanical]
91. **Color in charts is semantic and restrained** — one accent for the series that matters, grey for context series; categorical palettes max ~6–8 distinguishable colors; sequential ramps for magnitude; diverging ramps only around a meaningful midpoint. [dataviz consensus, M3, dataviz skill] [mechanical]
92. **Chart colors must survive color-blindness and greyscale** — vary lightness, not just hue, across series; test with simulators. [WCAG, Okabe-Ito/dataviz consensus] [mechanical]
93. **Every chart states its units, timeframe, and source context** — a number without units/timeframe ("47") is decoration; axis or title carries "Workouts per week, last 12 weeks". [Few, NN/g] [mechanical]
94. **Use tabular numerals and consistent precision in data displays** — same decimal places within a column/series; don't show 4 significant figures where 2 carry the meaning. [BPT, Few] [mechanical]
95. **Sort categorical bars by value unless order is inherent** — alphabetical sorting hides the story; use natural order only for time or ordinal scales. [Few, NN/g] [mechanical]
96. **Big-number stats get comparison context** — a KPI tile shows the value plus delta vs. previous period or target; a lone number can't be evaluated. [NN/g dashboards, Few] [judgment]
97. **Charts degrade gracefully: empty, sparse, and single-point states** — one data point cannot draw a line; design the "not enough data yet" state explicitly. [NN/g, DS consensus] [judgment]
98. **Interactive charts still work at a glance without interaction** — hover tooltips are enhancement; the headline insight must be visible with zero interaction (and on touch, where hover doesn't exist). [NN/g, dataviz consensus] [mechanical]

## 9. Motion and Animation

99. **Every animation has a job: orient, connect, or give feedback** — motion explains where something came from/went, confirms an action, or directs attention; animation that only decorates is a cost. [M3, HIG, NN/g] [judgment]
100. **UI transitions live in ~100–500ms** — micro-interactions 100–200ms, standard component transitions 200–300ms, large/full-screen transitions 300–500ms; longer feels sluggish, shorter is invisible. [M3 duration tokens (50–500ms bands), NN/g response-time limits] [mechanical]
101. **Nothing users wait on repeatedly gets a long animation** — an animation on a frequent path (opening a menu, switching tabs) must never gate input; delight on first sight becomes friction on the hundredth. [HIG, NN/g] [judgment]
102. **Use standard easing, never linear, for spatial movement** — ease-out for entrances (fast start, settle), ease-in or ease-in-out for exits, emphasized/decelerate curves for large movements; linear only for opacity/color or continuous spinners. [M3 easing tokens, HIG, VWIG] [mechanical]
103. **Animations must be interruptible and input-driven** — a new user action cancels/retargets a running transition instantly; never lock input while something animates; avoid autoplaying motion. [VWIG, HIG, M3] [mechanical]
104. **Honor `prefers-reduced-motion` with a reduced variant** — replace movement/scale/parallax with opacity cross-fades (not "no feedback at all") when the OS flag is set. [VWIG, HIG, WCAG 2.3.3] [mechanical]
105. **Enter/exit are asymmetric** — entrances are slightly slower and decelerating (element arrives), exits are faster and accelerating (element leaves); equal-duration symmetric transitions feel mechanical. [M3, HIG] [mechanical]
106. **Animate transform and opacity only; never animate layout properties** — top/left/width/height/margin animations jank; use `transform: translate/scale` and `opacity`, promoted to the compositor. [VWIG, web.dev] [mechanical]
107. **Never `transition: all`** — list transitioned properties explicitly; `all` causes accidental animations and performance traps. [VWIG] [mechanical]
108. **Motion respects a shared spatial model** — things exit the way they came in; a panel sliding in from the right doesn't fade out; child views slide over parents and slide back. Consistent choreography is what makes navigation feel physical. [M3, HIG] [judgment]
109. **Loading indicators are delayed and then persist** — show spinners/skeletons only after ~150–300ms (fast responses never flash one), and once shown keep them ≥300–500ms to avoid flicker. [VWIG, NN/g] [mechanical]
110. **Skeletons over spinners for content-shaped loads** — skeletons that mirror final layout exactly beat spinners for perceived speed; a skeleton that doesn't match the final content causes layout shift and is worse than a spinner. [VWIG, NN/g] [mechanical]
111. **Feedback under 100ms needs no animation at all** — instant state changes (checkbox toggle) can just switch; adding a transition to something that could be instant slows the product. [NN/g response times, HIG] [judgment]
112. **No layout shift from motion** — entrances must not push settled content around; reserve space, use overlays, or animate within reserved bounds. [VWIG, web.dev CWV] [mechanical]
113. **Springs/physics for gesture-driven motion, curves for triggered motion** — anything tracking a finger/pointer continues with momentum from release velocity; tap-triggered transitions use duration+easing (or a standard/expressive spring scheme). [HIG, M3 physics system] [mechanical]
114. **Limit concurrent motion** — one focal animation at a time; when many elements enter, use short stagger (~20–50ms/item, capped) rather than everything moving at once or a long parade. [M3, HIG] [judgment]
115. **Continuous ambient animation must be pausable and rare** — looping background motion (gradients, particles) drains battery, distracts, and violates WCAG if uncontrollable past 5 seconds; provide pause or keep it out of task UIs. [WCAG 2.2.2, HIG] [mechanical]

## 10. Dark Mode

116. **Dark mode is a full first-class theme, not an inversion filter** — every surface, state, chart, and illustration gets audited in dark; auto-inverted colors fail contrast and brand. Feature parity between themes is mandatory if you ship dark at all. [M3, HIG, VWIG] [judgment]
117. **Semantic tokens are the mechanism — components never branch on theme** — components reference `--surface`/`--text-primary`; only the token layer changes per theme. Any `if dark` in component code is a defect. [M3, DS consensus] [mechanical]
118. **Dark surfaces are dark grey, not pure black** — base around #121212-ish (or a subtly tinted dark) so shadows and elevation remain expressible; pure black creates smearing on OLED scrolling and kills depth. [M3] — though see Contested: HIG permits true black. [judgment]
119. **In dark mode, elevation = lighter surface** — shadows barely read on dark; higher layers get progressively lighter overlay tints (elevation overlays) so modals sit visibly above pages. [M3, HIG elevated dark colors] [mechanical]
120. **Desaturate accents for dark backgrounds** — fully saturated brand colors vibrate on dark; use the lighter, less saturated ramp steps (M3 uses tone-80 variants) for text/icons on dark. [M3, RUI] [mechanical]
121. **Contrast minimums apply in dark mode too — and watch light-on-dark halation** — 4.5:1 still binds; avoid large blocks of pure-white body text on black (drop to ~87% white / a near-white grey). [WCAG, M3] [mechanical]
122. **Dim or contain bright imagery in dark mode** — full-brightness white-background images glare; use slight dimming, dark-variant assets, or contained thumbnails. [M3, HIG] [judgment]
123. **Set `color-scheme` and `theme-color` so browser chrome matches** — `color-scheme: dark` on the root fixes scrollbars/form controls; `<meta name="theme-color">` per theme aligns the browser/status bar. [VWIG] [mechanical]
124. **Respect the OS preference by default; a manual override persists** — default to `prefers-color-scheme`, offer light/dark/system control, remember the choice, and never flash the wrong theme on load (no FART — flash of inaccurate theme). [HIG, VWIG, web consensus] [mechanical]
125. **Charts and data viz get their own dark-mode palette pass** — series colors, gridlines, and scrims re-derived for dark backgrounds; light-mode chart colors on dark surfaces routinely fail contrast and glow. [dataviz consensus, M3] [mechanical]
126. **Shadows in dark mode are for shape, tints for depth** — keep subtle shadows for edge definition but don't rely on them for hierarchy; borders/hairlines gain importance on dark. [M3, VWIG] [judgment]

## 11. UX Writing and Microcopy

127. **Sentence case for UI text** — buttons, labels, headings in sentence case ("Save changes", not "Save Changes"); it's faster to read and easier to keep consistent. [M3, NN/g, most modern DSs] — see Contested: Apple/Vercel use Title Case for some elements. [mechanical]
128. **CTAs are verb-first and specific** — "Start workout", "Save changes", "Delete account" — never "Submit", "OK", "Yes", or "Click here". The button label alone must say what happens. [NN/g, HIG, M3] [mechanical]
129. **Front-load every string** — first ~2 words carry the meaning (users scan): "Delete workout?" not "Are you sure you would like to delete this workout?". [NN/g] [mechanical]
130. **Cut word count ruthlessly** — UI copy is roughly half of what you'd write in prose; every sentence earns its place; no filler ("please note that", "in order to"). [NN/g, VWIG] [judgment]
131. **Use numerals, not words, for numbers** — "8 workouts", "3 days left" — digits are what scanners' eyes lock onto. [NN/g eyetracking, VWIG] [mechanical]
132. **One term per concept, everywhere** — a thing renamed between screens ("workout" here, "session" there; "remove" vs "delete") reads as two things; keep a product glossary and enforce it. [NN/g, DS consensus] [mechanical]
133. **Error messages say what happened, why, and what to do next — in human language** — never raw codes, never blame ("invalid input"), never dead ends; the fix is in the message ("That email is already registered. Try signing in instead."). [NN/g, HIG, VWIG] [mechanical]
134. **Never use "please" as apology padding or alarmist words for routine errors** — calm, direct, non-anxious tone; "Warning!! Fatal error" for a form typo destroys trust. [NN/g, MS/Google style consensus] [judgment]
135. **Confirmation dialogs name the object and the consequence, and buttons repeat the verb** — "Delete 'Leg day'? This can't be undone." with [Cancel] [Delete], never [Yes] [No]. [HIG, NN/g] [mechanical]
136. **Empty states teach: what this is, why it's empty, what to do** — every empty view gets one line of orientation and a CTA; a blank pane or lone "No data" is a defect. [NN/g, M3, DS consensus] [mechanical]
137. **Placeholder text is not a label** — placeholders vanish on focus and fail recall/accessibility; every field keeps a visible persistent label; placeholders only for format examples. [NN/g, WCAG, VWIG] [mechanical]
138. **Address the user as "you"; the system says what "we" only when an organization acts** — second person throughout; never mix "my account" and "your account" in one product (pick "your"). [MS/Google style guides, NN/g] [mechanical]
139. **Write in active voice, present tense** — "Chad saved your workout" not "Your workout has been saved by the system"; instructions are imperative ("Choose a plan"). [NN/g, VWIG, style-guide consensus] [mechanical]
140. **Buttons and links say where they go / what they do — no bare "Learn more"** — links are information-scented, distinguishable out of context (also a screen-reader requirement). [NN/g, WCAG 2.4.4] [mechanical]
141. **Don't concatenate translated strings or bake plurals in** — build sentences from full templated strings with named placeholders; use proper pluralization (ICU MessageFormat), because "1 items" and word-order breakage are inevitable otherwise. [i18n consensus, MDN/Unicode] [mechanical]
142. **Leave expansion room for localization** — German/Finnish run 30–40% longer; buttons, tabs, and labels must survive text expansion without truncation; never force fixed-width text containers. [i18n consensus, M3, HIG] [mechanical]
143. **Format numbers, dates, times, and currency with locale formatters** — `Intl.NumberFormat`/`DateTimeFormat`, never hand-assembled "$" + value or MM/DD assumptions. [i18n consensus, VWIG] [mechanical]
144. **Relative timestamps for recency, absolute on demand** — "2 h ago" for feeds with the exact datetime available (tooltip/tap); absolute dates for records and anything legal/billing. [NN/g, platform consensus] [judgment]
145. **Match the user's vocabulary, not the org chart or database** — labels use words users say (not internal jargon, table names, or feature codenames); jargon only when the audience is expert and uses it themselves. [NN/g heuristic #2] [judgment]
146. **Microcopy anticipates anxiety at the moment of commitment** — next to irreversible or costly actions, one line answers the fear: "You can cancel anytime", "This won't post anything". [NN/g, conversion-UX consensus] [judgment]
147. **Success feedback is brief and quiet** — confirm completion in a few words (toast/inline), don't celebrate routine actions with modals; reserve big moments for genuinely big milestones. [NN/g, M3] [judgment]
148. **Keyboard shortcuts, units, and technical values render in distinct type** — kbd styling for shortcuts, mono/tabular for IDs and codes, units never separated from their value by a line break. [VWIG, BPT] [mechanical]

## 12. Content Structure

149. **One h1 per page; heading levels never skip** — h1 → h2 → h3 in order; headings are structure for scanning and screen readers, not font-size shortcuts. [WCAG/WAI, NN/g] [mechanical]
150. **Headings are descriptive, not clever** — a heading must summarize its section so a heading-scan alone gives the page's outline; puns and marketing tone belong in body copy at most. [NN/g] [judgment]
151. **Prefer lists and tables over prose for parallel content** — 3+ parallel items become a bulleted list; anything users compare becomes a table; walls of prose are unscannable in UI. [NN/g] [mechanical]
152. **Chunk with one idea per paragraph, front-loaded** — short paragraphs (1–3 sentences in UI contexts), key point first (inverted pyramid). [NN/g] [mechanical]
153. **Progressive disclosure for secondary content** — details, advanced options, and long explanations sit behind expanders/"Show more", with the primary path visible by default; but never hide the one thing everyone needs. [NN/g] [judgment]
154. **Truncation rules are explicit and consistent** — decide per content type: wrap (titles up to 2 lines), middle-truncate (file paths, addresses — the end matters), end-truncate with title/tooltip (descriptions); apply uniformly. [HIG, VWIG, DS consensus] [mechanical]
155. **Line-break and wrap deliberately** — no orphan single words on marketing headlines where controllable (`text-wrap: balance`), no breaking between number and unit, no awkward two-word second lines on buttons. [VWIG, BPT] [mechanical]
156. **Every page's first viewport states its purpose** — title + one-line context before any content requires scrolling to understand; users decide to stay within seconds. [NN/g] [judgment]

## 13. Brand Voice Boundaries

157. **Personality lives in content spaces; system UI stays neutral** — brand voice (humor, attitude, character) belongs in editorial content, celebrations, and designated character surfaces; buttons, navigation, settings, errors, and destructive flows use plain neutral wording. [NN/g core-4 voice dimensions, MailChimp/style-guide consensus] [judgment]
158. **Voice never gets in the way of a stressed user** — error, payment, security, and data-loss moments drop all personality; a joke in a failure state reads as mockery. [NN/g, MailChimp voice-and-tone] [mechanical]
159. **Voice is defined once and versioned** — a short voice charter (2–4 adjectives with "this-not-that" examples) governs all writers/models; per-screen improvised tone drifts into incoherence. [NN/g, content-strategy consensus] [mechanical]
160. **Humor and character must survive repetition** — a quip users see daily becomes irritation; recurring strings (buttons, empty states seen often) stay plainer than one-time moments (onboarding, milestones). [NN/g, UX-writing consensus] [judgment]
161. **Tone adapts to the user's moment; voice stays constant** — same personality, modulated intensity: upbeat in success, matter-of-fact in process, gentle in failure. [MailChimp voice-and-tone, NN/g] [judgment]

## 14. Internationalization and RTL

162. **RTL locales get a mirrored layout, driven by logical properties, not a second stylesheet** — direction flows from `dir="rtl"` plus CSS logical properties (`margin-inline-start`, `padding-inline-end`, `text-align: start`); hand-flipping individual screens guarantees drift. [W3C i18n, MDN logical properties, M3 bidirectionality] [mechanical]
163. **Mirror directional icons; never mirror universal or media symbols** — back/forward arrows, "next" chevrons, list indentation, and progress direction flip in RTL; checkmarks, logos, clocks, physical-object icons, and media playback controls (play/rewind/fast-forward) do not. [M3 bidirectionality, Apple HIG right-to-left] [mechanical]
164. **Numbers, phone numbers, and embedded LTR runs stay LTR inside RTL text** — use Unicode bidi isolation for mixed-direction strings (usernames, URLs, code, units) so adjacent punctuation doesn't scramble. [W3C i18n bidi guidance] [mechanical]
165. **Test RTL as a first-class layout state, not a translation afterthought** — an RTL/pseudo-locale pass on changed surfaces catches clipped text, unflipped icons, and broken alignment before Arabic/Hebrew users do. [i18n consensus, Apple/Android RTL testing guidance] [mechanical]
166. **Translation completeness is a shipping gate for any locale you claim** — a UI mixing English chrome into a supported locale reads as broken; an incomplete locale stays unlisted rather than half-shipped. [i18n consensus, platform localization guidance] [judgment]
167. **Leave layout room for script metrics, not just string length** — beyond the 30–40% expansion rule (#142): tall scripts (Thai, Devanagari) need line-height headroom, CJK needs correct line-breaking without hyphenation, and `lang` is set per content so fonts and wrapping behave. [W3C i18n, #142] [mechanical]
168. **Locale formats render from one shared formatting layer, everywhere** — dates, week start, decimal separators, and units flow from locale + user preference through shared formatters (#143, canon 01 §U.170–171); per-screen hand-formatting is where "07/22" vs "22.07" bugs breed. [Intl/CLDR consensus, DS consensus] [mechanical]

---

## Cross-references (owned by other agents)

- **Touch target sizes, focus states, keyboard navigation, screen-reader semantics** → accessibility/interaction agent (visual contrast of focus rings noted here in #41/#44; sizes 24px/44px are theirs).
- **Perceived performance beyond loading-indicator visuals** (optimistic UI, response-time budgets, prefetching) → performance/feedback agent; here only the visual layer (#109–#112).
- **Navigation architecture, IA, and wayfinding models** → navigation/IA agent; here only their visual expression (#60, #108).
- **Form design mechanics** (validation timing, input types, autofill) → forms agent; here only labels/placeholders/error copy (#133, #137).
- **Onboarding, empty-state strategy as a flow** → lifecycle agent; here only empty-state visuals/copy (#85, #136).
- **Notification/permission etiquette and interruption design** → trust/etiquette agent; toast visual/verbal style covered in #147.
- **Design tokens as an engineering practice** (naming, theming pipeline) → systems agent; semantic-token principles here (#37, #117) state the user-visible consequence.

## Contested / no-consensus

- **Title Case vs sentence case**: Apple HIG and Vercel use Title Case for buttons/headings; Material, Shopify Polaris, MS/Google style guides, and NN/g favor sentence case. Genuine split — pick one and enforce it (#127). [contested]
- **Pure black dark backgrounds**: Material prohibits (#121212 floor); Apple ships true-black system dark and OLED users often prefer it. (#118) [contested]
- **APCA vs WCAG 2.x contrast math**: APCA is perceptually better and endorsed by Vercel; WCAG 2.x remains the legal/compliance standard. Safe path: pass both. (#41, #49) [contested]
- **Skeleton screens universally better than spinners**: strong consensus for content-shaped loads, but research (NN/g) shows badly matched or slow skeletons perform worse; some teams (Apple) rarely use skeletons at all. (#110) [contested at the margins]
- **Disabled buttons vs enabled-with-error**: growing consensus (NN/g, form-UX writers) that disabled submit buttons harm discoverability of what's wrong, but major platforms still ship disabled-until-valid. (#45) [contested]
- **Easing/duration tokens vs physics springs**: Material 3's newer expressive motion replaces duration+easing with spring schemes; HIG is spring-first; the web at large still standardizes on duration+cubic-bezier. Direction of travel is springs, consensus not yet universal. (#100, #113) [contested]
- **Em-dash and typographic dash usage**: typographers (BPT) prescribe them; several product style guides (and this project's owner) ban them in UI copy. House-rule territory, not canon.
- **Hover-revealed actions on desktop**: some design systems embrace progressive reveal on hover; others call hidden affordances a discoverability defect (NN/g leans against). No consensus.
