# Information density and hierarchy principles

Part of the Phase 1 contract layer (DSH-66). Governs how much lives on a view and what wins attention. This is what makes Apple Health read calm while showing a dozen domains, and it is the primary input to the Phase 6 Today rebuild.

## 1. The four-depth ladder (one home per fact)

Every piece of information belongs at exactly one primary depth (doc 12):

| Depth | Job | Contains |
|---|---|---|
| Today | What matters right now, what to do next | Statuses, quick logging, plan slices, selected highlights |
| Progress | Is the overall effort working | Cross-domain outcomes, trends, milestones, reports |
| Domain detail | What is happening in this one area | Full charts, recent history, targets, methods |
| Complete history | What happened on a specific date | Filtered, paginated records; corrections; destructive actions |

The same fact may echo at a shallower depth ONLY if the shallower job differs (Today shows "1,840 of 2,300 kcal"; Nutrition detail shows the diary behind it). Duplication with the same job is a violation.

## 2. Prominence rules (what reads first)

- Each panel has ONE headline: the number or statement it exists for, set at metric-value size. Everything else on the panel is context and sits at body/secondary size.
- Each viewport-height of a dashboard has at most **one dominant element**. If everything is loud, nothing is.
- Reading order at every width is: status of the day, then the next action, then logging, then plans, then results/review. A member answers "am I on track today?" without scrolling on desktop, within one screen-height on phone.
- The eyebrow / value / context three-tier pattern (already on the Today greeting and stat tiles) is the standard anatomy for every KPI.

## 3. Action budget

- Max **1 primary action per panel** (panel contract).
- Max **3 primary actions visible per viewport-height**; everything else is a quiet link or lives deeper.
- First-run: the page has exactly ONE dominant CTA (P1-4); every other panel stays quiet.
- Settings, export, archive, delete: never on a dashboard panel. Overflow menu or detail page (depth 3 to 4) only.
- Ask Chad keeps its single fixed home (footer-left slot, R2-7). One per panel, never a second placement.

## 4. Density ceilings

- A dashboard section (SectionBand) holds 2 to 4 panels. Five or more means a panel belongs deeper or two should merge.
- A panel body carries at most ~4 data points (headline + 3 supporting). More belongs to its detail page.
- History on domain pages defaults to the **7 to 14 most recent rows** with a named "Complete history" path; complete history is paginated/filtered (P7). Record walls are a violation.
- Row controls appear on hover/focus/selection or in an overflow, never 50 permanent Delete buttons.

## 5. Collapse and adapt (calm under sparse data)

- Sparse or empty panels SHRINK to their designed compact state (first-run.md); they never hold populated-size frames with blank space.
- Equal-height rows are an outcome of similar content, never a goal. Size follows information (doc 12 sizing rationale).
- A panel whose domain is irrelevant to the member's goal may compact or step back (Body check-in appears when due, not permanently).

## 6. Section rhythm

- Sections are named bands with a one-sentence plain description (SectionBand grammar, already live).
- Band order tells the day's story: Log -> Plans -> Results. New sections must argue their way into this order, not append.
- 32 to 40px between bands, consistent; a band's internal card gap is 16px so bands read as units.

## 7. Checkable rubric

- [ ] One headline per panel; supporting text at least one size-step down.
- [ ] <= 1 primary action per panel; <= 3 per viewport-height; 0 destructive actions on dashboards.
- [ ] First-run shows exactly one dominant CTA.
- [ ] No section with > 4 panels; no panel with > 4 data points.
- [ ] Histories bounded at 7 to 14 rows with a named complete-history path.
- [ ] Sparse/empty panels render their compact designed state (measure: an empty panel's height <= its role's minimum + 20%).
- [ ] A first-time member can answer "am I on track today, and what should I do next?" from the first screen-height. Test it by looking, at 390px and desktop.
