/**
 * FIX-39 VISUAL-REGRESSION SCREENSHOT SUITE (skeleton, P2-A).
 *
 * Drives the fixture harness (app/dev/fixtures) with node Playwright and
 * emits a deterministic, diffable image set:
 *
 *   artifacts/fixture-screenshots/<page>/<theme>-<width>.png
 *
 * Coverage: every harness page x 7 widths x 2 themes, with animations and
 * caret blinking disabled so a byte-diff means a real visual change.
 * P2-B/C/D/E add their harness pages to PAGES as they land; P2-Z reviews
 * and freezes the resulting set as the CI baseline.
 *
 * Usage:
 *   pnpm screenshot:fixtures                  (default http://localhost:3600)
 *   FIXTURE_BASE_URL=http://localhost:3000 pnpm screenshot:fixtures
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.FIXTURE_BASE_URL ?? "http://localhost:3600";
const OUT = join(process.cwd(), "artifacts", "fixture-screenshots");

/** slug -> route. Parallel sessions append their harness pages here. */
const PAGES = {
  tokens: "/dev/fixtures/tokens",
  personas: "/dev/fixtures/personas",
  "roles-consistent": "/dev/fixtures/roles?persona=consistent",
  "roles-first-run": "/dev/fixtures/roles?persona=first-run",
  "roles-sparse": "/dev/fixtures/roles?persona=sparse",
  "roles-lapsed": "/dev/fixtures/roles?persona=lapsed",
  "roles-overshoot": "/dev/fixtures/roles?persona=overshoot",
  "roles-locked": "/dev/fixtures/roles?persona=locked-basic",
  // P2-B: panel composition (role spans + collapse) per persona.
  "panels-consistent": "/dev/fixtures/panels?persona=consistent",
  "panels-first-run": "/dev/fixtures/panels?persona=first-run",
  "panels-sparse": "/dev/fixtures/panels?persona=sparse",
  "panels-lapsed": "/dev/fixtures/panels?persona=lapsed",
  "panels-overshoot": "/dev/fixtures/panels?persona=overshoot",
  "panels-locked": "/dev/fixtures/panels?persona=locked-basic",
  // P2-D: overlay platform, closed and deterministically-open states.
  overlays: "/dev/fixtures/overlays",
  "overlays-quicklog": "/dev/fixtures/overlays?open=quicklog",
  "overlays-edit": "/dev/fixtures/overlays?open=edit",
  "overlays-confirm": "/dev/fixtures/overlays?open=confirm",
  "overlays-sheet": "/dev/fixtures/overlays?open=sheet",
  // P2-E: form and feedback primitives (FIX-38).
  forms: "/dev/fixtures/forms",
  // P2-C: chart grammar states + chart types per persona (FIX-18).
  "charts-consistent": "/dev/fixtures/charts?persona=consistent",
  "charts-first-run": "/dev/fixtures/charts?persona=first-run",
  "charts-sparse": "/dev/fixtures/charts?persona=sparse",
  "charts-lapsed": "/dev/fixtures/charts?persona=lapsed",
  "charts-overshoot": "/dev/fixtures/charts?persona=overshoot",
  "charts-locked": "/dev/fixtures/charts?persona=locked-basic",
  // P56-C: the real FIX-25/26/27 tracking panels, all personas + forced
  // fetch states on one page (new images; P56-Z reviews the wave approval).
  "today-panels": "/dev/fixtures/today-panels",
  // P56-A: the FIX-32 cross-domain Progress overview, all nine sections per
  // persona (new images; P56-Z reviews the wave approval).
  "progress-overview-consistent": "/dev/fixtures/progress?persona=consistent",
  "progress-overview-first-run": "/dev/fixtures/progress?persona=first-run",
  "progress-overview-sparse": "/dev/fixtures/progress?persona=sparse",
  "progress-overview-lapsed": "/dev/fixtures/progress?persona=lapsed",
  "progress-overview-overshoot": "/dev/fixtures/progress?persona=overshoot",
  "progress-overview-locked": "/dev/fixtures/progress?persona=locked-basic",
  // P56-B: the FIX-33 Progress > Training analytics matrix, every persona +
  // the locked teaser on one page (new images; P56-Z reviews the wave
  // approval).
  training: "/dev/fixtures/training",
  // P56-E: the FIX-30 plans-and-goals summaries + Progress-highlight tiles,
  // all personas on one page (new images; P56-Z reviews the wave approval).
  "plans-goals": "/dev/fixtures/plans-goals",
};

const WIDTHS = [1440, 1280, 1024, 768, 390, 360, 320];
const THEMES = ["dark", "light"];

/** Kill animation/transition nondeterminism before every capture. The
 *  Next.js dev-indicator portal is hidden too: its issue badge occludes
 *  panel pixels and is dev-only chrome, not product UI. */
const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
  nextjs-portal { display: none !important; }
`;

async function main() {
  const browser = await chromium.launch();
  let count = 0;
  try {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        colorScheme: theme === "dark" ? "dark" : "light",
        reducedMotion: "reduce",
        deviceScaleFactor: 1,
      });
      // next-themes reads localStorage.theme; stamp it before any page runs.
      await context.addInitScript((t) => {
        window.localStorage.setItem("theme", t);
      }, theme);

      const page = await context.newPage();
      for (const [slug, route] of Object.entries(PAGES)) {
        const dir = join(OUT, slug);
        mkdirSync(dir, { recursive: true });
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
          await page.addStyleTag({ content: FREEZE_CSS });
          await page.evaluate(() => document.fonts.ready);
          // fullPage (captureBeyondViewport) rasterizes recharts SVG plots as
          // BLANK even when the DOM is fully rendered (verified P2-C, evidence
          // in artifacts/p2c-verify/probe-*.png). Size the viewport to the
          // document and capture plain so chart pages screenshot correctly.
          const docHeight = await page.evaluate(
            () => document.documentElement.scrollHeight
          );
          await page.setViewportSize({
            width,
            height: Math.min(Math.max(900, docHeight), 20_000),
          });
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({
            path: join(dir, `${theme}-${width}.png`),
            fullPage: false,
          });
          count++;
          process.stdout.write(`\r${slug} ${theme} ${width}px (${count})   `);
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\ndone: ${count} screenshots in ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
