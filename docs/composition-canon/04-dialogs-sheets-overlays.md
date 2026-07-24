# Composition Canon 04 — Dialogs, Sheets, and Overlays: Internal Anatomy

Domain: what goes INSIDE a dialog, bottom sheet, popover, or any temporary overlay, and how it is arranged — the title/content/actions contract, content budgets, interior containers, scroll behavior, action-bar geometry, sheet-specific anatomy, and sizing at every width. Container SELECTION (dialog vs. sheet vs. page, when modality is allowed at all) is already law in ux-canon `02-navigation-ia-flows.md` §17 — this file references it and defines the overflow signals that prove, from the inside, that the wrong container was chosen. Dialog/confirmation WORDING is owned by the copy canon; motion is owned by ux-canon 04 §9; focus order and ARIA are owned by ux-canon 05.

Tag key: **[mechanical]** = checkable by rule/tool with no taste required. **[judgment]** = requires a human (or design-trained) eye, but the direction of "better" is agreed.

Sources abbreviated: HIG = Apple Human Interface Guidelines (alerts, sheets, popovers — sheets guidance updated Mar 2026); M3 = Material Design 3 (dialogs, bottom sheets); NN/g = Nielsen Norman Group (modal/nonmodal and confirmation-dialog articles); VWIG = Vercel Web Interface Guidelines + Geist Modal spec; Baymard = Baymard Institute overlay/mobile research; Polaris = Shopify Polaris modal; Carbon = IBM Carbon modal/dialog pattern; ADS = Atlassian Design System modal dialog; APG = WAI-ARIA Authoring Practices (dialog pattern); RUI = Refactoring UI.

Motivating defect (real, `design flaw.png`): a finish-workout confirm dialog at phone width containing a title, body, a duration field row that clips its unit label and produces a horizontal scrollbar inside the dialog, a notes textarea, and one option boxed in a nested card while its sibling group is not — with the confirm buttons scrolled out of view. Nearly every section below has a principle that this one screenshot violates.

---

## 1. The anatomy contract: title → supporting content → actions

1. **Every overlay is built from exactly three zones in fixed top-to-bottom order: title, supporting content, actions.** This is the one structure users have learned from every platform; the moment content appears above the title or below the actions, the overlay stops parsing at a glance. (Full-screen dialogs and sheets may relocate actions into a top bar — see §31.) Plain English: a dialog is a sentence — subject, body, verb — and the verb goes at the end. [M3 dialog anatomy; HIG alerts; Polaris; Carbon; ADS] [mechanical]

2. **The title is the first element, set at the overlay's largest text size, and it wraps — it never truncates.** A cut-off title in a decision surface means the user is deciding blind. Reserve the top-trailing corner for the close control so the title's wrap width is planned, not accidental. [M3 (headline); HIG; Carbon; ux-canon 04 §1.20] [mechanical]

3. **Pick one text-alignment axis for the whole overlay and hold it.** Content-bearing dialogs and sheets are start-aligned (left in LTR) throughout — title, body, labels. Center alignment is legitimate only for the short alert form (icon + title + 1–2 lines + buttons, nothing else); mixing centered title with left body reads as two different components glued together. [M3 (left for basic dialogs, centered for icon dialogs); HIG (alerts centered); RUI] [judgment]

4. **One title per overlay — no interior headings at or near title scale.** If the content needs its own section headings to be navigable, that is an overflow signal (§11), not a styling problem. Small overline-style group labels (13px+, per house type floor) are fine; a second 20px+ heading is not. [NN/g (short tasks); M3; RUI hierarchy] [judgment]

5. **Zone spacing is visibly larger than intra-zone spacing, from one spacing token per boundary.** The gap title→body, body→actions must exceed any gap inside the body, or the three-zone structure dissolves. M3's reference geometry: 24dp container padding, 16dp between headline and supporting text; use the ds.css spacing scale equivalents, but keep the *ratio* — between-zones > within-zone. Plain English: the three zones should be separable with your eyes squinted. [M3 dialog specs; RUI/Gestalt proximity; ux-canon 04 §2.23] [mechanical]

6. **Supporting content answers the title immediately and specifically — it sits directly under the title with nothing interposed.** State consequences in the body ("2 unchecked sets won't be saved"), not in captions scattered under fields further down. A user who reads only title + first body line must already know what the decision is. [NN/g confirmation dialogs; HIG alerts] [judgment]

