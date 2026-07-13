# P34-A FINAL verification (FIX-20 + FIX-21)

Generated 2026-07-13T14:11:30.107Z against http://localhost:3600 (shared prod DB, strictly read-only).
Covers the post-refinement build: the utility nav group is uncaptioned everywhere and renders as a trailing block behind a hairline top border.

**Totals: 79 PASS / 0 FAIL / 0 NOTE**

| # | Assertion | Result | Detail |
|---|---|---|---|
| 1 | login | PASS | /today resolved to /today |
| 2 | today-390-dark/bar-visible | PASS | visible=true |
| 3 | today-390-dark/labels | PASS | labels=["Today","Log","Progress","Coach","More"] |
| 4 | today-390-dark/tap-targets | PASS | Today:77.2x59.5, Log:79.2x59.5, Progress:77.2x59.5, Coach:77.2x59.5, More:79.2x59.5 |
| 5 | today-390-dark/no-overflow | PASS | scrollW=390 clientW=390 |
| 6 | today-390-dark/labels-intact | PASS | no label truncation |
| 7 | today-390-light/bar-visible | PASS | visible=true |
| 8 | today-390-light/labels | PASS | labels=["Today","Log","Progress","Coach","More"] |
| 9 | today-390-light/tap-targets | PASS | Today:77.2x59.5, Log:79.2x59.5, Progress:77.2x59.5, Coach:77.2x59.5, More:79.2x59.5 |
| 10 | today-390-light/no-overflow | PASS | scrollW=390 clientW=390 |
| 11 | today-390-light/labels-intact | PASS | no label truncation |
| 12 | today-360-dark/bar-visible | PASS | visible=true |
| 13 | today-360-dark/labels | PASS | labels=["Today","Log","Progress","Coach","More"] |
| 14 | today-360-dark/tap-targets | PASS | Today:71.2x59.5, Log:73.2x59.5, Progress:71.2x59.5, Coach:71.2x59.5, More:73.2x59.5 |
| 15 | today-360-dark/no-overflow | PASS | scrollW=360 clientW=360 |
| 16 | today-360-dark/labels-intact | PASS | no label truncation |
| 17 | today-360-light/bar-visible | PASS | visible=true |
| 18 | today-360-light/labels | PASS | labels=["Today","Log","Progress","Coach","More"] |
| 19 | today-360-light/tap-targets | PASS | Today:71.2x59.5, Log:73.2x59.5, Progress:71.2x59.5, Coach:71.2x59.5, More:73.2x59.5 |
| 20 | today-360-light/no-overflow | PASS | scrollW=360 clientW=360 |
| 21 | today-360-light/labels-intact | PASS | no label truncation |
| 22 | today-320-dark/bar-visible | PASS | visible=true |
| 23 | today-320-dark/labels | PASS | labels=["Today","Log","Progress","Coach","More"] |
| 24 | today-320-dark/tap-targets | PASS | Today:63.2x59.5, Log:65.2x59.5, Progress:63.2x59.5, Coach:63.2x59.5, More:65.2x59.5 |
| 25 | today-320-dark/no-overflow | PASS | scrollW=320 clientW=320 |
| 26 | today-320-dark/labels-intact | PASS | no label truncation |
| 27 | today-320-light/bar-visible | PASS | visible=true |
| 28 | today-320-light/labels | PASS | labels=["Today","Log","Progress","Coach","More"] |
| 29 | today-320-light/tap-targets | PASS | Today:63.2x59.5, Log:65.2x59.5, Progress:63.2x59.5, Coach:63.2x59.5, More:65.2x59.5 |
| 30 | today-320-light/no-overflow | PASS | scrollW=320 clientW=320 |
| 31 | today-320-light/labels-intact | PASS | no label truncation |
| 32 | more-drawer-dark/captions | PASS | captions=["Track","Plan","Review"] (want Track/Plan/Review, NO More) |
| 33 | more-drawer-dark/separator | PASS | hairline top border=1px above utility block |
| 34 | more-drawer-dark/utility-links | PASS | Rate My Kitchen/Files/Quit Test/Account/Help all present |
| 35 | more-drawer-light/captions | PASS | captions=["Track","Plan","Review"] (want Track/Plan/Review, NO More) |
| 36 | more-drawer-light/separator | PASS | hairline top border=1px above utility block |
| 37 | more-drawer-light/utility-links | PASS | Rate My Kitchen/Files/Quit Test/Account/Help all present |
| 38 | sheet-390-dark/captions | PASS | captions=["Track","Plan","Review"] (want Track/Plan/Review, NO More) |
| 39 | sheet-390-dark/separator | PASS | hairline top border=1px above utility block |
| 40 | sheet-390-dark/utility-links | PASS | Rate My Kitchen/Files/Quit Test/Account/Help all present |
| 41 | desktop-1440-dark/no-bottom-bar | PASS | bottom bar visible=false (want false) |
| 42 | sidebar-1440-dark/captions | PASS | captions=["Track","Plan","Review"] (want Track/Plan/Review, NO More) |
| 43 | sidebar-1440-dark/separator | PASS | hairline top border=1px above utility block |
| 44 | sidebar-1440-dark/utility-links | PASS | Rate My Kitchen/Files/Quit Test/Account/Help all present |
| 45 | desktop-1440-light/no-bottom-bar | PASS | bottom bar visible=false (want false) |
| 46 | sidebar-1440-light/captions | PASS | captions=["Track","Plan","Review"] (want Track/Plan/Review, NO More) |
| 47 | sidebar-1440-light/separator | PASS | hairline top border=1px above utility block |
| 48 | sidebar-1440-light/utility-links | PASS | Rate My Kitchen/Files/Quit Test/Account/Help all present |
| 49 | tablet-768/no-bottom-bar | PASS | bottom bar visible at exactly 768px=false (want false; md: breakpoint) |
| 50 | kbd-chat/vk-open | PASS | html[data-vk-open]=true |
| 51 | kbd-chat/bar-offscreen | PASS | barTop=844 vh=844 translate-y-full=true |
| 52 | kbd-chat/restored-on-blur | PASS | data-vk-open removed=true, translate class gone=true |
| 53 | kbd-nutrition/vk-open+offscreen | PASS | data-vk-open=true barTop=844 vh=844 |
| 54 | kbd-nutrition/restored | PASS | data-vk-open removed=true |
| 55 | log-drawer/rows | PASS | Log a meal(h=47, /nutrition#log-meal); Log water(h=47, /hydration); Log sleep(h=47, /sleep); Log a weigh-in(h=47, /progress#log-entry); Log a workout(h=47, /workouts/new) |
| 56 | log-drawer/tap-targets | PASS | heights=47,47,47,47,47 |
| 57 | log-drawer/no-autofocus | PASS | activeElement=div |
| 58 | log-meal/target | PASS | landed /nutrition#log-meal; #log-meal exists=true top=0 inView=true |
| 59 | log-weigh-in/target | PASS | landed /progress#log-entry; #log-entry exists=true top=1 inView=true |
| 60 | log-workout/target | PASS | landed /workouts/new |
| 61 | redirect /dashboard | PASS | status=307 location=/today (want 307/308 -> /today) |
| 62 | redirect /chat | PASS | status=307 location=/ (want 307/308 -> /) |
| 63 | redirect /coach | PASS | status=307 location=/ (want 307/308 -> /) |
| 64 | redirect /water | PASS | status=307 location=/hydration (want 307/308 -> /hydration) |
| 65 | redirect /weight | PASS | status=307 location=/progress (want 307/308 -> /progress) |
| 66 | redirect /body | PASS | status=307 location=/progress (want 307/308 -> /progress) |
| 67 | redirect /food | PASS | status=307 location=/nutrition (want 307/308 -> /nutrition) |
| 68 | redirect /meals | PASS | status=307 location=/nutrition (want 307/308 -> /nutrition) |
| 69 | redirect /calories | PASS | status=307 location=/nutrition (want 307/308 -> /nutrition) |
| 70 | redirect /workout | PASS | status=307 location=/workouts (want 307/308 -> /workouts) |
| 71 | redirect /settings | PASS | status=307 location=/account (want 307/308 -> /account) |
| 72 | redirect /billing | PASS | status=307 location=/account (want 307/308 -> /account) |
| 73 | redirect /report | PASS | status=307 location=/reports (want 307/308 -> /reports) |
| 74 | redirect /quit | PASS | status=307 location=/quit-date (want 307/308 -> /quit-date) |
| 75 | redirect /quit-test | PASS | status=307 location=/quit-date (want 307/308 -> /quit-date) |
| 76 | no-redirect /chat/some-fake-id | PASS | status=307 location=/login?redirectUrl=%2Fchat%2Fsome-fake-id (must not be 307/308 -> /) |
| 77 | chat-390/bar-visible | PASS | visible=true |
| 78 | chat-390/coach-active | PASS | aria-current=page on ["Coach"] |
| 79 | chat-390/composer-above-bar | PASS | composerBottom=774 barTop=784 |

---

## Visual review (final pass)

Screenshots: `final-*.png` in this folder.

- **Uncaptioned utility block confirmed on all four surfaces.** More drawer (dark + light), phone hamburger sheet, and desktop standalone sidebar (dark + light) all render Track/Plan/Review captions followed by an uncaptioned trailing block (Rate My Kitchen, Files, Quit Test, Account, Help) behind a measured 1px hairline top border. The "More > More" redundancy flagged in the smoke run is resolved.
- **Tablet boundary correct**: at exactly 768x1024 the bottom bar does not render and the left sidebar owns navigation (`final-tablet-768-dark.png`).
- **Bottom bar unchanged and healthy** at 390/360/320 in both themes: 5 tabs, no label truncation, no horizontal overflow, all tap targets 63-79px wide x 59.5px tall (>= 44px).
- **Keyboard behavior intact** on chat and /nutrition: focus -> `data-vk-open` + bar offscreen (top == 844 == viewport height); blur -> attribute and translate class removed.
- **Log drawer link targets verified live**: "Log a meal" lands /nutrition#log-meal with the anchor section at viewport top (top=0, in view); "Log a weigh-in" lands /progress#log-entry (top=1, in view); "Log a workout" lands /workouts/new. Anchor sections stream in under Cache Components; they appear within ~1-2s of navigation.
- **Redirects**: all 15 aliases 307 to the registered destination. `/chat/some-fake-id` is NOT config-aliased to `/`; unauthenticated it 307s to `/login?redirectUrl=%2Fchat%2Fsome-fake-id` (auth proxy behavior, as expected for a real route pattern).

### Remaining nits (LOW, unchanged from smoke run, none block ship)
1. Effective bar height ~60px vs the nominal 56px (`h-14` row overfilled by icon+gap+label at ~59.5px). Still exceeds the m.youtube 56px benchmark; cosmetic only.
2. Desktop sidebar list exceeds a 900px viewport; the utility links sit below the fold and scroll within the panel (standard, footer pinned).
3. Pre-existing, unrelated: the email-verification banner on chat at 390 consumes ~90px of the top of the viewport.

### Verdict
79/79 assertions PASS. No regressions from the smoke run; the utility-group refinement renders correctly everywhere it was applied. FIX-20 + FIX-21 verified ship-ready.
