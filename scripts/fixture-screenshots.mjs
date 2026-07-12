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
};

const WIDTHS = [1440, 1280, 1024, 768, 390, 360, 320];
const THEMES = ["dark", "light"];

/** Kill animation/transition nondeterminism before every capture. */
const FREEZE_CSS = `
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    caret-color: transparent !important;
  }
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
          await page.screenshot({
            path: join(dir, `${theme}-${width}.png`),
            fullPage: true,
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