7. **An optional leading icon, when used, sits above the title and switches the dialog to the centered alert form — it is never decoration beside a left-aligned title.** Use it only when it adds meaning (warning, success), and at most one. [M3 icon dialogs; HIG (macOS/visionOS alert icons)] [mechanical]

8. **The close affordance (X), when present, lives in the top corner on the title row, with a full-size touch target (≥44px) that does not collide with the wrapping title.** Sheets and full-screen dialogs get one as a rule; small confirm dialogs may rely on the Cancel action instead (whether to show both is contested — see end). Every overlay still needs *some* visible dismissal per ux-canon 02 §17.169. [HIG sheets (Mar 2026 button-placement update); Polaris; ADS; ux-canon 02 §17.169] [mechanical]

9. **Nothing else may occupy the title zone: no tabs, no steppers, no metadata rows above the title.** Tabs or steps inside an overlay mean the task has structure — which means it outgrew the container (§11). [NN/g; M3 (full-screen dialogs exist for exactly this)] [judgment]

## 2. Content budget: how much a dialog may carry

10. **A confirmation dialog's full budget is: one title, 1–3 sentences of body, at most one simple input, and 2–3 actions.** Not one of each category as a starting point — that is the *ceiling*. The Geist/VWIG modal contract is explicit: body is 1–3 sentences; NN/g's frame is "short tasks or alerts." Anything beyond this budget is a different component. [VWIG/Geist modal; NN/g modal & nonmodal; HIG alerts ("minimal interruption")] [mechanical]

11. **These are the overflow signals; any ONE of them means the wrong container was chosen (escalate per ux-canon 02 §17):** (a) the body scrolls at 320–384px width, (b) two or more input groups, (c) any interior section that needs its own heading or box to hold together, (d) a multi-step or branching flow, (e) content the user might want to reference the page underneath to complete. The escalation ladder from the inside: alert → dialog → sheet or full-screen dialog → page. Plain English: a dialog that scrolls is a form pretending to be a question; the fix is never a scrollbar, it's a different container. [NN/g; M3 (full-screen dialogs for tasks that don't fit); HIG sheets; ux-canon 02 §17] [mechanical]

