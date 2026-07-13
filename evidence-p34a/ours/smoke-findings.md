# P34-A smoke findings

Generated 2026-07-13T13:53:44.876Z against http://localhost:3600 (shared prod DB, read-only).

**Totals: 63 PASS / 0 FAIL / 0 NOTE**

| # | Assertion | Result | Detail |
|---|---|---|---|
| 1 | login | PASS | after login, /today resolved to /today |
| 2 | today-390-dark/bar-visible | PASS | nav[aria-label=Primary] visible=true |
| 3 | today-390-dark/bar-height | PASS | inner row height=60px (want ~56, tolerance 52-64) |
| 4 | today-390-dark/tab-count | PASS | count=5 |
| 5 | today-390-dark/tab-labels | PASS | labels=["Today","Log","Progress","Coach","More"] |
| 6 | today-390-dark/today-active | PASS | aria-current=page on ["Today"] |
| 7 | today-390-dark/tap-targets | PASS | sizes=Today:77.2x59.5, Log:79.2x59.5, Progress:77.2x59.5, Coach:77.2x59.5, More:79.2x59.5 |
| 8 | today-390-dark/no-h-overflow | PASS | scrollW=390 clientW=390 |
| 9 | today-390-light/bar-visible | PASS | nav[aria-label=Primary] visible=true |
| 10 | today-390-light/bar-height | PASS | inner row height=60px (want ~56, tolerance 52-64) |
| 11 | today-390-light/tab-count | PASS | count=5 |
| 12 | today-390-light/tab-labels | PASS | labels=["Today","Log","Progress","Coach","More"] |
| 13 | today-390-light/today-active | PASS | aria-current=page on ["Today"] |
| 14 | today-390-light/tap-targets | PASS | sizes=Today:77.2x59.5, Log:79.2x59.5, Progress:77.2x59.5, Coach:77.2x59.5, More:79.2x59.5 |
| 15 | today-390-light/no-h-overflow | PASS | scrollW=390 clientW=390 |
| 16 | today-360-dark/bar-visible | PASS | nav[aria-label=Primary] visible=true |
| 17 | today-360-dark/bar-height | PASS | inner row height=60px (want ~56, tolerance 52-64) |
| 18 | today-360-dark/tab-count | PASS | count=5 |
| 19 | today-360-dark/tab-labels | PASS | labels=["Today","Log","Progress","Coach","More"] |
| 20 | today-360-dark/today-active | PASS | aria-current=page on ["Today"] |
| 21 | today-360-dark/tap-targets | PASS | sizes=Today:71.2x59.5, Log:73.2x59.5, Progress:71.2x59.5, Coach:71.2x59.5, More:73.2x59.5 |
| 22 | today-360-dark/no-h-overflow | PASS | scrollW=360 clientW=360 |
| 23 | today-320-dark/bar-visible | PASS | nav[aria-label=Primary] visible=true |
| 24 | today-320-dark/bar-height | PASS | inner row height=60px (want ~56, tolerance 52-64) |
| 25 | today-320-dark/tab-count | PASS | count=5 |
| 26 | today-320-dark/tab-labels | PASS | labels=["Today","Log","Progress","Coach","More"] |
| 27 | today-320-dark/today-active | PASS | aria-current=page on ["Today"] |
| 28 | today-320-dark/tap-targets | PASS | sizes=Today:63.2x59.5, Log:65.2x59.5, Progress:63.2x59.5, Coach:63.2x59.5, More:65.2x59.5 |
| 29 | today-320-dark/no-h-overflow | PASS | scrollW=320 clientW=320 |
| 30 | progress-390/active | PASS | aria-current=page on ["Progress"] |
| 31 | chat-390/bar-visible | PASS | visible=true |
| 32 | chat-390/coach-active | PASS | aria-current=page on ["Coach"] |
| 33 | chat-390/composer-above-bar | PASS | composerBottom=774 barTop=784 |
| 34 | log-drawer-dark/open | PASS | title visible=true |
| 35 | log-drawer-dark/rows | PASS | rows=Log a meal(348x47), Log water(348x47), Log sleep(348x47), Log a weigh-in(348x47), Log a workout(348x47) |
| 36 | log-drawer-dark/tap-targets | PASS | min heights ok, bad=none |
| 37 | log-drawer-dark/no-autofocus | PASS | activeElement=div |
| 38 | log-drawer-light/open | PASS | title visible=true |
| 39 | log-drawer-light/rows | PASS | rows=Log a meal(348x47), Log water(348x47), Log sleep(348x47), Log a weigh-in(348x47), Log a workout(348x47) |
| 40 | log-drawer-light/tap-targets | PASS | min heights ok, bad=none |
| 41 | log-drawer-light/no-autofocus | PASS | activeElement=div |
| 42 | more-drawer/headings | PASS | Track:true, Plan:true, Review:true, More:true |
| 43 | more-drawer/hydration-nav | PASS | url=/hydration |
| 44 | more-drawer/closes | PASS | navigated=true, drawer still visible=false |
| 45 | kbd-chat/vk-open | PASS | html[data-vk-open]=true |
| 46 | kbd-chat/bar-hidden | PASS | barTop=844 vh=844 translateClass=true transform=none |
| 47 | kbd-chat/vk-removed-on-blur | PASS | data-vk-open removed=true |
| 48 | kbd-nutrition/vk-open | PASS | html[data-vk-open]=true (inputs=1) |
| 49 | kbd-nutrition/bar-hidden | PASS | barTop=844 vh=844 |
| 50 | desktop-dark/no-bottom-bar | PASS | bottom nav visible=false (want false) |
| 51 | desktop-dark/sidebar-groups | PASS | group labels=["Track","Plan","Review","More"] |
| 52 | desktop-light/no-bottom-bar | PASS | bottom nav visible=false (want false) |
| 53 | desktop-light/sidebar-groups | PASS | group labels=["Track","Plan","Review","More"] |
| 54 | desktop/workouts-active | PASS | data-active=true aria-current=null found=true |
| 55 | sheet/headings | PASS | Track:true, Plan:true, Review:true, More:true |
| 56 | redirect /water | PASS | status=307 location=/hydration (want 307/308 -> /hydration) |
| 57 | redirect /weight | PASS | status=307 location=/progress (want 307/308 -> /progress) |
| 58 | redirect /settings | PASS | status=307 location=/account (want 307/308 -> /account) |
| 59 | redirect /chat | PASS | status=307 location=/ (want 307/308 -> /) |
| 60 | redirect /quit-test | PASS | status=307 location=/quit-date (want 307/308 -> /quit-date) |
| 61 | redirect /meals | PASS | status=307 location=/nutrition (want 307/308 -> /nutrition) |
| 62 | redirect /dashboard | PASS | status=307 location=/today (want 307/308 -> /today) |
| 63 | safe-area/class-present | PASS | pb-safe-edge class on bar=true; computed padding-bottom=0px (env() resolves 0 without real insets, code-level check) |

