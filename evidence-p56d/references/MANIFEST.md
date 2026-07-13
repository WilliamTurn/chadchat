# P56-D Reference Capture Manifest

Captured 2026-07-13 for session P56-D (Today-shell rebuild benchmark teardown).
All captures are full-page screenshots of PUBLIC marketing / help-center / component-doc
pages (no login walls breached). Where a candidate is app-only or login-walled, that is
recorded honestly below (P34-A precedent: honest recording beats fake references).

Capture method: node + @playwright/test (chromium 1.51.0), 1280x1600 viewport,
deviceScaleFactor 2, fullPage. Script: chadchat/_p56d-capture.mjs (deleted after run).

| File | Source URL | Date on page | What it shows | Honesty note |
|------|-----------|--------------|---------------|--------------|
| 01-whoop-home-locker.png | https://www.whoop.com/us/en/thelocker/the-all-new-whoop-home-screen/ | 2023-06-21 | WHOOP Home screen: 3 color-arc rings (Sleep 74% / Recovery 85% / Strain 14.2) on near-black | Official marketing image of the app screen; app itself is login-walled |
| 02-whoop-overview-metrics.png | https://www.whoop.com/us/en/thelocker/your-key-whoop-metrics-all-in-one-place/ | 2025 | WHOOP overview/metrics-in-one-place explainer | Official marketing |
| 03-oura-new-today.png | https://ouraring.com/blog/new-oura-app-experience/ | 2025-10 | Oura new Today tab redesign, "one big thing", Vitals, scores | Official blog with app screenshots |
| 04-macrofactor-widgets.png | https://help.macrofactorapp.com/en/articles/225-understanding-the-widgets-at-the-top-of-the-dashboard | current | MacroFactor Dashboard: compact header + 3 swipeable top widgets (Nutrition & Targets, Energy Balance, Daily Nutrition) with real in-app screenshots | Official help center, real app screenshots |
| 05-macrofactor-dashboard.png | https://help.macrofactorapp.com/en/articles/22-get-to-know-your-dashboard | current | MacroFactor full dashboard tour | Official help center |
| 06-hevy-consistency.png | https://www.hevyapp.com/features/gym-consistency/ | current | Hevy gym-consistency + weekly streak calendar (blue day circles) | Official feature page |
| 07-tremor-tracker.png | https://www.tremor.so/docs/visualizations/tracker | current | Tremor Tracker component: horizontal grid of colored day-blocks (consistency matrix) | Live component doc |
| 08-magicui-number-ticker.png | https://magicui.design/docs/components/number-ticker | current | MagicUI Number Ticker animated count component | Live component doc |
| 09-aceternity-stats-ticker.png | https://ui.aceternity.com/blocks/stats-sections/stats-with-number-ticker | current | Aceternity "Stats with Number Ticker" stat-card block | Live component doc |
| 10-numberflow-home.png | https://number-flow.barvian.me/ | current | NumberFlow animated number component landing/demo | Live component doc |
| 11-rise-energy-schedule.png | https://help.risescience.com/hc/en-us/articles/6654243671191-What-is-my-Daily-Energy-Energy-Schedule | current | Rise Daily Energy / Energy Schedule explainer | PARTIAL: page timed out on networkidle; viewport-only capture saved. Text detail gathered via WebSearch instead |
| 12-gentler-streak-home.png | https://gentler.app/ | current | Gentler Streak marketing home (Activity Path, Today's Recommendations, vitals widgets) | Official marketing |

## Candidates NOT screenshot-captured (login/app-walled) — recorded honestly
- **Mobbin galleries** (MacroFactor, Oura, Duolingo streak screens): login-walled; used only
  the visible search-snippet descriptions, not captured.
- **Duolingo streak calendar / Perfect Streak bar**: app-only + Mobbin-walled. Structure
  documented from Duolingo's own engineering blog + deconstructoroffun breakdown (cited in
  benchmark-ranking.md), not screenshot.
- **Apple Fitness rings, Fitbit Today, Peloton, Headspace/Calm today, Oura live app,
  Whoop live app**: all app-only or login-walled. Documented from official/marketing text.
- **Screensdesign / 925studios teardowns**: used as written analysis sources (cited), the
  video-frame galleries were not scraped.

No fabricated references. Every image above is a real capture of the stated public URL.
