/**
 * PANEL HEIGHT-BUDGET CHECK (FIX-15 / DEC-07, P2-Z).
 *
 * Repeatable enforcement of the role height budgets: drives the fixture
 * harness and measures every [data-panel-role] card against the budget its
 * frame publishes (data-height-min / data-height-max, from
 * lib/contracts/panels.ts heightRange).
 *
 * DEC-07 (resolved P2-Z): heightRange is the DESKTOP budget. Below the md
 * break the max scales by PHONE_HEIGHT_MULTIPLIER, read from
 * lib/contracts/panels.ts so this script cannot drift from the contract.
 *
 * Rules (the P2-B run-3 method, now re-runnable):
 *   empty                       height <= min * 1.2   (widths >= 768)
 *   sparse/stale/populated      height <= max * 1.05  (widths >= 1280)
 *   any data state, width < 768 height <= max * PHONE_HEIGHT_MULTIPLIER * 1.05
 *
 * Usage: node scripts/panel-budget-check.mjs   (server on 3600 or FIXTURE_BASE_URL)
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.FIXTURE_BASE_URL ?? "http://localhost:3600";

const contractSource = readFileSync(
  join(process.cwd(), "lib", "contracts", "panels.ts"),
  "utf8"
);
const multMatch = contractSource.match(
  /PHONE_HEIGHT_MULTIPLIER\s*=\s*([\d.]+)/
);
if (!multMatch) {
  console.error("panel-budget-check: PHONE_HEIGHT_MULTIPLIER not found in lib/contracts/panels.ts");
  process.exit(1);
}
const PHONE_MULT = Number(multMatch[1]);

/**
 * Budgets are GRID-LAYOUT budgets, so they are enforced on the composition
 * pages (the real grid-dashboard columns, the surface P2-B's accepted run-3
 * measurements used). The roles matrix squeezes panels into inspection cells
 * narrower than any real grid column, which inflates wrap-driven heights and
 * over-fires the check.
 */
const PAGES = [
  "/dev/fixtures/panels?persona=consistent",
  "/dev/fixtures/panels?persona=first-run",
  "/dev/fixtures/panels?persona=sparse",
  "/dev/fixtures/panels?persona=lapsed",
  "/dev/fixtures/panels?persona=overshoot",
];
const WIDTHS = [1440, 1280, 768, 390, 360, 320];

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const failures = [];
  let measured = 0;

  for (const route of PAGES) {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 1200 });
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      const panels = await page.evaluate(() =>
        [...document.querySelectorAll("[data-panel-role]")].map((el) => ({
          role: el.getAttribute("data-panel-role"),
          state: el.getAttribute("data-panel-state"),
          min: Number(el.getAttribute("data-height-min")),
          max: Number(el.getAttribute("data-height-max")),
          // clientHeight: the budget bounds CONTENT height (padding included,
          // border excluded), matching the P2-B run-3 method.
          height: el.clientHeight,
        }))
      );
      for (const p of panels) {
        measured++;
        let limit = null;
        let rule = null;
        if (p.state === "empty" && width >= 768) {
          limit = p.min * 1.2;
          rule = "empty <= min*1.2";
        } else if (
          ["sparse", "stale", "populated"].includes(p.state ?? "")
        ) {
          if (width < 768) {
            limit = p.max * PHONE_MULT * 1.05;
            rule = `data <= max*${PHONE_MULT}*1.05 (phone, DEC-07)`;
          } else if (width >= 1280) {
            limit = p.max * 1.05;
            rule = "data <= max*1.05 (desktop)";
          }
        }
        if (limit != null && p.height > limit) {
          failures.push(
            `${route} @${width} ${p.role}/${p.state}: ${Math.round(p.height)}px > ${Math.round(limit)}px (${rule})`
          );
        }
      }
    }
  }

  await browser.close();
  if (failures.length) {
    console.error(`panel-budget-check: ${failures.length} violation(s):`);
    for (const f of failures) {
      console.error(`  ${f}`);
    }
    process.exit(1);
  }
  console.log(
    `panel-budget-check: OK, ${measured} panel measurements within budget (phone multiplier ${PHONE_MULT}).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