12. **A confirmation is a decision surface, not a data-collection surface — do not attach optional form fields to a confirm.** If finishing a workout genuinely wants duration and notes, that is a small "finish" step (sheet or page) whose primary action confirms, not a confirm dialog that grew fields. The one endorsed exception: a single typed-confirmation input gating a high-stakes destructive action. [NN/g confirmation dialogs; VWIG (typed match for destructive); Baymard (overlays that demand input before the user's goal read as "pushy")] [judgment]

13. **Every element inside an overlay must serve the single decision or task; each addition taxes the decision.** The test per element: "if this were removed, could the user still decide correctly?" If yes, it goes — to a caption on the origin screen, to a settings default, or nowhere. The screenshot's "mark all sets as done" option is a second decision nested inside the first; two decisions = a step, not a dialog. [NN/g; HIG alerts; RUI] [judgment]

14. **Optional or advanced content inside a legitimate sheet defaults collapsed or below the fold of the smallest detent — never stacked at full weight above the actions.** Essentials at the top, in the space visible at the medium detent; nice-to-haves after. [HIG sheets/detents; M3 bottom sheets] [judgment]

15. **Never make content fit by shrinking it — no reduced type, tightened spacing, or clipped labels to squeeze into the container.** Type inside overlays uses the same scale as the page (house floor: 12px absolute, 13px+ labels on phones, 16px inputs). If it doesn't fit at full size, the container is wrong (§11). [house type-floor order 2026-07-19; ux-canon 04 §1.2–1.4; HIG] [mechanical]

## 3. Containers within overlays

16. **An overlay IS a container — content sits directly on its surface.** The dialog's own edge, elevation, and scrim already do all the containment work; nothing inside it needs a second enclosure to be perceived as grouped. This is the north star's cardless rule applied at its easiest site: the overlay is the one place containment is already given for free. [design-north-star; RUI (fewer boxes); M3 (dialog content on container surface); ux-canon 04 §2.36] [mechanical]

17. **Separate interior groups with the weakest separator that works, in this order: spacing → subtle divider line → background-contrast band → border/box.** Reach for the next rung only when the previous one demonstrably fails. In a surface the size of a dialog, spacing almost always suffices; a full-divider is occasionally right in a long sheet; a bordered box almost never. [RUI; M3 (dividers in dialogs only when content scrolls); design-north-star] [judgment]

18. **A nested card inside a dialog or sheet is a defect signal, not a style choice.** If a group of content needs its own box to hold together inside an overlay, either the grouping is weak (fix with spacing/typography) or the content doesn't belong in this container (overflow signal, §11). [design-north-star anti-goals; RUI; M3] [judgment]

19. **The defensible interior containers — allowed because they represent a *thing*, not a *grouping*:** a scrollable code/log block, a text input or textarea (fields are containers by nature), an image or media preview, and an object preview that stands for the item being acted on (the file you're deleting, the card being charged). The test: does the box depict content, or is it organizing layout? Depiction is fine; organization is the defect. [Carbon (code snippets in modals); Polaris; design-north-star escape hatch] [judgment]

20. **Never mix boxed and unboxed sibling groups at the same level.** One option in a card while the neighboring notes group floats free (the screenshot) tells the user the two differ in kind when they don't — containment is hierarchy information, and false hierarchy is misinformation. Either both are plain groups (correct here) or the design is wrong twice. [Gestalt/common-region; RUI; ux-canon 04 §4] [mechanical]

21. **Checkbox and toggle options inside an overlay are plain list rows: control + label + optional one-line caption, full-width tap target, no enclosing card.** This is how every settings screen on both platforms renders options; a boxed checkbox is a hand-rolled variant of a solved control. [HIG (settings rows); M3 (list items with controls); CLAUDE.md §3 shared components] [mechanical]

## 4. Scroll rules

22. **Horizontal scroll inside an overlay is always a defect — zero exceptions at any width.** Every child of the overlay fits the content column (container width minus padding) by wrapping, stacking, or shrinking flexibly. A horizontal scrollbar inside a dialog (the screenshot) is the single most mechanical failure in this file: `child overflow-x > container` = bug. [VWIG; ux-canon 04 §2.30 (page-level rule, applied to the overlay as its own viewport)] [mechanical]

23. **If the body must scroll (legitimate only in sheets, full-screen dialogs, and pickers — see §11 for dialogs), ONLY the body zone scrolls: title pinned above, action bar pinned below.** The user must always see what they're deciding and always be able to act. A scroll container that includes the buttons is broken by construction. [M3 (scrollable dialogs pin headline/actions with dividers); Carbon (sticky footer); ADS; HIG sheets] [mechanical]

24. **Actions never scroll out of reach — at no scroll position, viewport size, or keyboard state.** This is the pinned-footer rule stated as its own invariant because it is the highest-stakes one: an overlay whose confirm button is below the fold (the screenshot) has hidden its entire purpose. Automated check: action bar bottom edge ≤ visual viewport bottom at 320/384/desktop, keyboard open and closed. [Carbon; ADS; HIG sheets Mar-2026 button-placement guidance; Baymard (buttons out of view drive abandonment)] [mechanical]

25. **Signal hidden content: when the body scrolls, show a boundary cue (hairline divider or subtle shadow) at the pinned edges, appearing only while content is actually clipped under them.** M3's rule: dividers appear above/below the scrolling region of a scrollable dialog; the cue tells the user there is more, and vanishing when scrolled to the end tells them there isn't. [M3 dialog specs; Carbon] [mechanical]

26. **Lock the page behind: background scroll is disabled while a modal overlay is open, `overscroll-behavior: contain` on the overlay's scroll region, and body scroll restored the moment it closes.** Scroll chaining that moves the page under the scrim breaks the modality contract and disorients on return. [VWIG/Geist; APG dialog pattern] [mechanical]

27. **Cap the overlay's height below the viewport: a centered dialog tops out around 80–85% of viewport height; only sheets and full-screen dialogs may touch the edges.** A dialog that spans the full height is a page wearing a dialog costume — and it leaves no visible scrim, so the user loses the "temporary surface" signal. [M3; ADS (max-height with sticky header/footer); HIG] [mechanical]

## 5. Action bar geometry

28. **Inline actions align to the trailing edge (right in LTR), primary action outermost-trailing, Cancel/secondary immediately before it.** This is the web/desktop and Android convention and both platforms' current spec; macOS agrees (primary bottom-right). Never left-align or center a dialog's inline action row. [M3; HIG; Polaris; Carbon; ADS] [mechanical]

29. **Two actions is the norm, three is the ceiling — and a third action (e.g. "Discard" beside Cancel/Save) must be visually separated at the leading edge or the bar must stack.** More than three choices is not a dialog, it's a menu or a step. [HIG alerts (up to three buttons); M3; NN/g] [mechanical]

30. **At phone widths, stack actions full-width when labels would wrap, truncate, or crowd (gap < spacing token): one button per row, equal heights.** A button label must never wrap to two lines or ellipsize — if it would, stacking is mandatory, not optional. Inline side-by-side pairs remain fine on phones when both labels are short. [HIG (alerts stack long labels); M3; Baymard (too-small tap areas → mistaps)] [mechanical]

31. **In sheets and full-screen dialogs, actions may live in the top bar (Cancel leading, confirm trailing) — iOS's native sheet pattern — or in a pinned bottom bar; pick per platform contract and keep it consistent app-wide.** Never both, and never a lone floating button mid-content. [HIG sheets (Mar 2026 update); M3 full-screen dialogs (action in top app bar)] [mechanical]

32. **Destructive primaries keep the primary's position but take danger styling, and gain extra separation from the safe action when stacked.** Position communicates "this is the main act," color communicates "it bites"; moving the destructive button to a nonstandard slot to make it "safer" just causes mis-taps on whatever took its place. Never make a destructive action the auto-focused default. [Carbon (danger modal); HIG (destructive never default); ADS; behavioral rules in ux-canon 02] [mechanical]

33. **All buttons in one bar share one height, one baseline, one size token — mixed sizes or a primary conspicuously larger than Cancel is a defect.** Emphasis comes from fill/color (primary filled, secondary quiet), not geometry. [M3 (text buttons in dialogs); Polaris; ux-canon 04] [mechanical]

34. **Action bar padding matches the overlay's content padding on the sides, with the bar's own vertical padding from the spacing scale; in bottom-anchored surfaces the bar additionally clears the home indicator (`env(safe-area-inset-bottom)`).** Buttons kissing the overlay edge, or hiding behind the indicator, are both defects. [M3 specs; HIG safe areas; ux-canon 04 §2.29] [mechanical]

35. **Full-bleed edge-to-edge footer buttons (Carbon's signature) are a system-specific style, not the consensus: in this product's floating dialogs and sheets, buttons are inset within the padded bar.** Adopting Carbon's full-bleed footer inside an otherwise HIG/M3-shaped overlay reads as a foreign component. [Carbon (documents full-bleed); M3/HIG/Polaris/ADS (all inset); house DS] [judgment]

## 6. Sheet-specific anatomy

36. **Show the grabber if and only if the sheet is drag-resizable or drag-dismissible.** The grabber is a functional signal, not a decoration: a grabber on a fixed sheet promises a gesture that doesn't exist; a resizable sheet without one hides the gesture that does. Clarifying clause: a true bottom sheet is draggable by contract (ux-canon 02 §17.168), so this condition is always met for it — a fixed, non-draggable bottom-anchored surface is not a bottom sheet at all; it is a dialog or anchored panel and gets no grabber. [HIG sheets; M3 bottom sheets (drag handle); ux-canon 02 §17.168] [mechanical] *(patched 2026-07-23: seam with ux-canon 02 §17.168 stated)*

37. **Design sheet content for the smallest detent first: everything essential — title, the core content, the primary action — visible at medium height without scrolling; expansion reveals more, never the point.** If the essentials don't fit the medium detent, the sheet starts at large or the content moves to a page. [HIG detents; M3 bottom sheets] [judgment]

38. **Sheet geometry: top corners rounded (the container's radius token), bottom edge flush with the screen, content padded top for the grabber zone (~24px including target) so the first element never collides with it.** The grabber zone is part of the header, not overlaid on content. [HIG; M3 specs] [mechanical]

39. **Sheet headers are sticky: title (and close/actions if header-mounted) remain pinned while sheet content scrolls at full detent.** Same pinning contract as §23, restated for sheets because the drag gesture makes an unpinned header feel doubly broken. [HIG sheets; M3] [mechanical]

40. **Keyboard avoidance is the sheet's job, not the user's: when an input inside a sheet or dialog focuses, the surface rises or its body scrolls so that the focused field AND the primary action remain visible above the keyboard.** Verify against the visual viewport (`visualViewport`), not the layout viewport — the classic failure is a confirm button "present" but under the keyboard. At 16px+ input font so iOS doesn't auto-zoom (ux-canon 04 §1.4). [HIG; M3; VWIG] [mechanical]

41. **Inner scrolling activates only at full expansion; below that, upward drag expands the sheet.** Owned as selection/gesture law by ux-canon 02 §17.168 — the internal-geometry consequence here: the scroll container and the drag surface must be the same element, with the handoff at the top detent, or the sheet produces gesture soup. [ux-canon 02 §17.168; HIG; M3] [mechanical]

42. **On wide viewports a bottom sheet never spans the full width: cap it (~640px), center or side-anchor it, or map it to its paired desktop container per ux-canon 02 §17.171.** A 1280px-wide bottom sheet is a phone component stretched, not an adaptive one. [M3 (bottom sheets on large screens); HIG (iPad sheets are centered cards); ux-canon 02 §17.171] [mechanical]

## 7. Width, inset, and max-height across breakpoints

43. **Centered dialogs at phone widths size as: viewport width minus a fixed side inset (16–24px per side), so ~272–288px content-box at a 320px viewport and ~336–352px at 384px.** The dialog never touches the screen edges (that's a sheet's privilege) and never exceeds viewport minus insets. Every interior element must fit that narrowest content box (§22). [M3 (min 280dp container); HIG; ux-canon 04 §2.25 (fluid, not magic widths)] [mechanical]

44. **Desktop dialogs are sized to content with a hard cap: ~400px for confirms, ~560–640px for content dialogs (M3 caps at 560dp; Polaris ~620px; ADS defaults similar).** Never stretch a dialog to a percentage of a large screen; a confirm dialog spanning 900px reads as an error page. [M3 specs; Polaris; ADS; RUI/ux-canon 04 §2.26] [mechanical]

45. **One padding token set for the overlay interior, constant at phone widths (M3 reference: 24dp all around) — do not decrease padding to buy content room.** Padding shrinking under content pressure is the same defect as type shrinking (§15): the container is wrong, not the padding. [M3 specs; RUI] [mechanical]

46. **Every multi-element row inside the overlay must be wrap-tolerant at the 320px content box: label + field + unit rows either fit with flexible field widths or wrap label-above-field.** The screenshot's clipped "s" unit is this rule failed: fixed-width fields + fixed labels in a row with no wrap plan. Budget the unit label's width as part of the field group. Scope: the stack-when-narrow fallback applies only to rows containing *variable-width* fields; rows of short FIXED fields (min/s, date parts) are designed to fit 320px and never stack — forms canon 03 #18/#23 owns them, and stacking them is the defect, not the fix. [ux-canon 04 §2.25/§2.30; VWIG; forms canon 03 #18/#23] [mechanical] *(patched 2026-07-23: wrap fallback scoped to variable-width rows per 03 #23)*

47. **Max-height interacts with breakpoint: phone dialogs cap lower (~80% of the *visual* viewport, which shrinks when the keyboard is up); desktop dialogs cap around 85% with generous scrim visible.** If content hits the cap on desktop too, no width or height tweak fixes it — escalate (§11). [ADS; M3; HIG] [mechanical]

48. **Popovers size to their content with a max width (~360px) and never scroll internally in either axis; a popover that needs to scroll has outgrown popover-hood.** (Popover *placement* relative to its anchor is layout law owned elsewhere; internal rule only here.) [HIG popovers; M3 menus] [mechanical]

---

## Cross-references (owned by other files)

- **Container selection, modality, stacking, dismissal behavior** — ux-canon 02 §17 (167–171). This file's §11 defines the *inside-out* evidence that §17's selection was wrong; escalation itself is §17's law.
- **Dialog/confirm wording** (title as verb phrase, button labels matching the title verb, no "Are you sure?") — copy canon; VWIG's title-case/verb-noun rules noted there.
- **Focus trap, initial focus, focus return, `aria-modal`, Esc behavior** — accessibility canon (APG dialog pattern); geometry consequences (§24, §40) live here.
- **Entry/exit motion, scrim opacity/fade** — ux-canon 04 §9 (motion) and §5 (elevation/scrim values).
- **Field anatomy inside overlays** (label position, validation, keyboards) — forms canon; this file owns only that fields must fit (§46) and that a confirm shouldn't have them (§12).
- **Touch-target minimums** (44px/48dp) — ux-canon 05; applied here to close buttons (§8) and stacked actions (§30).

## Contested / no-consensus

- **Stacked-button order — RESOLVED BY OWNER (2026-07-23, decision log): APPLE STYLE, system-wide.** When buttons stack full-width, the primary action sits on TOP and Cancel/dismiss sits at the very bottom. Rationale accepted by the owner: the bottom slot is the easiest careless thumb tap, so it should hold the harmless action, not the commit. (iOS stacks default-on-top; Material stacks confirm-on-bottom; the house picks Apple.) Sessions build primary-on-top everywhere; never mix orders. [resolved — owner decision 2026-07-23]
- **X-close AND Cancel together**: Polaris/ADS/Carbon render both in content dialogs; NN/g notes redundant dismissal aids discovery; minimalists (and HIG alerts, which have no X) call it duplication. Consensus exists only that at least one visible dismissal must exist (ux-canon 02 §17.169). [contested]
- **Full-bleed footer buttons** (Carbon) vs. inset buttons (everyone else): documented system divergence, not a resolvable rule — this canon picks inset (§35) as house law. [contested]
- **Primary-on-right universality**: Windows/older-desktop convention placed the affirmative LEFT; macOS/web/mobile place it RIGHT. Right-primary is the modern consensus this file adopts (§28), but literature still argues it. [contested]
- **Centered vs. left title in small confirms**: HIG centers alerts; M3 left-aligns basic dialogs and centers only icon dialogs. §3 resolves it by form (alert-form centers, content-form left), but the boundary case — a two-line confirm with no icon — is genuinely split. [contested]
- **Any input in a confirm dialog**: typed-name confirmation for destructive acts is endorsed (VWIG, GitHub-class precedent) yet violates the "confirmations don't collect data" principle; treated here as the single sanctioned exception (§12), but sources disagree on whether even that belongs in a dialog vs. a page. [contested]
- **Dividers between zones**: M3 says only when the body scrolls (§25); several enterprise systems (Carbon, some ADS modes) draw permanent header/footer dividers. This canon follows M3 (weakest sufficient separator, §17), noting the enterprise counter-practice. [contested]
- **Exact numeric caps** (80% vs 85% max-height, 560 vs 620px max width, 16 vs 24px phone inset): the *existence* of each cap is consensus; the exact numbers vary by system and are house-token decisions, not industry law. Numbers in §§27, 43–47 are the convergent midpoints. [contested]

## Sourcing honesty

- **Apple HIG sheets** was updated 2026-03-24 with revised button-placement guidance (confirmed via Apple's "What's New" page); the updated page itself would not render to text in this session, so §31's description of header-mounted actions reflects the long-standing sheet pattern plus the update's existence, not its verbatim new text. Worth a manual read before hard-coding sheet button placement.
- **M3 dialog spec numbers** (280dp min / 560dp max width, 24dp padding, 16dp headline-body gap, scroll dividers): the m3.material.io specs page is JS-rendered and would not fetch; values are from the trained spec corroborated by secondary M3 documentation surfaced in search. High confidence, but the spec page should be spot-checked if these become ds.css tokens.
- **Baymard**: their overlay research is e-commerce-centric (permission prompts, quick views, checkout dialogs); its application to a fitness confirm dialog (§12, §24, §30) is by analogy, clearly reasonable but not a direct study of this pattern.
- **NN/g** modal/nonmodal and confirmation-dialog articles verified current and unchanged in substance as of this session.
- **VWIG/Geist**: the Geist Modal spec (focus trap, scroll restore, 1–3 sentence body, typed destructive confirmation) and the vercel-labs web-interface-guidelines repo verified current; these are the most prescriptive of all sources and skew toward Vercel's own product voice — treated as strong input, not sole authority.
- **Polaris/Carbon/ADS** modal specs cited from trained knowledge of stable, long-published component pages; these systems change slowly and the cited structure (header/body/footer, sticky footer, danger placement, width defaults) predates 2024 and was consistent across systems then. Exact pixel defaults (Polaris ~620px) are the least-verified numbers in this file.
