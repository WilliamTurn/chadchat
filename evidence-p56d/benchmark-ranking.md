# P56-D Benchmark Teardown — Daily Dashboard Shell

Session P56-D (Today-shell rebuild). READ-ONLY research + reference capture. No product code changed.
Date: 2026-07-13. References live in `./references/` (see MANIFEST.md for source URLs + honesty notes).

The build session will be graded side-by-side against this document. Four surfaces are in scope:
1. Compact dashboard header (~72-88px, date/greeting/tier, no large decorative art)
2. Four-domain daily status strip (Nutrition / Hydration / Sleep / Training)
3. Deterministic "Up next" module (one prioritized action + visible WHY, primary + secondary CTA)
4. Seven-day logging-consistency + streak module (streak count + 7-day strip; consistency ≠ completion)

---

## 1. RANKED — best daily-dashboard shells (overall)

**#1 — WHOOP (Home / Overview).** The reference standard for a dark, glanceable, single-decision
daily shell. Three core scores rendered as large color-arc rings on near-black; ~72pt hero number
for arm's-length reading; a strict 3-color semantic vocabulary (green=good, red=risk/strain,
yellow=middle) reused on every screen so the user learns the language once. Progressive disclosure
in three tiers (glanceable score → trend → deep-dive graph). Answers ONE question — "how should I
train today?" — and subordinates everything else to it. This is the closest existing app to Chad's
dark blood-red-on-ink brand and the primary model to beat. (refs 01, 02)

**#2 — Oura (new Today tab, 2025 redesign).** Best-in-class at the "Up next / one big thing" problem.
The Today tab is explicitly built "like the Top Stories page of a news app" — it surfaces the single
most relevant insight for right now, above the three score shortcuts (Sleep/Readiness/Activity).
Insights are time-of-day and biometric-aware, and every metric is framed against a personalized
baseline ("what's normal for you") rather than a generic target. This is the model for our
deterministic Up-Next WHY. (ref 03)

