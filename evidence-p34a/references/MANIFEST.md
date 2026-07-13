# P34A Reference Capture, Mobile-Web Bottom Navigation Bars

Captured: 2026-07-13T13:36:31.152Z

Emulation: iPhone 12 (390x844, deviceScaleFactor 3, touch, mobile UA) via Node Playwright (chromium 134). Also re-rendered at 320x568.

Screenshots are viewport captures (not fullPage) so the fixed bottom bar is visible in frame.

## Summary table

| Site | Loaded | Bottom bar | Height | Labels | Tabs | Scroll | Input-focus |
|------|--------|-----------|--------|--------|------|--------|-------------|
| youtube | yes | YES | 57px | icon+label | 3 | persists | bar stays |
| x | yes | none | - | - | - | hidden/none | n/a (no bar) |
| instagram | yes | none | - | - | - | hidden/none | no input |
| reddit | yes | none | - | - | - | hidden/none | no input |

## youtube

- URL loaded: https://m.youtube.com
- Page title: YouTube
- Logged-out state headline: "Try searching to get started".

### Bar anatomy
- Element: `<ytm-pivot-bar-renderer>` role="tablist"
- Bar height: 57px (computed height 56px, min-height 0px)
- Position: fixed, bottom:0px, z-index:3
- Background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(24px)
- Border-top: 1px solid rgba(0, 0, 0, 0.2); box-shadow: none
- padding-bottom: 0px (0px), no safe-area inset detected on desktop-emulated env
- Tabs: 3, labels: Home | Shorts | You
- Label pattern: 3 labeled, 0 icon-only (icon+label); label font-size 11px
- Active tab: "Home", color rgb(15, 15, 15), aria-selected="true"
- Touch targets: min tab dimension 56px; all >= 44px: YES

### Scroll behavior
- Scrolled to y=0. page did not scroll (logged-out empty state / no scrollable feed), scroll-persistence not exercised; bar is position:fixed bottom:0 so it is structurally pinned regardless. Bar bottom after scroll: 664.

### Input-focus behavior (key probe)
- Focused a text input (input[text]). bottom bar REMAINS visible while search input focused. (clicked trigger [aria-label*="Search" i][role="button"]; focused input input[placeholder*="Search" i])

### 320x568 render
- Bar present (h=57px, w=320px, fits width: true).
- Tab labels at 320: Home | Shorts | You. Labels dropped vs 390: false.

### Files
- [x] youtube-390-default.png
- [x] youtube-390-scrolled.png
- [x] youtube-390-input-focused.png
- [x] youtube-320-default.png
- [x] youtube-probe.json

## x

- URL loaded: https://x.com/explore
- Page title: X - The Everything App / X
- Logged-out gate: NO bottom nav rendered. A login/app-install wall was shown.

### Bar anatomy
- No bottom bar detected in the logged-out render.

### Scroll behavior
- Scrolled to y=0. no bar to begin with. Bar bottom after scroll: n/a.

### Input-focus behavior (key probe)
- Focused a text input (input[text]). N/A, no bottom bar existed in the logged-out render (login/app wall), so there is no hide-on-focus behavior to observe. (focused input input[type="text"])

### 320x568 render
- Bar absent.

### Notes
- no bottom bar detected in default logged-out render

### Files
- [x] x-390-default.png
- [x] x-390-scrolled.png
- [x] x-390-input-focused.png
- [x] x-320-default.png
- [ ] x-probe.json

## instagram

- URL loaded: https://www.instagram.com/instagram/
- Page title: Instagram
- Logged-out gate: NO bottom nav rendered. A login/app-install wall was shown (headline: "instagram").

### Bar anatomy
- No bottom bar detected in the logged-out render.

### Scroll behavior
- Scrolled to y=289. no bar to begin with. Bar bottom after scroll: n/a.

### Input-focus behavior (key probe)
- No reachable search input: no reachable search input found. (No input-focused screenshot produced.)

### 320x568 render
- Bar absent.

### Notes
- no bottom bar detected in default logged-out render

### Files
- [x] instagram-390-default.png
- [x] instagram-390-scrolled.png
- [ ] instagram-390-input-focused.png
- [x] instagram-320-default.png
- [ ] instagram-probe.json

## reddit

- URL loaded: https://www.reddit.com
- Page title: Reddit - The heart of the internet
- Logged-out gate: NO bottom nav rendered. A login/app-install wall was shown.

### Bar anatomy
- No bottom bar detected in the logged-out render.

### Scroll behavior
- Scrolled to y=800. no bar to begin with. Bar bottom after scroll: n/a.

### Input-focus behavior (key probe)
- No reachable search input: no reachable search input found. (No input-focused screenshot produced.)

### 320x568 render
- Bar absent.

### Notes
- no bottom bar detected in default logged-out render

### Files
- [x] reddit-390-default.png
- [x] reddit-390-scrolled.png
- [ ] reddit-390-input-focused.png
- [x] reddit-320-default.png
- [ ] reddit-probe.json