---

## Visual review (harsh critique, graded vs m.youtube.com)

Screenshots in this folder. Reviewed dark + light at 390/360/320, chat, both drawers, sheet, desktop sidebar, keyboard-hidden.

### What's genuinely good
- Bottom bar reads like a real pro tab bar: frosted `bg-background/95 backdrop-blur`, hairline top border, 5 evenly-weighted tabs. The red center "Log" action (filled circle + plus) is the correct m.youtube / Instagram center-verb treatment and clearly the primary action.
- Labels never truncate, even at 320px (tabs ~63px wide there). No horizontal overflow at any width.
- Active state is unambiguous: bold white label + red (`text-blood`) icon, `aria-current=page` set correctly on Today/Progress/Coach as the route changes.
- Keyboard-hide works exactly as specced: focus the composer -> `html[data-vk-open]` + `translate-y-full`, bar is fully offscreen (top == viewport height), returns on blur. No dead gap above the composer.
- Log drawer: no autofocus (activeElement is the drawer div, not an input), 5 clean full-width rows (348x47), drag handle + close X. Owner "nothing starts uninvited" law upheld.
- More drawer + phone sheet + desktop sidebar all render the identical Track/Plan/Review/More grouping, the three surfaces cannot drift (shared NAV_GROUPS). Desktop sidebar marks Workouts active on /workouts/history (`data-active=true`).

### Defects / nits (all LOW severity, none block ship)
1. **Bar height ~60px, not the intended 56px** (LOW). The inner row is `h-14` (56px) but the icon(20)+gap+label content measures ~59.5px, so the effective bar is ~60px at every width. It still comfortably clears 44px targets and actually exceeds YouTube's 56px, so it looks fine, but it is 4px over the nominal spec and the tab content slightly overfills its `h-14` box (no clipping observed). If pixel-matching 56px matters, tighten the label line-height or icon/gap.
2. **"More" naming collision** (LOW). The More drawer is titled "More" and its last group is *also* labelled "More" (the utility group). Reads slightly redundant ("More > More"). Consider retitling the utility group heading (e.g. "Account & tools") on the drawer/sheet/sidebar, or dropping the group caption inside the More drawer specifically.
3. **Desktop sidebar overflows 900px height** (LOW / expected). At 1440x900 the Track/Plan/Review/More list is taller than the viewport; Files / Quit Test / Account / Help sit below the fold and require scrolling the sidebar content (footer "Plans & pricing" is pinned). Standard behavior, but worth confirming the content scroll is smooth on short laptops.
4. **Chat top email-verification banner** (not a nav defect, pre-existing). At 390 it stacks above the chat header and eats ~90px; unrelated to FIX-20/21 but visible in `03-chat-390-dark.png`.

### Verdict
FIX-20 and FIX-21 meet the acceptance criteria and match/exceed the m.youtube.com bar on every measured dimension (height, label size, >=44px targets, frosted glass, center action). Ship-ready; the four nits above are polish, not blockers.