**#3 — MacroFactor (Dashboard).** Best-in-class compact header + status-strip structure and the
strongest nutrition-domain treatment. Tight header (title "Dashboard" + date line "THURSDAY,
JANUARY 4", no decorative art — exactly the ~72-88px compact header we want), then swipeable top
widgets that pair a bold current value over a lighter target value, with fire/P/F/C iconography and
a target line that DARKENS when the threshold is reached. Clean value-vs-target framing is the thing
to copy. (refs 04, 05)

**#4 — Duolingo (streak system).** The definitive reference for the streak/consistency surface.
Persistent flame + count as an always-visible urgency signal; a 7-day row of day icons (checkmarks
for completed, blue snowflakes for freeze-saved days); and the key move — a **Perfect Streak collapses
the seven individual day icons into one continuous bar** and wraps the flame in a halo. This is the
exact reward-escalation grammar our 7-day strip should borrow. (cited: Duolingo eng blog, deconstructoroffun)

**#5 — Gentler Streak.** Best at making a daily shell feel calm and rewarding without chart-clutter:
"all widgets in view all the time, no horizontal scroll", a single "Today's Recommendation" under the
Activity Path (their Up-Next), big bold numbers, and iOS-26 Liquid Glass depth on cards. Soft palette
is wrong for Chad, but the layout discipline (everything glanceable, one recommendation) is right. (ref 12)

**#6 — Hevy.** The cleanest answer to consistency-vs-completion in a TRAINING context: the streak is
measured in **consecutive weeks with ≥1 session**, not days — so a rest day never breaks it. Calendar
uses filled day-circles. This weeks-based definition is the correct mental model for the Training cell
and arguably for our whole consistency module (log-consistency, not perfect-completion).

**#7 — Rise.** Reference for a predictive, actionable "next thing to do now" framed on a vertical
day timeline with a score+grade at top; nudges 16 habits "at the right time". Good model for
justifying the Up-Next with time-relevance. (ref 11, partial capture)

### Per-surface #1 / #2 / #3

| Surface | #1 | #2 | #3 |
|---|---|---|---|
| Compact header | MacroFactor (title + dateline, zero art) | Oura Today (date + one-line insight) | WHOOP (minimal, score-first) |
| Four-domain status strip | WHOOP (color-arc rings, semantic color) | MacroFactor (value-over-target + darkening target line) | Oura Vitals (baseline-anchored quick-glance) |
| Up next (prioritized action + WHY) | Oura ("one big thing", baseline-justified) | Rise (time-relevant, predictive) | Gentler Streak (single Today's Recommendation) |
| Consistency / streak | Duolingo (flame + 7-icon row → collapses to bar) | Hevy (weeks-based streak, consistency≠completion) | GitHub / Tremor Tracker (color-block matrix) |

---

## 2. MEASURABLE spec extraction — top 3

### A. WHOOP — status strip + dark shell (PRIMARY MODEL)
- **Layout:** three equal columns across the top of a near-black card; one metric per column.
- **Visual per cell:** a circular **progress ring / arc** (not a bar), value centered inside. Sleep and
  Recovery are % arcs; Strain is a 0-21 arc. The ring fill length encodes magnitude; the ring COLOR
  encodes status.
- **Type hierarchy:** hero number ≈ **72pt** (explicitly sized for arm's-length glance), ALL-CAPS
  small label beneath (~11-12pt, tracked). Supporting text stays small and secondary — deliberate
  size differentiation IS the hierarchy.
- **Color:** 3-token semantic system only — green (good/recovered), red (strain/low/risk), yellow
  (intermediate). Repeated identically on every screen. Colors "pop against black"; dark canvas is
  functional (5:30am eye-strain), not decorative.
- **Targets framing:** WHOOP frames against a recovery/strain scale, not a hard goal number — the arc
  position is the "how am I doing" signal.
- **Tap behavior:** each score taps into a dedicated deep-dive page (tier 2/3 of progressive disclosure).
- **Empty state:** score simply absent until data captured; no fake zeros.

### B. Oura — Up-Next + header (PRIMARY MODEL for the WHY)
- **Header/Today:** curated "daily briefing" — surfaces ONE big thing (top insight) for right now,
  with Sleep/Readiness/Activity as compact score shortcuts above it.
- **Up-Next presentation:** a single highlighted insight card that shifts by time-of-day and by what
  changed in the user's biometrics. The justification is a **baseline comparison** ("this is unusual
  for you" / "what's normal for you and when it starts to shift") — the WHY is data-derived, not generic.
- **Discoveries / correlation:** tagged-habit correlations ("X correlates with better Y") — a model
  for a WHY sentence that cites the driver.
- **Color-signal:** color signals body state per biometric; anchored to personalized baseline ranges.

### C. MacroFactor — compact header + value/target status cells (PRIMARY MODEL for header + strip)
- **Header:** small title ("Dashboard") + uppercase dateline ("THURSDAY, JANUARY 4"), NO decorative
  art — the exact ~72-88px compact-header target.
- **Status cell anatomy:** **bold current value on top, lighter target value beneath** (e.g. consumed
  kcal over target kcal); domain icon (fire=energy, P/F/C=macros). This two-line value-over-target is
  the cleanest existing pattern for "current vs target" and directly maps to our Nutrition/Hydration/
  Sleep/Training cells.
- **Reward micro-detail:** the **target indicator line DARKENS when the threshold is reached** — a
  tiny, cheap "you hit it" reward the build should replicate (tokenized glow in Chad's case).
- **7-day cue:** MacroFactor uses small weekly **bar graphs with the current day highlighted / boxed**
  — a good model for the "tiny 7-day cue" inside each status cell.
- **Modes:** "Consumed / Remaining" toggle reframes the same number two ways.
- **Empty state:** widgets can be turned off entirely ("minimalist"); no blank chart shells.

### D. Duolingo — consistency/streak (PRIMARY MODEL for surface 4)
- **Streak count:** flame icon + integer, persistent and always visible (urgency anchor).
- **7-day strip:** a row of 7 day-icons — **checkmark = logged**, **snowflake (blue) = freeze-saved**,
  empty = missed.
- **Reward escalation:** a Perfect week (all 7) **collapses the seven separate icons into ONE continuous
  bar** and adds a halo around the flame. This "individual dots → unified bar on perfection" is the
  single most transferable reward mechanic for our strip.
- **Milestone animation:** dedicated celebration moments at milestone counts (see their eng blog).
- **Consistency≠completion:** streak = "≥1 lesson per day", i.e. it rewards SHOWING UP, not perfection.

---

## 3. What the best do that average apps don't (load-bearing details)

1. **One decision, not a wall of data.** WHOOP/Oura pick a single question ("train today?" / "one big
   thing") and subordinate the rest. Average apps dump every metric at equal weight.
2. **Size = hierarchy.** A ~72pt hero number with tiny caps labels. Average apps use uniform mid-size
   type, so nothing is glanceable.
3. **A tiny, learn-once semantic color language** (3 tokens, reused everywhere) instead of a new
   rainbow per screen.
4. **Value framed against a personal baseline / target, not an absolute.** "Unusual for you" and
   "target line darkens when hit" beat a naked number.
5. **The reward is a state CHANGE, not a static badge.** Target line darkening (MacroFactor), 7 icons
   collapsing into one bar (Duolingo), ring completing — motion/transformation on achievement.
6. **Consistency is defined honestly and generously.** Weeks-with-a-session (Hevy) or day-with-≥1-log
   (Duolingo) — showing up, distinct from perfect completion. Freeze/rest states are first-class, not
   failures.
7. **Progressive disclosure.** Glance → trend → deep-dive as separate tiers; the shell never tries to
   show the deep data inline. Tap opens a detail page (matches our "no logging controls inside the strip").
8. **Empty states are honest.** No fake zeros or skeleton charts pretending to be data; a metric is
   simply absent until captured, or the widget is removable.
9. **The Up-Next carries its reason inline.** Oura/Rise show WHY now (time-of-day, what changed) beside
   the action — the action is never an unexplained imperative.
10. **Dark is functional, not a theme toggle.** WHOOP's black canvas is chosen for 5:30am glance
    comfort and to make color data pop — exactly Chad's situation.

---

## 4. Fit to Chad's dark, blood-red-on-ink brand

**Fits directly:**
- WHOOP's entire dark-canvas + high-contrast-color-arc model. Chad's ink background IS WHOOP's black
  canvas; blood-red is already one of WHOOP's three semantic tokens (their "strain/risk" red).
- MacroFactor's compact dateline header and value-over-target cell anatomy (brand-neutral, drops
  straight onto ink).
- Duolingo's flame→bar collapse and 7-icon strip — flame/ember reads perfectly in a red-on-ink brand
  and matches the "streak strips are habit rewards, never removed" law.
- Ring/arc status visuals: a red-progressing arc on ink is on-brand and reads as intensity.

**Needs adaptation / does NOT fit as-is:**
- **Green=good / red=bad semantics conflict with a red-forward brand.** WHOOP uses red for RISK; Chad
  uses red as the HERO/accent. The build must resolve this: either (a) reserve red strictly for Chad's
  brand accent and use a separate token for "bad" (amber/desaturated), or (b) use emerald as the sole
  "reward/hit-target" glow (per the reward-glow memory) and red only as identity, never as failure.
  Flag this to the owner — it's a real semantic collision, not a detail.
- Gentler Streak / Oura **soft pastel + Liquid-Glass translucency** — wrong mood for Chad; take their
  LAYOUT discipline (everything glanceable, one recommendation) but not their palette or glassiness.
- Oura/Calm "calming, gentle" tone — opposite of Chad's edge; keep the structure, not the voice.
- Rainbow multi-hue macro coding (MacroFactor's P/F/C colors) — collapse to Chad's restrained token set.

---

## 5. VISUAL-RESOURCE SHORTLIST (do NOT install; feeds owner visual directive)

| Component | Registry / source | Use for | Tailwind v4 | Notes |
|---|---|---|---|---|
| **NumberFlow** (`@number-flow/react`) | https://number-flow.barvian.me/ · github.com/barvian/number-flow | Animated status VALUES (kcal, oz, hours, streak count) counting/rolling on update | Yes (v4-friendly; custom `matchVariant('part',…)` to style ::part) | MIT, ~7kb, dependency-free, respects prefers-reduced-motion + screen readers. Best-in-class for the "value changes = motion reward" detail. Top pick for status numbers. |
| **MagicUI Number Ticker** | https://magicui.design/docs/components/number-ticker | Count-up on status values / streak reveal | Yes (shadcn-style registry, motion-based) | Simpler than NumberFlow; good if we want count-up-on-mount rather than live rolling. |
| **MagicUI Animated Shiny Text** | https://magicui.design/docs/components/animated-shiny-text | Reward moment on streak/PR ("Perfect week") shimmer | Yes | Use SPARINGLY — shimmer on a milestone only, per visual-decision-procedure (never forced). |
| **MagicUI Dot Pattern** | https://magicui.design/docs/components/dot-pattern | Subtle ink-background texture behind header/cards | Yes | Low-key depth on ink without decorative art in the header. |
| **Tremor Tracker** | https://www.tremor.so/docs/visualizations/tracker | The **7-day consistency matrix / strip** (colored day-blocks, per-day tooltip, GitHub-style) | Yes (Vercel/Tremor confirmed v4) | Closest off-the-shelf match to surface 4's 7-day strip and a GitHub-contribution matrix. Green/red/yellow tokens are swappable to Chad's palette. Strong candidate. |
| **Tremor Progress Bar** | https://www.tremor.so/docs/visualizations/progress-bar | Linear value-vs-target inside status cells | Yes | success/warning/error variants map to status words; `value`/`max`/`label`. |
| **Aceternity "Stats with Number Ticker"** | https://ui.aceternity.com/blocks/stats-sections/stats-with-number-ticker | Stat-card row scaffold with count-up (viewport-triggered) | Yes (Tailwind + Framer Motion) | Block, not primitive; good structural reference for the status strip layout. |
| **Aceternity "Stats with Grid Background"** | https://ui.aceternity.com/blocks/stats-sections/stats-with-grid-background | Header/stat backdrop (masked SVG grid, faded edges) | Yes | On-ink grid texture; use restrained. |
| **Origin UI stat cards** | https://originui.com (stats/metric components) | Status-cell scaffolds, admin-grade primitives | Yes (Tailwind v4 + shadcn base) | Solid neutral stat-card primitives; least flashy, most composable. |
| **shadcn Chart / Radix Progress (base)** | shadcn-ui registry | Arc/ring + linear progress base under any of the above | Yes | The v4-native floor; wrap with NumberFlow for value motion. |

**Recommended stack for the four surfaces (build session's call, not prescriptive):**
- Header: shadcn + Dot Pattern (optional) — no animated number.
- Status strip cells: Radix/shadcn ring or Tremor Progress Bar + **NumberFlow** value + tiny sparkline/bar 7-day cue.
- Up-Next: plain shadcn card; the differentiator is the WHY sentence, not a widget.
- Consistency/streak: **Tremor Tracker** for the 7-day strip + **NumberFlow** streak count + Animated
  Shiny Text ONLY on a perfect-week milestone (Duolingo collapse-to-bar analog).

All above are copy-paste / shadcn-registry components, Tailwind-v4 compatible, MIT/OSS. Nothing installed.

---

## Sources
- MacroFactor: help.macrofactorapp.com/en/articles/225, /22 · macrofactor.com/macrofactor
- WHOOP: whoop.com/us/en/thelocker/the-all-new-whoop-home-screen · /your-key-whoop-metrics-all-in-one-place · 925studios.co/blog/whoop-design-breakdown
- Oura: ouraring.com/blog/new-oura-app-experience · /new-app-design
- Gentler Streak: gentler.app · pixso.net/articles/gentler · developer.apple.com/news/?id=3m0ht22s
- Duolingo: blog.duolingo.com/streak-milestone-design-animation · duolingo.deconstructoroffun.com/mechanics/streaks
- Hevy: hevyapp.com/features/gym-consistency · /features/home-screen-widgets
- Rise: risescience.com · help.risescience.com/hc/en-us/articles/6654243671191
- Components: number-flow.barvian.me · magicui.design/docs/components/{number-ticker,animated-shiny-text,dot-pattern} · tremor.so/docs/visualizations/{tracker,progress-bar} · ui.aceternity.com/blocks/stats-sections · originui.com
