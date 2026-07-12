# Visual excellence standard

Part of the Phase 1 contract layer (DSH-66). This is the checkable rubric a build session designs against and the visual auditor grades against. Every item is phrased so a reviewer can answer yes/no with a screenshot or a measurement, not a feeling.

Benchmarks: this standard operationalizes the composition habits of the best apps in and out of fitness. Fitness tier: Hevy, Strong, MacroFactor, MyFitnessPal, Apple Health/Fitness, Oura, Whoop. General pro tier: Claude.ai, ChatGPT, Linear, Stripe Dashboard, Notion, GitHub. When a rule needs interpreting, go look at what one of these literally does and copy it (pro-app parity law, s180).

## 1. Page frame and content width

The two failure modes are both violations (owner-confirmed):

- **The skinny strip**: a narrow centered column floating in a wide viewport.
- **The pixel-edge sprawl**: content stretched to the viewport edge with no gutters, sparse content stranded at far edges.

The pro pattern (Claude.ai, Linear, Stripe, Hevy web): a full-width app shell (nav, header) with a **bounded content region inside it**, generous gutters, and multi-column composition that USES the width.

Checkable rules:

- [ ] The app shell (sidebar/header) spans the full viewport.
- [ ] Dashboard content region max-width is **1280 to 1536px**, horizontally centered beyond that, with **24 to 32px gutters** at desktop, 16px at phone. The owner-approved live reference is the Today page's 1500px frame (LAY-1); the band as a formal law is proposed amendment 1 in the design-rationale doc and stays a recommendation until the owner approves it. What is NOT pending: neither extreme ships (a narrow centered strip violates the s177 law; pixel-edge sprawl violates this standard).
- [ ] Reading surfaces (the weekly report body) bound the TEXT column to **680 to 800px**, with summary cards composed above it at full content width. The page is still a full page; only the prose column is bounded. No helper right-rails (banned, s178).
- [ ] Desktop dashboards compose **multi-column** (the xl 3-column grid, side-by-sides, 2/3 + 1/3 splits). A single-column stack at >= 1280px is a violation.
- [ ] At no width does content touch the viewport edge (min 16px padding).
- [ ] No dead bands: after removing or collapsing an element, its former container collapses too.

## 2. Breakpoints change composition, not just column count

- [ ] 1440+: full grid, expanded nav.
- [ ] 1024 to 1439: same organization, tighter gutters or collapsed nav rail.
- [ ] 768 to 1023: deliberate tablet composition (2-column max), touch targets.
- [ ] 390 to 767: phone composition designed as its own layout, not a squeezed desktop. Order re-prioritized for the member's morning glance.
- [ ] 320 to 389: compact variant verified (status rows go full-width, grids drop to 1 to 2 columns).
- [ ] Screenshots exist at 1440, 1024, 768, 390, and 320 for any changed surface, both themes.

## 3. Spacing and rhythm

- [ ] Spacing uses the scale: 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40px. No arbitrary 6/10/14px one-offs without an optical-alignment reason stated in the PR.
- [ ] Card padding: 20 to 24px. Card gap: 16px desktop, 12px phone.
- [ ] Section gap (between SectionBands): 32 to 40px, consistent page-wide.
- [ ] Related items sit closer than unrelated items (a value sits nearer its label than the next value). If everything is 16px apart, hierarchy has failed.

## 4. Type

- [ ] Page title 30 to 32px desktop / 26 to 28px phone. Section titles 18 to 24px. Card titles 14 to 18px.
- [ ] Metric values 24 to 32px, `tabular-nums`.
- [ ] Body text >= 15px; secondary text >= 14px. **Nothing member-readable below 12px**, and 12 to 13px only for short metadata (chart ticks, eyebrows).
- [ ] Uppercase + tracking reserved for short eyebrows/labels, never sentences.
- [ ] Long titles clamp with ellipsis and link to detail; they never shrink below 14px to fit.

## 5. Color and theme

- [ ] The Color Law (`lib/chart/palette.ts`) holds: red = brand + genuine alerts + the training domain; emerald = toward/at goal; other series draw in their domain accent. Domain color never substitutes for state color.
- [ ] Every text/control combination passes **WCAG 2.2 AA in BOTH themes** (4.5:1 body, 3:1 large text/UI). Known offender to fix in P2: BLOOD `#a4161a` as TEXT on dark (~2.5:1, DSH-61). Rule: brand red for fills and lines, a brighter accessible red token for text and KPIs.
- [ ] Dark theme keeps >= 3 distinguishable surface levels (page, card, inset). Light theme keeps visible borders and muted text at AA.
- [ ] State is never encoded by color alone (icon, label, or position accompanies it).

## 6. Charts (the shared visual language)

- [ ] Every chart declares: metric name, headline value, unit, time range, target/goal line when one exists, and a coverage caption when logging is incomplete ("4 of 7 days logged").
- [ ] **Time axes span the selected WINDOW, never just the data extent.** Two logged days in a 30-day window sit at their true dates inside a full 30-day axis. This is the structural fix for sparse-data stretching (DSH-60): sparse data READS sparse, it does not stretch to the frame edges.
- [ ] Unlogged days render as gaps or hollow slots, never zero-height bars (`fillDailyGaps` keeps the date axis honest).
- [ ] Estimated series are labeled (Trend weight, est. 1RM); raw vs derived series are visually distinct and legended when both are drawn.
- [ ] Chart tick text >= 11px; every chart has a text summary for screen readers.
- [ ] No chart is the only carrier of a value a member needs (the headline states it).

## 7. Touch and pointer targets

- [ ] Touch targets >= 44x44px (WCAG 2.2). Desktop pointer controls >= 32px visual, >= 40px hit area for icon buttons.
- [ ] Adjacent destructive/primary controls separated by >= 8px.
- [ ] Icon-only controls have accessible names and tooltips.

## 8. How the auditor grades a surface

For each changed surface, the visual auditor (Opus, per owner law) produces:

1. Screenshots at the five widths x both themes.
2. A pass/fail per rubric line above, with the measured number where the line names one (content width, gutter, target size, contrast ratio, text size).
3. For each fail: severity, the benchmark app that shows the correct pattern, and the concrete fix.

A surface ships only when every line passes or the owner has explicitly waived the line. "Looks fine" is not a grade.
