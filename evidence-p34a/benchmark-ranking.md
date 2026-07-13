# P34-A benchmark teardown and side-by-side grade (rule 8 / FIX-40)

Session: P34-A (FIX-20 grouped desktop nav, FIX-21 persistent mobile bottom nav). Written 2026-07-13.

## 1. Mobile bottom navigation (FIX-21)

### Capture attempts (references/, node Playwright, iPhone 12 emulation 390w/dsf3/touch)

| Site | Result |
|---|---|
| m.youtube.com | FULL teardown captured (default, scrolled, input-focused, 320px, computed-style probe `youtube-probe.json`) |
| x.com (+ /explore) | Login wall to logged-out mobile web; no bottom bar renders. Captured the wall for the record |
| instagram.com (+ /instagram/ profile) | App-install modal over the profile grid; top bar only, no bottom bar logged out |
| reddit.com | No logged-out mobile-web tab bar (top nav + a Google one-tap prompt). Assumption in the packet did not hold; recorded honestly |

MacroFactor, Hevy, and Whoop (named in the briefing) are native apps with no capturable mobile web; their pattern (4 to 5 icon+label tabs, a prominent log action in the bar) is applied from product knowledge, not from captures, and is consistent with everything measurable below.

### Ranking (best mobile-web bottom navs we can evidence)

1. **m.youtube.com**, the only one of the named references that ships a measurable logged-out mobile-web tab bar, and it is the canonical implementation: `role=tablist`, position fixed bottom 0, **56px** bar, frosted glass (rgba(255,255,255,0.9) + backdrop-blur 24px), 1px top border, icon+label tabs at **11px**, targets 130x56 (>= 44), active tab = `aria-selected` + filled glyph. Survives 320px with labels intact.
2. **x.com / Instagram mobile web** (login-walled; ranked from documented product behavior): icon-first persistent bars, 5 slots, bar suppressed while composing/typing.
3. **P2 desktop references** (Linear, Stripe) rank for grouped nav below, not for the phone bar.

### Side-by-side grade: our bar (components/nav/bottom-nav.tsx) vs the best reference

Our measurements from `evidence-p34a/ours/smoke-findings.md` (node Playwright, Opus agent, 63/63 assertions PASS).

| Decision | m.youtube.com (measured) | Ours (measured) | Grade |
|---|---|---|---|
| Bar anatomy | fixed bottom, 56px, 1px top border, frosted (0.9 alpha + blur) | fixed bottom, h-14 (56px) + 1px border, bg-background/95 + backdrop-blur, `pb-safe-edge` safe-area | MATCH |
| Tabs | icon + 11px label, 3 to 4 tabs | icon + 13px (`text-meta`) label, 5 tabs per DEC-01 | MATCH+ (larger labels clear our 12px a11y floor; YouTube's 11px would fail FIX-19) |
| Touch targets | 130x56 | 63 to 79 x ~59.5 (all five, at 320/360/390) | MATCH (>= 44px everywhere) |
| Active state | aria-selected + filled glyph | aria-current="page" + brand-red icon (`text-blood-text`, AA both themes) + bold label | MATCH |
| Primary action in bar | (YouTube signed-in: center "+" circle) | Log tab: brand-red filled plus-circle, 2nd slot per DEC-01's exact order | MATCH |
| Keyboard behavior | bar stays visible on input focus, but YouTube runs under the browser default `resizes-visual`, where the OS keyboard simply covers the bar | bar hides while an editable has focus and returns on blur | MATCH by outcome. Our app mandates `interactive-widget=resizes-content` (the chat composer must ride above the keys, MOB-3), under which a fixed bar would ride UP onto the focused input, the exact behavior the packet bans. Hiding is the equivalent-outcome adaptation (also x.com/Instagram behavior when composing); in both worlds the bar is never between the member and the keyboard |
| 320px | fits, labels intact | fits, labels intact, zero horizontal overflow | MATCH |
| Overlay interaction | n/a (no in-bar sheets) | Log/More open the P2 vaul bottom sheet (z-50 over the z-40 bar, scrim, no autofocus) | MATCH+ (composes the system overlay platform, rule 9) |

Pass bar check: indistinguishable from or better than the best capturable reference on every graded line.

## 2. Grouped desktop navigation (FIX-20)

### References (reusing the P2-A capture set, `audits/dashboard-overhaul-2026-07-11/evidence-p2a/references/`)

Ranking for grouped left-nav: **Stripe Dashboard/Docs** (captioned groups, one accent for the active item) > **Linear** (uncaptioned tight groups, strong selected state) > **Claude.ai** (minimal flat rail). Captures: stripe-payments/billing/docs-1440, linear-home/method-1440, claude-landing-1440.

### Side-by-side grade

| Decision | Reference practice | Ours | Grade |
|---|---|---|---|
| Grouping | Stripe: captioned functional groups | Primary (uncaptioned) / Track / Plan / Review / uncaptioned utility block, driven by `routes.ts` `proposedNavGroup` | MATCH |
| Group captions | Stripe: 11 to 12px caps, muted | `SidebarGroupLabel` + `text-eyebrow` (12px caps, muted) | MATCH |
| Trailing utility block | Linear: uncaptioned trailing group | uncaptioned + hairline top rule (avoids the "More" caption colliding with the More tab) | MATCH |
| Selected state | both: filled row + accent | `isActive` filled row + brand-red icon; subroutes resolve to their section (`isRouteActive`: /workouts/history highlights Workouts) | MATCH |
| One source of truth | n/a | `lib/nav-links.ts` is now a pure consumer of the registry (path/name/group from `ROUTES`); drift-tested | MATCH+ |
| Legacy URLs | pro apps alias old/guessed paths | 14 temporary (307) alias redirects in next.config.ts (/water, /weight, /settings, /chat, /quit-test, ...) | MATCH |

## 3. Evidence index

- References: `evidence-p34a/references/` (17 files + MANIFEST.md), P2-A set reused for desktop.
- Ours: `evidence-p34a/ours/` (14 screenshots + smoke-findings.md, 63/63 PASS).
- Verification + audit evidence appended by the final Opus runs (this folder).
