# P56-D side-by-side grade: Today shell vs the captured references

Graded line by line against `benchmark-ranking.md` (WHOOP / Oura / MacroFactor /
Duolingo, refs in `references/`). Screenshots of ours: `ours/` (captured by the
live-verification agent on :3600, Pro test account). Verdict vocabulary:
MATCH (indistinguishable from the reference pattern), MATCH+ (exceeds it),
ADAPTED (deliberately different, reason given), MISS (falls short, must fix).

## Surface 1: compact header (reference: MacroFactor #1)

| Reference decision | Ours | Verdict |
|---|---|---|
| Title + uppercase dateline, zero decorative art, ~72-88px | Date eyebrow (text-eyebrow, uppercase tracked) + greeting H1 + tier badge; no silhouette, no stats, no customizer; measured well inside the 72-88px band at 1440 | MATCH |
| No competing controls in the header | One quiet outline "Talk to Chad" action (Coach is the product's differentiator; Oura's Today keeps one action above the fold too) | MATCH |
| First-run exception | The one dominant CTA lives here on first-run and every panel below stays quiet (P1-4) | MATCH+ (references have no designed first-run header) |

## Surface 2: four-domain status strip (reference: WHOOP #1, MacroFactor #2)

| Reference decision | Ours | Verdict |
|---|---|---|
| Equal columns on a near-black card, one metric per cell | Four StatusPanel cells on the ink card ladder; container-query 1/2x2/4 columns | MATCH |
| Color ARC per cell, value beside/inside, arc color = status | ProgressRing per cell (44px), arc color = domain token, flips to emerald `positive` on goal met, `attention` when over target | MATCH |
| Hero number + tiny caps label | text-metric headline + uppercase panel title + muted target context. ADAPTED: WHOOP's 72pt hero needs a full-screen tile; our 104-128px cells use the P2 metric scale so four domains fit one row (MacroFactor's anatomy at WHOOP's composition) | ADAPTED |
| Value framed against target ("bold current over lighter target") | `1,840 of 2,300 kcal` via the ONE formatVsTarget grammar; "of X planned this week" for training | MATCH |
| Target line darkens when hit (cheap reward) | Ring turns emerald + "Goal reached"/"Done" status word (tokenized, owner reward-glow order) | MATCH+ (color + words, still honest) |
| Tap opens deep-dive; no controls inside | Whole cell is a named link (aria-label "Open <destination>"); zero logging controls inside | MATCH |
| No fake zeros; metric absent until captured | Designed empty states per data-state contract ("No meals yet." + hollow ring); sleep older than a day renders DATED, never "last night"; training zero is a truthful zero (registered carve-out) | MATCH+ (contract-enforced) |
| Green=good/red=bad vs Chad's red-as-hero (the teardown's flagged collision) | Resolved by the owner-approved P1 Color Law, not re-invented: emerald = toward-goal/reward, blood = brand + away-from-goal, attention amber = over-target. No red-as-failure anywhere in the strip | ADAPTED (owner-decided s185) |

## Surface 3: Up next (reference: Oura #1)

| Reference decision | Ours | Verdict |
|---|---|---|
| ONE big thing, everything else subordinated | One PlanPanel with one primary CTA + one named secondary; picked by a fixed 4-rule priority | MATCH |
| The WHY carried inline, data-derived, never an unexplained imperative | Reason sentence rendered under the headline, sourced from the deterministic selector (P34-D's rotation verdict verbatim for training) | MATCH |
| Baseline-justified explanation | "?" popover states the exact priority order in member words (inspectability beyond Oura, which never explains its ranking) | MATCH+ |
| Insight card shifts by time-of-day/biometrics | ADAPTED: deterministic day-state rules (trained-today, last-night-logged, meals-logged) instead of opaque time-of-day heuristics; FIX-23 requires same-inputs-same-answer | ADAPTED (required by the task contract) |
| Honest supporting visual | Rotation strip with your position (training), real sleep week with the gap hollow (sleep), the plan's real targets (meal), the real trend sparkline (review); no decorative filler | MATCH+ |

## Surface 4: consistency + streak (reference: Duolingo #1, Hevy #2, GitHub #3)

| Reference decision | Ours | Verdict |
|---|---|---|
| Flame + count always visible | Flame (reduced-motion-safe flicker) + CountUp streak count inside the panel | MATCH |
| 7 day-icons: logged/missed/upcoming distinct | 7-dot strip: filled blood dots, border dots for missed, hollow for upcoming, structural today-ring, per-day date tooltips | MATCH |
| Perfect week collapses icons into ONE bar + halo | Perfect-so-far week connects the dots into a glowing emerald capsule (`--shadow-glow-positive` token) and dots flip emerald; full 7/7 adds the "Perfect week" line | MATCH |
| Consistency = showing up, not perfection | Headline vocabulary "N of 7 · days logged this week" (registered metric, "Logging consistency" term law); "?" states it counts showing up, not targets, distinct from the streak | MATCH |
| GitHub/Tremor-style matrix (domain-aware) | 4 domain rows (nutrition/hydration/sleep/training) sharing the strip's columns, domain-token dots, row-level tooltips + aria summaries. Hand-composed on the token system: zero new dependencies (FIX-41) | MATCH+ (the references have no per-domain breakdown at all) |

## Load-bearing details checklist (section 3 of the teardown)

1. One decision, not a wall: Up next is the one decision; strip is glanceable status. DONE
2. Size = hierarchy: metric scale vs meta scale per the P2 type ramp. DONE
3. Learn-once color language: the s185 Color Law tokens only. DONE
4. Value vs target/baseline framing: formatVsTarget everywhere. DONE
5. Reward = state CHANGE: ring->emerald, dots->capsule glow, target words flip. DONE
6. Consistency defined generously + honestly: any-domain log counts; streak separate. DONE
7. Progressive disclosure: cell tap -> domain page; consistency -> Progress. DONE
8. Honest empty states: designed empties, dated stale, truthful zeros. DONE
9. Up-next carries its reason: inline + "?" explainer. DONE
10. Dark is functional: ink canvas, arcs/dots carry the data color. DONE

## Visual-resource decisions (directive 1a hunt -> what shipped)

- NumberFlow / MagicUI Number Ticker: NOT added; the in-repo CountUp already
  animates values and FIX-41 is 155% over budget, so no dependency of any size
  was justified this session (briefing rule 6). Revisit post-FIX-41 if the
  owner wants rolling digits.
- Tremor Tracker: pattern adopted, component not installed; the matrix is
  composed from the token system (same visual outcome, zero bytes).
- MagicUI shiny text / unicorn.studio: evaluated for the perfect-week moment;
  the tokenized capsule glow + emerald flip IS the celebration at this
  surface's scale. unicorn.studio stays a live candidate for the wave's big
  reward moments (P56-B's PR/milestone surfaces own those); nothing here needs
  a WebGL scene, and the shell is permanent first-load chrome where the
  briefing bans heavy scenes outright.
