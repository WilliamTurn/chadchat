# GATE-03 items 2/3/4/7 — grouped desktop nav, mobile bottom nav, keyboard-safe, console (fresh 2026-07-13)

Against http://localhost:3600, Pro test account claude-testing@example.com, read-only. Screenshots in ./gate03/.

**Totals: 47 PASS / 0 FAIL / 0 NOTE**

| # | Assertion | Result | Detail |
|---|---|---|---|
| 1 | login | PASS | /today resolved to /today |
| 2 | desktop-1440-dark/no-bottom-bar | PASS | bottom bar visible=false (want false) |
| 3 | desktop-1440-dark/groups | PASS | captions=["Track","Plan","Review"] (want Track/Plan/Review; NO More/Utility/Primary) |
| 4 | desktop-1440-dark/primary-group | PASS | Dashboard link present=true |
| 5 | desktop-1440-dark/utility-hairline | PASS | utility block border-top=1px |
| 6 | desktop-1440-dark/quit-date-skull | PASS | Quit Test entry present=true, Skull icon=true |
| 7 | desktop-1440-dark/active-subroute | PASS | Workouts data-active=true; all active links=["Workouts"] (want exactly [Workouts] on /workouts/history) |
| 8 | desktop-1440-light/no-bottom-bar | PASS | bottom bar visible=false (want false) |
| 9 | desktop-1440-light/groups | PASS | captions=["Track","Plan","Review"] (want Track/Plan/Review; NO More/Utility/Primary) |
| 10 | desktop-1440-light/primary-group | PASS | Dashboard link present=true |
| 11 | desktop-1440-light/utility-hairline | PASS | utility block border-top=1px |
| 12 | desktop-1440-light/quit-date-skull | PASS | Quit Test entry present=true, Skull icon=true |
| 13 | desktop-1440-light/active-subroute | PASS | Workouts data-active=true; all active links=["Workouts"] (want exactly [Workouts] on /workouts/history) |
| 14 | mobile-320-dark/bar-visible | PASS | visible=true |
| 15 | mobile-320-dark/labels | PASS | labels=["Today","Log","Progress","Coach","More"] |
| 16 | mobile-320-dark/tap-targets | PASS | Today:63.2x59.5, Log:65.2x59.5, Progress:63.2x59.5, Coach:63.2x59.5, More:65.2x59.5 |
| 17 | mobile-320-dark/aria-current | PASS | aria-current=page on ["Today"] (on /today want [Today]) |
| 18 | mobile-320-light/bar-visible | PASS | visible=true |
| 19 | mobile-320-light/labels | PASS | labels=["Today","Log","Progress","Coach","More"] |
| 20 | mobile-320-light/tap-targets | PASS | Today:63.2x59.5, Log:65.2x59.5, Progress:63.2x59.5, Coach:63.2x59.5, More:65.2x59.5 |
| 21 | mobile-320-light/aria-current | PASS | aria-current=page on ["Today"] (on /today want [Today]) |
| 22 | mobile-360-dark/bar-visible | PASS | visible=true |
| 23 | mobile-360-dark/labels | PASS | labels=["Today","Log","Progress","Coach","More"] |
| 24 | mobile-360-dark/tap-targets | PASS | Today:71.2x59.5, Log:73.2x59.5, Progress:71.2x59.5, Coach:71.2x59.5, More:73.2x59.5 |
| 25 | mobile-360-dark/aria-current | PASS | aria-current=page on ["Today"] (on /today want [Today]) |
| 26 | mobile-360-light/bar-visible | PASS | visible=true |
| 27 | mobile-360-light/labels | PASS | labels=["Today","Log","Progress","Coach","More"] |
| 28 | mobile-360-light/tap-targets | PASS | Today:71.2x59.5, Log:73.2x59.5, Progress:71.2x59.5, Coach:71.2x59.5, More:73.2x59.5 |
| 29 | mobile-360-light/aria-current | PASS | aria-current=page on ["Today"] (on /today want [Today]) |
| 30 | mobile-390-dark/bar-visible | PASS | visible=true |
| 31 | mobile-390-dark/labels | PASS | labels=["Today","Log","Progress","Coach","More"] |
| 32 | mobile-390-dark/tap-targets | PASS | Today:77.2x59.5, Log:79.2x59.5, Progress:77.2x59.5, Coach:77.2x59.5, More:79.2x59.5 |
| 33 | mobile-390-dark/aria-current | PASS | aria-current=page on ["Today"] (on /today want [Today]) |
| 34 | mobile-390-light/bar-visible | PASS | visible=true |
| 35 | mobile-390-light/labels | PASS | labels=["Today","Log","Progress","Coach","More"] |
| 36 | mobile-390-light/tap-targets | PASS | Today:77.2x59.5, Log:79.2x59.5, Progress:77.2x59.5, Coach:77.2x59.5, More:79.2x59.5 |
| 37 | mobile-390-light/aria-current | PASS | aria-current=page on ["Today"] (on /today want [Today]) |
| 38 | bar-absent-768 | PASS | bottom bar visible at 768px=false (want false) |
| 39 | bar-absent-1440 | PASS | bottom bar visible at 1440px=false (want false) |
| 40 | log-drawer/5-destinations | PASS | Log a meal(/nutrition#log-meal); Log water(/hydration); Log sleep(/sleep); Log a weigh-in(/progress#log-entry); Log a workout(/workouts/new) |
| 41 | log-drawer/no-autofocus | PASS | activeElement=div, data-vk-open=false |
| 42 | more-sheet/grouped | PASS | captions=["Track","Plan","Review"]; QuitTest present=true |
| 43 | kbd-chat/vk-open | PASS | html[data-vk-open]=true |
| 44 | kbd-chat/bar-hidden | PASS | barTop=844 vh=844 translate-y-full=true |
| 45 | kbd-chat/restored-on-blur | PASS | data-vk-open removed=true, translate class gone=true |
| 46 | kbd-nutrition/vk-open+hidden | PASS | data-vk-open=true barTop=844 vh=844 |
| 47 | kbd-nutrition/restored | PASS | data-vk-open removed=true |

## Console errors (item 7) — 1 unique

- [login] An async function with useActionState was called outside of a transition. This is likely not what you intended (for example, isPending will not update correctly). Either call the returned function inside startTransition, or pass it to an `action` or `formAction` prop.
